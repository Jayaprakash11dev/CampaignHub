import { Injectable, NotFoundException } from '@nestjs/common';
import { Platform, PostStatus, Prisma, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { assertCaptionFits } from './caption-limits';
import { CreatePostDto } from './dto/create-post.dto';
import { ListPostsQuery } from './dto/list-posts.query';
import { TransitionPostDto } from './dto/transition-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { versionMismatchError } from './post-errors';
import {
  allowedTransitionsFor,
  assertCanEdit,
  assertCanTransition,
  assertChangeRequestComment,
} from './post-policy';
import { assertTransition } from './post-workflow';
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
        scheduledAt: {
          gte: query.from ? new Date(query.from) : undefined,
          lt: query.to ? new Date(query.to) : undefined,
        },
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

  // Status history for the detail page's timeline, oldest first.
  // `actor` is null for changes made by the publish job.
  async findAuditLog(id: number, user: AuthUser) {
    await this.findOne(id, user);

    return this.prisma.auditLog.findMany({
      where: { postId: id },
      include: { actor: { select: { id: true, name: true, role: true } } },
      orderBy: [{ timestamp: 'asc' }, { id: 'asc' }],
    });
  }

  // Single post for the detail page, plus the status changes this user is
  // allowed to make right now (the UI shows one button per entry).
  async getPost(id: number, user: AuthUser) {
    const post = await this.findOne(id, user);
    return this.withAllowedTransitions(post, user);
  }

  async create(dto: CreatePostDto, user: AuthUser) {
    await this.assertClientExists(dto.clientId);

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

  async update(id: number, dto: UpdatePostDto, user: AuthUser) {
    const post = await this.findOne(id, user);
    assertCanEdit(user, post);

    // Fail fast if the client is already out of date. The real guarantee
    // is the `version` condition in updateMany below.
    if (dto.version !== post.version) {
      throw versionMismatchError(post.version);
    }

    const next = {
      clientId: dto.clientId ?? post.clientId,
      platform: dto.platform ?? post.platform,
      caption: dto.caption ?? post.caption,
      scheduledAt: dto.scheduledAt
        ? new Date(dto.scheduledAt)
        : post.scheduledAt,
    };

    if (next.clientId !== post.clientId) {
      await this.assertClientExists(next.clientId);
    }

    // Checked on every edit: switching an existing caption to X can make
    // it too long even if the caption itself didn't change.
    assertCaptionFits(next.platform, next.caption);

    const slotChanged =
      next.clientId !== post.clientId ||
      next.platform !== post.platform ||
      next.scheduledAt.getTime() !== post.scheduledAt.getTime();
    if (slotChanged) {
      assertInFuture(next.scheduledAt);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (slotChanged) {
        await this.lockSlot(tx, next.clientId, next.platform);
        await this.assertNoConflict(tx, { ...next, id });
      }

      // Only matches if nobody has saved since the client loaded the post.
      const { count } = await tx.post.updateMany({
        where: { id, version: dto.version },
        data: { ...next, version: { increment: 1 } },
      });
      if (count === 0) {
        const current = await tx.post.findUniqueOrThrow({
          where: { id },
          select: { version: true },
        });
        throw versionMismatchError(current.version);
      }

      return tx.post.findUniqueOrThrow({
        where: { id },
        include: postInclude,
      });
    });

    return this.withAllowedTransitions(updated, user);
  }

  // Moves a post to a new status. The checks run in a fixed order:
  //   1. can the user see the post at all?            → 404
  //   2. is from → to a valid workflow step?          → 400
  //   3. is this user allowed to make that step?      → 403
  //   4. is the client's copy of the post up to date? → 409
  //   5. rule for the step (comment / schedule slot)  → 400 / 409
  // Then the status change, audit log entry and optional comment are saved
  // in one transaction, so they either all happen or none do.
  async transition(id: number, dto: TransitionPostDto, user: AuthUser) {
    const post = await this.findOne(id, user);
    const from = post.status;
    const to = dto.toStatus;

    assertTransition(from, to);

    const isAssignedReviewer = await this.isAssignedReviewer(
      user,
      post.clientId,
    );
    assertCanTransition(user, post, to, isAssignedReviewer);

    if (dto.version !== post.version) {
      throw versionMismatchError(post.version);
    }

    if (to === PostStatus.CHANGES_REQUESTED) {
      assertChangeRequestComment(dto.comment);
    }
    if (to === PostStatus.SCHEDULED) {
      // The time was valid when the post was written, but it may have
      // passed while the post was waiting for review.
      assertInFuture(post.scheduledAt);
    }

    const comment = dto.comment?.trim();

    const updated = await this.prisma.$transaction(async (tx) => {
      if (to === PostStatus.SCHEDULED) {
        await this.lockSlot(tx, post.clientId, post.platform);
        await this.assertNoConflict(tx, post);
      }

      // `status: from` guards against the post having moved on since we
      // read it, on top of the version check.
      const { count } = await tx.post.updateMany({
        where: { id, version: dto.version, status: from },
        data: { status: to, version: { increment: 1 } },
      });
      if (count === 0) {
        const current = await tx.post.findUniqueOrThrow({
          where: { id },
          select: { version: true },
        });
        throw versionMismatchError(current.version);
      }

      await tx.auditLog.create({
        data: { postId: id, actorId: user.id, fromStatus: from, toStatus: to },
      });

      if (comment) {
        await tx.comment.create({
          data: { postId: id, authorId: user.id, message: comment },
        });
      }

      return tx.post.findUniqueOrThrow({
        where: { id },
        include: postInclude,
      });
    });

    return this.withAllowedTransitions(updated, user);
  }

  private async withAllowedTransitions<
    T extends { clientId: number; createdById: number; status: PostStatus },
  >(post: T, user: AuthUser) {
    const isAssignedReviewer = await this.isAssignedReviewer(
      user,
      post.clientId,
    );
    return {
      ...post,
      allowedTransitions: allowedTransitionsFor(user, post, isAssignedReviewer),
    };
  }

  private async isAssignedReviewer(user: AuthUser, clientId: number) {
    if (user.role !== Role.REVIEWER) {
      return false;
    }
    const count = await this.prisma.client.count({
      where: { id: clientId, reviewers: { some: { id: user.id } } },
    });
    return count > 0;
  }

  private async assertClientExists(clientId: number) {
    const client = await this.prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true },
    });
    if (!client) {
      throw new NotFoundException(`Client ${clientId} not found`);
    }
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
