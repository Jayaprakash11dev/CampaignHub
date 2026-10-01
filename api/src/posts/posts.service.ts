import { Injectable, NotFoundException } from '@nestjs/common';
import { Platform, PostStatus, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { assertCaptionFits } from './caption-limits';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQuery } from './dto/list-posts.query';
import {
  assertInFuture,
  conflictWindow,
  findConflict,
  ScheduleTarget,
  scheduleConflictError,
} from './scheduling';

const postInclude = {
  client: { select: { id: true, name: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.PostInclude;

@Injectable()
export class PostsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(user: AuthUser, query: ListPostsQuery) {
    return this.prisma.post.findMany({
      where: {
        ...this.visibleTo(user),
        clientId: query.clientId,
        platform: query.platform,
        status: query.status,
      },
      include: postInclude,
      orderBy: { scheduledAt: 'asc' },
    });
  }

  async findOne(id: number, user: AuthUser) {
    const post = await this.prisma.post.findFirst({
      where: { id, ...this.visibleTo(user) },
      include: postInclude,
    });
    if (!post) {
      throw new NotFoundException(`Post ${id} not found`);
    }
    return post;
  }

  async create(dto: CreatePostDto, user: AuthUser) {
    const client = await this.prisma.client.findUnique({
      where: { id: dto.clientId },
    });
    if (!client) {
      throw new NotFoundException(`Client ${dto.clientId} not found`);
    }

    const scheduledAt = new Date(dto.scheduledAt);
    assertCaptionFits(dto.platform, dto.caption);
    assertInFuture(scheduledAt);

    return this.prisma.$transaction(async (tx) => {
      await this.lockSlot(tx, dto.clientId, dto.platform);
      await this.assertNoConflict(tx, {
        clientId: dto.clientId,
        platform: dto.platform,
        scheduledAt,
      });

      const post = await tx.post.create({
        data: {
          clientId: dto.clientId,
          platform: dto.platform,
          caption: dto.caption,
          scheduledAt,
          createdById: user.id,
        },
        include: postInclude,
      });

      await tx.auditLog.create({
        data: {
          postId: post.id,
          actorId: user.id,
          fromStatus: null,
          toStatus: PostStatus.DRAFT,
        },
      });

      return post;
    });
  }

  // Reviewers only see posts for clients assigned to them.
  // Admins and creators see every post.
  private visibleTo(user: AuthUser): Prisma.PostWhereInput {
    if (user.role === Role.REVIEWER) {
      return { client: { reviewers: { some: { id: user.id } } } };
    }
    return {};
  }

  // Without this, two requests for the same slot could both run the
  // conflict query before either has inserted, and both would succeed.
  // A Postgres advisory lock keyed on (client, platform) makes them take
  // turns. It is released automatically when the transaction ends.
  private async lockSlot(
    tx: Prisma.TransactionClient,
    clientId: number,
    platform: Platform,
  ) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${clientId}::int, hashtext(${platform}))`;
  }

  private async assertNoConflict(
    tx: Prisma.TransactionClient,
    target: ScheduleTarget,
  ) {
    const nearby = await tx.post.findMany({
      where: {
        clientId: target.clientId,
        platform: target.platform,
        scheduledAt: conflictWindow(target.scheduledAt),
        id: target.id ? { not: target.id } : undefined,
      },
      select: { id: true, clientId: true, platform: true, scheduledAt: true },
    });

    const conflicting = findConflict(target, nearby);
    if (conflicting) {
      throw scheduleConflictError(conflicting);
    }
  }
}
