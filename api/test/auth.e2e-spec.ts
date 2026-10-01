import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import {
  as,
  createTestApp,
  type Fixtures,
  login,
  PASSWORD,
  resetDb,
  seedFixtures,
} from './helpers';

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  let f: Fixtures;

  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(async () => {
    await resetDb(prisma);
    f = await seedFixtures(prisma);
  });
  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  const server = () => app.getHttpServer();

  it('logs in with the right password (email is case-insensitive)', async () => {
    const res = await request(server())
      .post('/api/auth/login')
      .send({ email: 'CREATOR@e2e.test', password: PASSWORD })
      .expect(200);
    expect(res.body).toMatchObject({
      accessToken: expect.any(String),
      user: { id: f.creator.id, role: 'CREATOR' },
    });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  it('gives the same 401 for a wrong password and an unknown email', async () => {
    const wrong = await request(server())
      .post('/api/auth/login')
      .send({ email: f.creator.email, password: 'wrong-password' })
      .expect(401);
    const unknown = await request(server())
      .post('/api/auth/login')
      .send({ email: 'nobody@e2e.test', password: PASSWORD })
      .expect(401);
    expect(wrong.body.message).toBe('Invalid email or password');
    expect(unknown.body.message).toBe(wrong.body.message);
  });

  it('rejects a malformed login body with 400', async () => {
    const res = await request(server())
      .post('/api/auth/login')
      .send({ email: 'not-an-email', password: '1', role: 'ADMIN' })
      .expect(400);
    expect(res.body.code).toBe('VALIDATION_FAILED');
  });

  it('exposes a public health check that also checks the database', async () => {
    const res = await request(server()).get('/api/health').expect(200);
    expect(res.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('requires a token on protected routes', async () => {
    await request(server()).get('/api/posts').expect(401);
    await request(server())
      .get('/api/posts')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('stops accepting the token of a user who was deleted', async () => {
    const token = await login(app, f.creator2.email);
    await as(app, token).get('/api/auth/me').expect(200);

    await prisma.user.delete({ where: { id: f.creator2.id } });

    await as(app, token).get('/api/auth/me').expect(401);
  });

  it('uses the current role from the database, not the one in the token', async () => {
    const token = await login(app, f.creator2.email);
    await prisma.user.update({
      where: { id: f.creator2.id },
      data: { role: 'REVIEWER' },
    });

    const me = await as(app, token).get('/api/auth/me').expect(200);
    expect(me.body.role).toBe('REVIEWER');
    // A reviewer can't create posts any more, even with the old token.
    await as(app, token)
      .post('/api/posts')
      .send({
        clientId: f.clientA.id,
        platform: 'X',
        caption: 'x',
        scheduledAt: new Date(Date.now() + 86400e3).toISOString(),
      })
      .expect(403);
  });
});
