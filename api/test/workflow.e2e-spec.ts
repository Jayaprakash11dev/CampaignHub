import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PublishScheduledPostsJob } from '../src/scheduler/publish-scheduled-posts.job';
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

describe('Post workflow (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let f: Fixtures;
  let creator: string;
  let reviewer: string;
  let admin: string;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    f = await seedFixtures(prisma);
    creator = await login(app, f.creator.email);
    reviewer = await login(app, f.reviewer.email);
    admin = await login(app, f.admin.email);
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const auditOf = (postId: number) =>
    prisma.auditLog.findMany({ where: { postId }, orderBy: { id: 'asc' } });

  it('runs the full lifecycle and records every step', async () => {
    const post = await createPost(app, creator, { clientId: f.clientA.id });
    expect(post).toMatchObject({ status: 'DRAFT', version: 1 });

    const final = await moveTo(app, post, [
      { token: creator, toStatus: 'IN_REVIEW' },
      {
        token: reviewer,
        toStatus: 'CHANGES_REQUESTED',
        comment: '  Please add the price.  ',
      },
    ]);
    const edited = await as(app, creator)
      .patch(`/api/posts/${post.id}`)
      .send({ version: final.version, caption: 'Now with the price: Rs 299' })
      .expect(200);
    const scheduled = await moveTo(app, edited.body, [
      { token: creator, toStatus: 'IN_REVIEW' },
      { token: reviewer, toStatus: 'APPROVED' },
      { token: creator, toStatus: 'SCHEDULED' },
    ]);

    const db = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(db).toMatchObject({
      status: 'SCHEDULED',
      caption: 'Now with the price: Rs 299',
      version: scheduled.version,
    });

    const audit = await auditOf(post.id);
    expect(audit.map((a) => [a.fromStatus, a.toStatus, a.actorId])).toEqual([
      [null, 'DRAFT', f.creator.id],
      ['DRAFT', 'IN_REVIEW', f.creator.id],
      ['IN_REVIEW', 'CHANGES_REQUESTED', f.reviewer.id],
      ['CHANGES_REQUESTED', 'IN_REVIEW', f.creator.id],
      ['IN_REVIEW', 'APPROVED', f.reviewer.id],
      ['APPROVED', 'SCHEDULED', f.creator.id],
    ]);

    // The change-request comment was saved (trimmed) in the thread.
    const comments = await prisma.comment.findMany({
      where: { postId: post.id },
    });
    expect(comments).toHaveLength(1);
    expect(comments[0]).toMatchObject({
      authorId: f.reviewer.id,
      message: 'Please add the price.',
    });
  });

  it('rejects transitions outside the workflow with 400 and changes nothing', async () => {
    const post = await createPost(app, creator, { clientId: f.clientA.id });
    const res = await as(app, reviewer)
      .post(`/api/posts/${post.id}/transitions`)
      .send({ toStatus: 'APPROVED', version: 1 })
      .expect(400);
    expect(res.body).toMatchObject({ code: 'INVALID_TRANSITION' });
    expect(res.body.message).toContain(
      'Cannot move a post from DRAFT to APPROVED',
    );

    const db = await prisma.post.findUniqueOrThrow({ where: { id: post.id } });
    expect(db).toMatchObject({ status: 'DRAFT', version: 1 });
    expect(await auditOf(post.id)).toHaveLength(1);
  });

  it('requires a change-request comment of at least 10 characters (after trimming)', async () => {
    const post = await createPost(app, creator, { clientId: f.clientA.id });
    const inReview = await moveTo(app, post, [
      { token: creator, toStatus: 'IN_REVIEW' },
    ]);
    for (const comment of [undefined, '', 'Too short', '   short          ']) {
      const res = await as(app, reviewer)
        .post(`/api/posts/${post.id}/transitions`)
        .send({
          toStatus: 'CHANGES_REQUESTED',
          version: inReview.version,
          comment,
        })
        .expect(400);
      expect(res.body.code).toBe('COMMENT_REQUIRED');
    }
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).status,
    ).toBe('IN_REVIEW');
    expect(await prisma.comment.count()).toBe(0);
  });

  it('cannot approve a post whose scheduled time has already passed', async () => {
    // Time passes while the post waits for review.
    const post = await createPost(app, creator, { clientId: f.clientA.id });
    const inReview = await moveTo(app, post, [
      { token: creator, toStatus: 'IN_REVIEW' },
    ]);
    await prisma.post.update({
      where: { id: post.id },
      data: { scheduledAt: new Date(Date.now() - 60 * 60 * 1000) },
    });

    const res = await as(app, reviewer)
      .post(`/api/posts/${post.id}/transitions`)
      .send({ toStatus: 'APPROVED', version: inReview.version })
      .expect(400);
    expect(res.body.code).toBe('SCHEDULED_IN_PAST');

    // The way out: the reviewer sends it back, the creator picks a new time.
    await as(app, reviewer)
      .post(`/api/posts/${post.id}/transitions`)
      .send({
        toStatus: 'CHANGES_REQUESTED',
        version: inReview.version,
        comment: 'The date has passed, please pick a new one.',
      })
      .expect(200);
  });

  it('cannot submit a post for review once its time has passed', async () => {
    const post = await createPost(app, creator, { clientId: f.clientA.id });
    await prisma.post.update({
      where: { id: post.id },
      data: { scheduledAt: new Date(Date.now() - 60 * 60 * 1000) },
    });
    const res = await as(app, creator)
      .post(`/api/posts/${post.id}/transitions`)
      .send({ toStatus: 'IN_REVIEW', version: 1 })
      .expect(400);
    expect(res.body.code).toBe('SCHEDULED_IN_PAST');
  });

  it('publishes due posts from the background job and records it as the system', async () => {
    const post = await createPost(app, creator, { clientId: f.clientA.id });
    await moveTo(app, post, [
      { token: creator, toStatus: 'IN_REVIEW' },
      { token: reviewer, toStatus: 'APPROVED' },
      { token: admin, toStatus: 'SCHEDULED' },
    ]);
    await prisma.post.update({
      where: { id: post.id },
      data: { scheduledAt: new Date(Date.now() - 1000) },
    });

    const published = await app
      .get(PublishScheduledPostsJob)
      .publishDuePosts(new Date());

    expect(published).toBe(1);
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).status,
    ).toBe('PUBLISHED');
    const last = (await auditOf(post.id)).at(-1);
    expect(last).toMatchObject({
      fromStatus: 'SCHEDULED',
      toStatus: 'PUBLISHED',
      actorId: null,
    });

    // Running it again does nothing.
    expect(
      await app.get(PublishScheduledPostsJob).publishDuePosts(new Date()),
    ).toBe(0);
    expect(await auditOf(post.id)).toHaveLength(5);
  });

  it('does not let deleting a user rewrite the audit history', async () => {
    const post = await createPost(app, creator, { clientId: f.clientA.id });
    await moveTo(app, post, [
      { token: creator, toStatus: 'IN_REVIEW' },
      { token: reviewer, toStatus: 'APPROVED' },
    ]);
    // The reviewer approved without commenting, so only the audit log
    // references them.
    const res = await as(app, admin)
      .delete(`/api/users/${f.reviewer.id}`)
      .expect(409);
    expect(res.body.message).toContain('cannot be deleted');

    const approval = (await auditOf(post.id)).find(
      (a) => a.toStatus === 'APPROVED',
    );
    expect(approval?.actorId).toBe(f.reviewer.id);
  });

  it('keeps comments out of the version (they are not edits)', async () => {
    const post = await createPost(app, creator, { clientId: f.clientA.id });
    await as(app, reviewer)
      .post(`/api/posts/${post.id}/comments`)
      .send({ message: 'Nice one' })
      .expect(201);
    expect(
      (await prisma.post.findUniqueOrThrow({ where: { id: post.id } })).version,
    ).toBe(1);
  });
});
