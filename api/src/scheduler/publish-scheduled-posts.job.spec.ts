import { PostStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PublishScheduledPostsJob } from './publish-scheduled-posts.job';

function createPrismaMock() {
  const mock = {
    post: { findMany: jest.fn(), updateMany: jest.fn() },
    auditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation(
    (callback: (tx: typeof mock) => unknown) => callback(mock),
  );
  return mock;
}

describe('PublishScheduledPostsJob', () => {
  const now = new Date('2026-10-10T10:00:00.000Z');
  let prisma: ReturnType<typeof createPrismaMock>;
  let job: PublishScheduledPostsJob;

  beforeEach(() => {
    prisma = createPrismaMock();
    job = new PublishScheduledPostsJob(prisma as unknown as PrismaService);
  });

  it('only looks for SCHEDULED posts whose time has passed', async () => {
    prisma.post.findMany.mockResolvedValue([]);

    await job.publishDuePosts(now);

    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: PostStatus.SCHEDULED, scheduledAt: { lte: now } },
      }),
    );
  });

  it('does nothing when no posts are due', async () => {
    prisma.post.findMany.mockResolvedValue([]);

    expect(await job.publishDuePosts(now)).toBe(0);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('publishes each due post and records a system audit entry', async () => {
    prisma.post.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    prisma.post.updateMany.mockResolvedValue({ count: 1 });

    expect(await job.publishDuePosts(now)).toBe(2);

    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { id: 1, status: PostStatus.SCHEDULED },
      data: { status: PostStatus.PUBLISHED, version: { increment: 1 } },
    });
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(2);
    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        postId: 2,
        actorId: null,
        fromStatus: PostStatus.SCHEDULED,
        toStatus: PostStatus.PUBLISHED,
      },
    });
  });

  it('skips a post that another run already published', async () => {
    prisma.post.findMany.mockResolvedValue([{ id: 1 }]);
    prisma.post.updateMany.mockResolvedValue({ count: 0 });

    expect(await job.publishDuePosts(now)).toBe(0);
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('keeps going when one post fails', async () => {
    prisma.post.findMany.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    prisma.post.updateMany
      .mockRejectedValueOnce(new Error('db hiccup'))
      .mockResolvedValueOnce({ count: 1 });
    // Silence the expected error log in test output.
    jest.spyOn(job['logger'], 'error').mockImplementation(() => undefined);

    expect(await job.publishDuePosts(now)).toBe(1);
    expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
