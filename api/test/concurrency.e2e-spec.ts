import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  as,
  createPost,
  createTestApp,
  type Fixtures,
  hoursFromNow,
  login,
  moveTo,
  resetDb,
  seedFixtures,
} from './helpers';

// Two people (or a double click) doing the same thing at the same moment.
describe('Concurrency (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let f: Fixtures;
  let creator: string;
  let reviewer: string;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    f = await seedFixtures(prisma);
    creator = await login(app, f.creator.email);
    reviewer = await login(app, f.reviewer.email);
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('never double-books a slot when two creates race', async () => {
    const body = {
      clientId: f.clientA.id,
      platform: 'X',
      caption: 'Race',
      scheduledAt: hoursFromNow(30),
    };
    for (let round = 0; round < 3; round++) {
      await prisma.auditLog.deleteMany();
      await prisma.post.deleteMany();
      const [a, b] = await Promise.all([
        as(app, creator).post('/api/posts').send(body),
        as(app, creator).post('/api/posts').send(body),
      ]);
      expect([a.status, b.status].sort()).toEqual([201, 409]);
      expect(await prisma.post.count()).toBe(1);
    }
  });

  it('lets only one of two simultaneous edits win (optimistic locking)', async () => {
    const post = await createPost(app, creator, { clientId: f.clientA.id });
    const [a, b] = await Promise.all([
      as(app, creator)
        .patch(`/api/posts/${post.id}`)
        .send({ version: 1, caption: 'Edit A' }),
      as(app, creator)
        .patch(`/api/posts/${post.id}`)
        .send({ version: 1, caption: 'Edit B' }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    const winner = a.status === 200 ? a : b;
    expect(loser.body).toMatchObject({
      code: 'VERSION_MISMATCH',
      currentVersion: 2,
    });

    const db = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(db).toMatchObject({ version: 2, caption: winner.body.caption });
  });

  it('applies a double-clicked transition once, with one audit entry', async () => {
    const post = await createPost(app, creator, { clientId: f.clientA.id });
    const inReview = await moveTo(app, post, [
      { token: creator, toStatus: 'IN_REVIEW' },
    ]);
    const send = () =>
      as(app, reviewer)
        .post(`/api/posts/${post.id}/transitions`)
        .send({ toStatus: 'APPROVED', version: inReview.version });

    const results = await Promise.all([send(), send(), send()]);
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    for (const r of results.filter((r) => r.status !== 200)) {
      expect([400, 409]).toContain(r.status);
    }
    const approvals = await prisma.auditLog.count({
      where: { postId: post.id, toStatus: 'APPROVED' },
    });
    expect(approvals).toBe(1);
  });

  it('rejects a stale page acting on a post that has already moved on', async () => {
    const post = await createPost(app, creator, { clientId: f.clientA.id });
    const inReview = await moveTo(app, post, [
      { token: creator, toStatus: 'IN_REVIEW' },
    ]);
    await moveTo(app, inReview, [{ token: reviewer, toStatus: 'APPROVED' }]);

    // Same version the stale page still has.
    const res = await as(app, reviewer)
      .post(`/api/posts/${post.id}/transitions`)
      .send({
        toStatus: 'CHANGES_REQUESTED',
        version: inReview.version,
        comment: 'Changed my mind about it',
      })
      .expect(400);
    expect(res.body.code).toBe('INVALID_TRANSITION');
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).status,
    ).toBe('APPROVED');
  });
});
