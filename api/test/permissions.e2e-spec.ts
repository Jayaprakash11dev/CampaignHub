import { INestApplication } from '@nestjs/common';
import { PrismaClient, type Post } from '@prisma/client';
import {
  as,
  createPost,
  createTestApp,
  type Fixtures,
  login,
  moveTo,
  resetDb,
  seedFixtures,
} from './helpers';

// Calls the API directly as each role: hiding a button in the UI is not
// enough, the server must refuse too.
describe('Permissions (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let f: Fixtures;
  let t: Record<
    'admin' | 'creator' | 'creator2' | 'reviewer' | 'reviewer2',
    string
  >;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    f = await seedFixtures(prisma);
    t = {
      admin: await login(app, f.admin.email),
      creator: await login(app, f.creator.email),
      creator2: await login(app, f.creator2.email),
      reviewer: await login(app, f.reviewer.email),
      reviewer2: await login(app, f.reviewer2.email),
    };
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('admin-only endpoints', () => {
    it.each(['creator', 'reviewer'] as const)(
      '%s gets 403 on user and client management',
      async (role) => {
        const api = as(app, t[role]);
        await api.get('/api/users').expect(403);
        await api
          .post('/api/users')
          .send({
            name: 'X',
            email: 'x@e2e.test',
            password: 'Password@123',
            role: 'ADMIN',
          })
          .expect(403);
        await api
          .patch(`/api/users/${f.creator.id}`)
          .send({ role: 'ADMIN' })
          .expect(403);
        await api.delete(`/api/users/${f.creator2.id}`).expect(403);
        await api.post('/api/clients').send({ name: 'Sneaky' }).expect(403);
        await api
          .patch(`/api/clients/${f.clientA.id}`)
          .send({ name: 'Renamed' })
          .expect(403);
        await api.delete(`/api/clients/${f.clientA.id}`).expect(403);
        await api
          .put(`/api/clients/${f.clientA.id}/reviewers`)
          .send({ reviewerIds: [] })
          .expect(403);

        // nothing changed
        expect(await prisma.user.count()).toBe(5);
        const clientA = await prisma.client.findUniqueOrThrow({
          where: { id: f.clientA.id },
          include: { reviewers: true },
        });
        expect(clientA.name).toBe('Client A');
        expect(clientA.reviewers.map((r) => r.id)).toEqual([f.reviewer.id]);
      },
    );

    it('a creator cannot promote themselves', async () => {
      await as(app, t.creator)
        .patch(`/api/users/${f.creator.id}`)
        .send({ role: 'ADMIN' })
        .expect(403);
      const me = await prisma.user.findUniqueOrThrow({
        where: { id: f.creator.id },
      });
      expect(me.role).toBe('CREATOR');
    });
  });

  describe('posts', () => {
    let post: Post;
    beforeEach(async () => {
      post = await createPost(app, t.creator, { clientId: f.clientA.id });
    });

    it.each(['admin', 'reviewer'] as const)(
      '%s cannot create posts',
      async (role) => {
        await as(app, t[role])
          .post('/api/posts')
          .send({
            clientId: f.clientA.id,
            platform: 'X',
            caption: 'x',
            scheduledAt: new Date(Date.now() + 86400e3).toISOString(),
          })
          .expect(403);
      },
    );

    it('only the author can edit', async () => {
      await as(app, t.creator2)
        .patch(`/api/posts/${post.id}`)
        .send({ version: 1, caption: 'Hijack' })
        .expect(403);
      await as(app, t.admin)
        .patch(`/api/posts/${post.id}`)
        .send({ version: 1, caption: 'Hijack' })
        .expect(403);
      await as(app, t.reviewer)
        .patch(`/api/posts/${post.id}`)
        .send({ version: 1, caption: 'Hijack' })
        .expect(403);
      const db = await prisma.post.findUniqueOrThrow({
        where: { id: post.id },
      });
      expect(db.caption).toBe('Hello from the e2e tests');
      expect(db.version).toBe(1);
    });

    it('only the author can submit for review', async () => {
      for (const role of ['creator2', 'admin', 'reviewer'] as const) {
        await as(app, t[role])
          .post(`/api/posts/${post.id}/transitions`)
          .send({ toStatus: 'IN_REVIEW', version: 1 })
          .expect(403);
      }
    });

    it('a reviewer of another client cannot see or touch the post (404, not 403)', async () => {
      const inReview = await moveTo(app, post, [
        { token: t.creator, toStatus: 'IN_REVIEW' },
      ]);
      const other = as(app, t.reviewer2);
      await other.get(`/api/posts/${post.id}`).expect(404);
      await other.get(`/api/posts/${post.id}/comments`).expect(404);
      await other
        .post(`/api/posts/${post.id}/comments`)
        .send({ message: 'hi' })
        .expect(404);
      await other.get(`/api/posts/${post.id}/audit`).expect(404);
      await other
        .post(`/api/posts/${post.id}/transitions`)
        .send({ toStatus: 'APPROVED', version: inReview.version })
        .expect(404);
      const list = await other.get('/api/posts').expect(200);
      expect(list.body).toHaveLength(0);
      expect(
        (await prisma.post.findUniqueOrThrow({ where: { id: post.id } }))
          .status,
      ).toBe('IN_REVIEW');
    });

    it('only an assigned reviewer can approve or request changes', async () => {
      const inReview = await moveTo(app, post, [
        { token: t.creator, toStatus: 'IN_REVIEW' },
      ]);
      for (const role of ['creator', 'creator2', 'admin'] as const) {
        await as(app, t[role])
          .post(`/api/posts/${post.id}/transitions`)
          .send({ toStatus: 'APPROVED', version: inReview.version })
          .expect(403);
        await as(app, t[role])
          .post(`/api/posts/${post.id}/transitions`)
          .send({
            toStatus: 'CHANGES_REQUESTED',
            version: inReview.version,
            comment: 'Please change this part',
          })
          .expect(403);
      }
      await as(app, t.reviewer)
        .post(`/api/posts/${post.id}/transitions`)
        .send({ toStatus: 'APPROVED', version: inReview.version })
        .expect(200);
    });

    it('nobody can approve their own post, even after becoming a reviewer for that client', async () => {
      const inReview = await moveTo(app, post, [
        { token: t.creator, toStatus: 'IN_REVIEW' },
      ]);
      await prisma.user.update({
        where: { id: f.creator.id },
        data: { role: 'REVIEWER' },
      });
      await prisma.client.update({
        where: { id: f.clientA.id },
        data: { reviewers: { connect: { id: f.creator.id } } },
      });

      const res = await as(app, t.creator)
        .post(`/api/posts/${post.id}/transitions`)
        .send({ toStatus: 'APPROVED', version: inReview.version })
        .expect(403);
      expect(res.body.message).toBe(
        'You cannot approve or review your own post',
      );
      expect(
        (await prisma.post.findUniqueOrThrow({ where: { id: post.id } }))
          .status,
      ).toBe('IN_REVIEW');
    });

    it('scheduling is for the author or an admin, and nobody can publish by hand', async () => {
      const approved = await moveTo(app, post, [
        { token: t.creator, toStatus: 'IN_REVIEW' },
        { token: t.reviewer, toStatus: 'APPROVED' },
      ]);
      await as(app, t.reviewer)
        .post(`/api/posts/${post.id}/transitions`)
        .send({ toStatus: 'SCHEDULED', version: approved.version })
        .expect(403);
      await as(app, t.creator2)
        .post(`/api/posts/${post.id}/transitions`)
        .send({ toStatus: 'SCHEDULED', version: approved.version })
        .expect(403);
      const scheduled = await moveTo(app, approved, [
        { token: t.admin, toStatus: 'SCHEDULED' },
      ]);
      expect(scheduled.status).toBe('SCHEDULED');

      for (const role of ['admin', 'creator', 'reviewer'] as const) {
        await as(app, t[role])
          .post(`/api/posts/${post.id}/transitions`)
          .send({ toStatus: 'PUBLISHED', version: scheduled.version })
          .expect(403);
      }
      expect(
        (await prisma.post.findUniqueOrThrow({ where: { id: post.id } }))
          .status,
      ).toBe('SCHEDULED');
    });

    it('reviewers only list clients assigned to them', async () => {
      const res = await as(app, t.reviewer2).get('/api/clients').expect(200);
      expect(res.body.map((c: { id: number }) => c.id)).toEqual([f.clientB.id]);
      await as(app, t.reviewer2)
        .get(`/api/clients/${f.clientA.id}`)
        .expect(404);
    });
  });
});
