import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PostStatus } from '@prisma/client';
import { assertTransition } from '../posts/post-workflow';
import { PrismaService } from '../prisma/prisma.service';

// Every minute, moves SCHEDULED posts whose time has passed to PUBLISHED.
// There is no real social network here, so "publishing" is just the
// status change plus an audit entry with no actor (shown as "System").
@Injectable()
export class PublishScheduledPostsJob {
  private readonly logger = new Logger(PublishScheduledPostsJob.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async handleCron() {
    // If a run takes longer than a minute, don't start a second one on top.
    if (this.running) {
      return;
    }
    this.running = true;
    try {
      await this.publishDuePosts(new Date());
    } finally {
      this.running = false;
    }
  }

  // Public and takes `now` as a parameter so it can be tested directly.
  async publishDuePosts(now: Date): Promise<number> {
    // The job follows the same workflow table as everyone else.
    assertTransition(PostStatus.SCHEDULED, PostStatus.PUBLISHED);

    const due = await this.prisma.post.findMany({
      where: { status: PostStatus.SCHEDULED, scheduledAt: { lte: now } },
      select: { id: true },
      orderBy: { scheduledAt: 'asc' },
    });

    let published = 0;
    for (const { id } of due) {
      // One transaction per post, so a problem with one post doesn't stop
      // the others from being published.
      try {
        const done = await this.publishOne(id);
        if (done) published++;
      } catch (err) {
        this.logger.error(`Failed to publish post ${id}`, err as Error);
      }
    }

    if (published > 0) {
      this.logger.log(`Published ${published} post(s)`);
    }
    return published;
  }

  private publishOne(id: number): Promise<boolean> {
    return this.prisma.$transaction(async (tx) => {
      // `status: SCHEDULED` in the where clause makes this safe to run
      // twice: if another run (or another server) already published the
      // post, nothing matches and we don't write a second audit entry.
      const { count } = await tx.post.updateMany({
        where: { id, status: PostStatus.SCHEDULED },
        data: { status: PostStatus.PUBLISHED, version: { increment: 1 } },
      });
      if (count === 0) {
        return false;
      }

      await tx.auditLog.create({
        data: {
          postId: id,
          actorId: null,
          fromStatus: PostStatus.SCHEDULED,
          toStatus: PostStatus.PUBLISHED,
        },
      });
      return true;
    });
  }
}
