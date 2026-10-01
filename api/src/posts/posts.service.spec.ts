import { ConflictException } from '@nestjs/common';
import { Platform, PostStatus, Role } from '@prisma/client';
import { AuthUser } from '../auth/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { PostsService } from './posts.service';

const creator: AuthUser = {
  id: 1,
  name: 'Asha',
  email: 'asha@test.com',
  role: Role.CREATOR,
};

function existingPost(version: number) {
  return {
    id: 10,
    clientId: 1,
    platform: Platform.INSTAGRAM,
    caption: 'Original caption',
    scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    status: PostStatus.DRAFT,
    createdById: creator.id,
    version,
  };
}

// A hand-rolled Prisma mock. $transaction just runs the callback with the
// same mock, which is enough to test the service's logic.
function createPrismaMock() {
  const mock = {
    post: {
      findFirst: jest.fn(),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    client: { findUnique: jest.fn() },
    $executeRaw: jest.fn(),
    $transaction: jest.fn(),
  };
  mock.$transaction.mockImplementation(
    (callback: (tx: typeof mock) => unknown) => callback(mock),
  );
  return mock;
}

async function getConflict(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (err) {
    return err as ConflictException;
  }
  throw new Error('Expected a ConflictException');
}

describe('PostsService.update (optimistic locking)', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: PostsService;

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new PostsService(prisma as unknown as PrismaService);
  });

  it('rejects a stale version with 409 before writing anything', async () => {
    prisma.post.findFirst.mockResolvedValue(existingPost(3));

    const error = await getConflict(
      service.update(10, { version: 2, caption: 'New caption' }, creator),
    );

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getResponse()).toMatchObject({
      code: 'VERSION_MISMATCH',
      currentVersion: 3,
    });
    expect(prisma.post.updateMany).not.toHaveBeenCalled();
  });

  it('returns 409 when someone else saves between our read and our write', async () => {
    // We read version 2, but by the time we write, another request has
    // already bumped it to 3, so the conditional update matches no rows.
    prisma.post.findFirst.mockResolvedValue(existingPost(2));
    prisma.post.updateMany.mockResolvedValue({ count: 0 });
    prisma.post.findUniqueOrThrow.mockResolvedValue({ version: 3 });

    const error = await getConflict(
      service.update(10, { version: 2, caption: 'New caption' }, creator),
    );

    expect(error.getResponse()).toMatchObject({
      code: 'VERSION_MISMATCH',
      currentVersion: 3,
    });
  });

  it('only updates the row if the version still matches, and bumps it', async () => {
    prisma.post.findFirst.mockResolvedValue(existingPost(2));
    prisma.post.updateMany.mockResolvedValue({ count: 1 });
    prisma.post.findUniqueOrThrow.mockResolvedValue({
      ...existingPost(3),
      caption: 'New caption',
    });

    const result = await service.update(
      10,
      { version: 2, caption: 'New caption' },
      creator,
    );

    expect(prisma.post.updateMany).toHaveBeenCalledWith({
      where: { id: 10, version: 2 },
      data: expect.objectContaining({
        caption: 'New caption',
        version: { increment: 1 },
      }) as unknown,
    });
    expect(result.version).toBe(3);
  });

  it('skips the conflict check when only the caption changes', async () => {
    prisma.post.findFirst.mockResolvedValue(existingPost(1));
    prisma.post.updateMany.mockResolvedValue({ count: 1 });
    prisma.post.findUniqueOrThrow.mockResolvedValue(existingPost(2));

    await service.update(10, { version: 1, caption: 'Tweaked' }, creator);

    expect(prisma.$executeRaw).not.toHaveBeenCalled();
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });
});
