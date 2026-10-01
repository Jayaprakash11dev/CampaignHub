import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, Role, type Platform, type Post } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';

export const PASSWORD = 'Password@123';
const HOUR = 60 * 60 * 1000;

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();
  return app;
}

// Deletes everything, children first because of foreign keys.
export async function resetDb(prisma: PrismaClient) {
  await prisma.auditLog.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.post.deleteMany();
  await prisma.client.deleteMany();
  await prisma.user.deleteMany();
}

export interface Fixtures {
  admin: { id: number; email: string };
  creator: { id: number; email: string };
  creator2: { id: number; email: string };
  // reviewer is assigned to clientA, reviewer2 to clientB
  reviewer: { id: number; email: string };
  reviewer2: { id: number; email: string };
  clientA: { id: number };
  clientB: { id: number };
}

export async function seedFixtures(prisma: PrismaClient): Promise<Fixtures> {
  const passwordHash = await bcrypt.hash(PASSWORD, 4);
  const user = (name: string, role: Role) =>
    prisma.user.create({
      data: { name, email: `${name}@e2e.test`, role, passwordHash },
      select: { id: true, email: true },
    });

  const admin = await user('admin', Role.ADMIN);
  const creator = await user('creator', Role.CREATOR);
  const creator2 = await user('creator2', Role.CREATOR);
  const reviewer = await user('reviewer', Role.REVIEWER);
  const reviewer2 = await user('reviewer2', Role.REVIEWER);

  const clientA = await prisma.client.create({
    data: { name: 'Client A', reviewers: { connect: [{ id: reviewer.id }] } },
    select: { id: true },
  });
  const clientB = await prisma.client.create({
    data: { name: 'Client B', reviewers: { connect: [{ id: reviewer2.id }] } },
    select: { id: true },
  });

  return { admin, creator, creator2, reviewer, reviewer2, clientA, clientB };
}

export async function login(app: INestApplication, email: string) {
  const res = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return (res.body as { accessToken: string }).accessToken;
}

// supertest with the token already attached
export function as(app: INestApplication, token: string) {
  const server = app.getHttpServer();
  const auth = { Authorization: `Bearer ${token}` };
  return {
    get: (url: string) => request(server).get(url).set(auth),
    post: (url: string) => request(server).post(url).set(auth),
    patch: (url: string) => request(server).patch(url).set(auth),
    put: (url: string) => request(server).put(url).set(auth),
    delete: (url: string) => request(server).delete(url).set(auth),
  };
}

export function hoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * HOUR).toISOString();
}

export async function createPost(
  app: INestApplication,
  token: string,
  body: {
    clientId: number;
    platform?: Platform;
    caption?: string;
    scheduledAt?: string;
  },
): Promise<Post> {
  const res = await as(app, token)
    .post('/api/posts')
    .send({
      platform: 'INSTAGRAM',
      caption: 'Hello from the e2e tests',
      scheduledAt: hoursFromNow(48),
      ...body,
    })
    .expect(201);
  return res.body as Post;
}

// Moves a post along the workflow as the right users, returning the post.
export async function moveTo(
  app: INestApplication,
  post: Post,
  steps: { token: string; toStatus: string; comment?: string }[],
): Promise<Post> {
  let current = post;
  for (const step of steps) {
    const res = await as(app, step.token)
      .post(`/api/posts/${current.id}/transitions`)
      .send({
        toStatus: step.toStatus,
        version: current.version,
        comment: step.comment,
      })
      .expect(200);
    current = res.body as Post;
  }
  return current;
}
