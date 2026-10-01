import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  as,
  createPost,
  createTestApp,
  type Fixtures,
  hoursFromNow,
  login,
  resetDb,
  seedFixtures,
} from './helpers';

describe('Validation (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let f: Fixtures;
  let creator: string;
  let admin: string;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    f = await seedFixtures(prisma);
    creator = await login(app, f.creator.email);
    admin = await login(app, f.admin.email);
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const newPost = (overrides: Record<string, unknown>) =>
    as(app, creator)
      .post('/api/posts')
      .send({
        clientId: f.clientA.id,
        platform: 'X',
        caption: 'Valid caption',
        scheduledAt: hoursFromNow(24),
        ...overrides,
      });

  describe('posts', () => {
    it('rejects a caption that is only whitespace', async () => {
      const res = await newPost({ caption: '   \n\t  ' }).expect(400);
      expect(res.body.code).toBe('VALIDATION_FAILED');
      expect(await prisma.post.count()).toBe(0);
    });

    it('rejects a whitespace-only caption on edit too', async () => {
      const post = await createPost(app, creator, { clientId: f.clientA.id });
      await as(app, creator)
        .patch(`/api/posts/${post.id}`)
        .send({ version: 1, caption: '    ' })
        .expect(400);
      expect(
        (await prisma.post.findUniqueOrThrow({ where: { id: post.id } }))
          .caption,
      ).toBe('Hello from the e2e tests');
    });

    it.each([
      ['X', 280],
      ['INSTAGRAM', 2200],
      ['LINKEDIN', 3000],
      ['FACEBOOK', 5000],
    ])(
      '%s: %i characters is fine, one more is a 400',
      async (platform, limit) => {
        await newPost({
          platform,
          caption: 'a'.repeat(limit),
          scheduledAt: hoursFromNow(10),
        }).expect(201);
        const res = await newPost({
          platform,
          caption: 'a'.repeat(limit + 1),
          scheduledAt: hoursFromNow(20),
        }).expect(400);
        expect(res.body.code).toMatch(/CAPTION_TOO_LONG|VALIDATION_FAILED/);
      },
    );

    it('keeps special characters and HTML exactly as typed', async () => {
      const caption = `<script>alert("x")</script> & "quotes" 'single' — émojis 🎉 नमस्ते`;
      const res = await newPost({ platform: 'INSTAGRAM', caption }).expect(201);
      const db = await prisma.post.findUniqueOrThrow({
        where: { id: res.body.id },
      });
      expect(db.caption).toBe(caption);
    });

    it.each([
      [
        'a past time',
        { scheduledAt: '2020-01-01T10:00:00.000Z' },
        'SCHEDULED_IN_PAST',
      ],
      [
        'a time without timezone',
        { scheduledAt: '2030-01-01T10:00:00' },
        'VALIDATION_FAILED',
      ],
      [
        'an invalid date',
        { scheduledAt: '2030-13-45T99:00:00Z' },
        'VALIDATION_FAILED',
      ],
      ['an unknown platform', { platform: 'TIKTOK' }, 'VALIDATION_FAILED'],
      ['clientId as text', { clientId: 'one' }, 'VALIDATION_FAILED'],
      ['a status field', { status: 'APPROVED' }, 'VALIDATION_FAILED'],
      ['a missing caption', { caption: undefined }, 'VALIDATION_FAILED'],
    ])('rejects %s', async (_desc, overrides, code) => {
      const res = await newPost(overrides).expect(400);
      expect(res.body.code).toBe(code);
      expect(await prisma.post.count()).toBe(0);
    });

    it('returns 404 for a client that does not exist', async () => {
      await newPost({ clientId: 999999 }).expect(404);
    });

    it('returns 400 for a non-numeric id and 404 for a missing one', async () => {
      await as(app, creator).get('/api/posts/abc').expect(400);
      await as(app, creator).get('/api/posts/999999').expect(404);
      await as(app, creator)
        .post('/api/posts/999999/transitions')
        .send({ toStatus: 'IN_REVIEW', version: 1 })
        .expect(404);
    });

    it('requires a version on every update', async () => {
      const post = await createPost(app, creator, { clientId: f.clientA.id });
      await as(app, creator)
        .patch(`/api/posts/${post.id}`)
        .send({ caption: 'No version' })
        .expect(400);
      await as(app, creator)
        .post(`/api/posts/${post.id}/transitions`)
        .send({ toStatus: 'IN_REVIEW' })
        .expect(400);
      expect(
        (await prisma.post.findUniqueOrThrow({ where: { id: post.id } }))
          .version,
      ).toBe(1);
    });

    it('rejects a comment that is empty or only spaces', async () => {
      const post = await createPost(app, creator, { clientId: f.clientA.id });
      await as(app, creator)
        .post(`/api/posts/${post.id}/comments`)
        .send({ message: '' })
        .expect(400);
      await as(app, creator)
        .post(`/api/posts/${post.id}/comments`)
        .send({ message: '     ' })
        .expect(400);
      await as(app, creator)
        .post(`/api/posts/${post.id}/comments`)
        .send({ message: 'x'.repeat(2001) })
        .expect(400);
      expect(await prisma.comment.count()).toBe(0);
    });
  });

  describe('clients', () => {
    it('rejects a client name that is only whitespace', async () => {
      await as(app, admin)
        .post('/api/clients')
        .send({ name: '    ' })
        .expect(400);
      await as(app, admin)
        .patch(`/api/clients/${f.clientA.id}`)
        .send({ name: '   ' })
        .expect(400);
      expect(await prisma.client.count({ where: { name: '' } })).toBe(0);
    });

    it('treats client names that differ only by case as duplicates', async () => {
      const res = await as(app, admin)
        .post('/api/clients')
        .send({ name: 'client a' })
        .expect(409);
      expect(res.body.message).toBe('Client name already exists');
      await as(app, admin)
        .patch(`/api/clients/${f.clientB.id}`)
        .send({ name: 'CLIENT A' })
        .expect(409);
      expect(await prisma.client.count()).toBe(2);
    });

    it('stores names trimmed', async () => {
      const res = await as(app, admin)
        .post('/api/clients')
        .send({ name: '  Sunrise Bakery  ' })
        .expect(201);
      expect(res.body.name).toBe('Sunrise Bakery');
    });

    it('validates reviewer assignment', async () => {
      await as(app, admin)
        .put(`/api/clients/${f.clientA.id}/reviewers`)
        .send({ reviewerIds: [f.creator.id] })
        .expect(400);
      await as(app, admin)
        .put(`/api/clients/${f.clientA.id}/reviewers`)
        .send({ reviewerIds: [999999] })
        .expect(400);
      await as(app, admin)
        .put(`/api/clients/${f.clientA.id}/reviewers`)
        .send({ reviewerIds: [f.reviewer.id, f.reviewer.id] })
        .expect(400);
      await as(app, admin)
        .put(`/api/clients/999999/reviewers`)
        .send({ reviewerIds: [] })
        .expect(404);
      // An empty list is allowed and removes everyone.
      await as(app, admin)
        .put(`/api/clients/${f.clientA.id}/reviewers`)
        .send({ reviewerIds: [] })
        .expect(200);
      const client = await prisma.client.findUniqueOrThrow({
        where: { id: f.clientA.id },
        include: { reviewers: true },
      });
      expect(client.reviewers).toHaveLength(0);
    });

    it('refuses to delete a client that has posts', async () => {
      await createPost(app, creator, { clientId: f.clientA.id });
      await as(app, admin).delete(`/api/clients/${f.clientA.id}`).expect(409);
      expect(await prisma.client.count({ where: { id: f.clientA.id } })).toBe(
        1,
      );
    });
  });

  describe('users', () => {
    const newUser = (overrides: Record<string, unknown>) =>
      as(app, admin)
        .post('/api/users')
        .send({
          name: 'Kiran Rao',
          email: 'kiran@e2e.test',
          password: 'Password@123',
          role: 'CREATOR',
          ...overrides,
        });

    it('rejects a name that is only whitespace', async () => {
      await newUser({ name: '   ' }).expect(400);
      expect(await prisma.user.count({ where: { name: '' } })).toBe(0);
    });

    it('rejects very long names and passwords longer than bcrypt can use', async () => {
      await newUser({ name: 'n'.repeat(101) }).expect(400);
      await newUser({ password: 'p'.repeat(73) }).expect(400);
    });

    it('treats emails case-insensitively', async () => {
      await newUser({}).expect(201);
      await newUser({ email: 'KIRAN@E2E.TEST' }).expect(409);
      expect(
        await prisma.user.count({ where: { email: 'kiran@e2e.test' } }),
      ).toBe(1);
    });

    it('does not let an admin change their own role or delete themselves', async () => {
      await as(app, admin)
        .patch(`/api/users/${f.admin.id}`)
        .send({ role: 'CREATOR' })
        .expect(400);
      await as(app, admin).delete(`/api/users/${f.admin.id}`).expect(400);
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: f.admin.id } }))
          .role,
      ).toBe('ADMIN');
    });

    it('removes client assignments when someone stops being a reviewer', async () => {
      await as(app, admin)
        .patch(`/api/users/${f.reviewer.id}`)
        .send({ role: 'CREATOR' })
        .expect(200);
      const client = await prisma.client.findUniqueOrThrow({
        where: { id: f.clientA.id },
        include: { reviewers: true },
      });
      expect(client.reviewers).toHaveLength(0);
    });
  });
});
