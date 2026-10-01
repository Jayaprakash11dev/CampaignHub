# CampaignHub

A social media content approval system for an agency that manages posts for several client brands. Creators write posts, reviewers assigned to each client approve them or ask for changes, and approved posts are scheduled and then published automatically.

**Stack:** NestJS 11 · Prisma 6 · PostgreSQL 16 · React 19 + Vite · TanStack Query · Tailwind CSS · JWT + bcrypt · Jest · Docker Compose

- `api/` – REST API (NestJS + Prisma)
- `web/` – single-page app (React + Vite)
- `docker-compose.yml` – Postgres, API and web app

Design decisions and trade-offs are in [DECISIONS.md](DECISIONS.md).

---

## Quick start (Docker)

Requires Docker.

```bash
docker compose up --build
```

| What | URL |
|---|---|
| Web app | http://localhost:8088 |
| API docs (Swagger) | http://localhost:3000/api/docs |

On start the API container applies the database migrations and, **only if the database is empty**, loads the demo data (see [Seeded accounts](#seeded-accounts)). Set `JWT_SECRET` in your shell or a root `.env` file to override the default secret.

> Host ports: Postgres is exposed on **5434** and the web app on **8088** so they don't clash with a local Postgres (5432) or another web server (8080).

---

## Local development

Requires Node.js 22 and Docker (for Postgres).

```bash
# 1. Database
docker compose up -d db

# 2. API  ->  http://localhost:3000/api   (Swagger: /api/docs)
cd api
cp .env.example .env
npm install
npx prisma migrate deploy
npm run seed            # demo data (wipes and recreates it)
npm run start:dev

# 3. Web  ->  http://localhost:5173
cd web
cp .env.example .env
npm install
npm run dev
```

### Environment variables

**api/.env**

| Variable | Example | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://campaignhub:campaignhub@localhost:5434/campaignhub?schema=public` | Postgres connection |
| `JWT_SECRET` | any long random string | Signs the access tokens |
| `JWT_EXPIRES_IN` | `1d` | Token lifetime |
| `PORT` | `3000` | API port |

**web/.env**

| Variable | Example | Purpose |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000/api` | API base URL (the Docker build uses `/api`, proxied by nginx) |

No real secrets are committed; only the `.env.example` files are in the repository.

---

## Seeded accounts

All passwords are **`Password@123`**. The login page also has quick-fill buttons for the admin, a creator and a reviewer.

| Role | Name | Email | Clients they review |
|---|---|---|---|
| Admin | Aarav Mehta | `admin@campaignhub.test` | – |
| Creator | Priya Sharma | `priya@campaignhub.test` | – |
| Creator | Rahul Verma | `rahul@campaignhub.test` | – |
| Reviewer | Neha Kapoor | `neha@campaignhub.test` | Masala Bay Foods, Zenith Fitness |
| Reviewer | Arjun Nair | `arjun@campaignhub.test` | Zenith Fitness, UrbanLoom Apparel |

The seed ([api/prisma/seed.ts](api/prisma/seed.ts)) creates 3 clients and **18 posts – 3 in every status** – across all four platforms, with a matching audit history and review comments. One scheduled post goes live **3 minutes after seeding**, so the publish job can be seen working. The seed checks its own data with the same rule functions the API uses (workflow, caption limits, 2-hour gap), so it can't create a state the app couldn't.

---

## Tests

```bash
cd api
npm test        # 132 tests
```

| Spec | Tests | Covers |
|---|---|---|
| [post-workflow.spec.ts](api/src/posts/post-workflow.spec.ts) | 48 | **Status transitions**: the 6 allowed moves pass, all 30 other combinations are rejected with 400 and a clear message |
| [scheduling.spec.ts](api/src/posts/scheduling.spec.ts) | 15 | **Scheduling conflict**: 1h59m apart conflicts, exactly 2h is allowed, other client/platform and the post itself are ignored, nearest conflict is reported; future-time rule |
| [post-policy.spec.ts](api/src/posts/post-policy.spec.ts) | 34 | Who may edit / submit / approve / schedule, self-approval, unassigned reviewers, 10-character change-request comment |
| [caption-limits.spec.ts](api/src/posts/caption-limits.spec.ts) | 12 | Per-platform limits at and just over the limit; emoji count as one character |
| [posts.service.spec.ts](api/src/posts/posts.service.spec.ts) | 9 | Optimistic locking (stale version → 409, lost race → 409), transition writes status + audit + comment together, date-range filter |
| [publish-scheduled-posts.job.spec.ts](api/src/scheduler/publish-scheduled-posts.job.spec.ts) | 5 | Background publish job, including two runs racing for the same post |
| [http-exception.filter.spec.ts](api/src/common/http-exception.filter.spec.ts) | 9 | Consistent error response shape |

---

## Features

### Roles and authentication
- [x] JWT login with bcrypt-hashed passwords; every route requires a token unless marked public
- [x] Role guard (`@Roles(...)`) for ADMIN / CREATOR / REVIEWER
- [x] The UI adapts to the role: menu, buttons and pages only show what the user can do

### Status workflow (enforced on the API)
- [x] `DRAFT → IN_REVIEW → APPROVED → SCHEDULED → PUBLISHED` and `IN_REVIEW → CHANGES_REQUESTED → IN_REVIEW`, defined once in [post-workflow.ts](api/src/posts/post-workflow.ts)
- [x] Any other transition → **400** `INVALID_TRANSITION` with the allowed next statuses in the message
- [x] Every status change writes an **audit log** entry, in the same transaction as the change

### Business rules

| Rule | Where it's enforced |
|---|---|
| Only the creator can edit, and only in DRAFT / CHANGES_REQUESTED | `assertCanEdit` – [post-policy.ts](api/src/posts/post-policy.ts) |
| Reviewers only see and act on posts of their assigned clients | `visibleTo` – [posts.service.ts](api/src/posts/posts.service.ts), [clients.service.ts](api/src/clients/clients.service.ts) (404 for others) |
| Nobody can approve their own post | `transitionDenialReason` – [post-policy.ts](api/src/posts/post-policy.ts) |
| Requesting changes needs a comment of at least 10 characters | `assertChangeRequestComment` – [post-policy.ts](api/src/posts/post-policy.ts) |
| Caption limits: X 280, Instagram 2,200, LinkedIn 3,000, Facebook 5,000 | [caption-limits.ts](api/src/posts/caption-limits.ts) |
| Same client + platform at least 2 hours apart → **409** with `conflictingPostId` | [scheduling.ts](api/src/posts/scheduling.ts) + `assertNoConflict` / `lockSlot` in [posts.service.ts](api/src/posts/posts.service.ts) |
| Scheduled time must be in the future; stored in UTC, shown in IST | `assertInFuture` – [scheduling.ts](api/src/posts/scheduling.ts); [web/src/lib/datetime.ts](web/src/lib/datetime.ts) |
| Optimistic locking: updates send `version`, mismatch → **409** | conditional `updateMany({ where: { id, version } })` in [posts.service.ts](api/src/posts/posts.service.ts) |
| Every status change creates an AuditLog entry | `transition()` in [posts.service.ts](api/src/posts/posts.service.ts) |
| A job runs every minute and publishes due SCHEDULED posts | [publish-scheduled-posts.job.ts](api/src/scheduler/publish-scheduled-posts.job.ts) |

### Frontend
- [x] Login with role-aware navigation and route guards
- [x] Kanban board with one column per status, filterable by client and platform (filters kept in the URL)
- [x] Post editor with a live per-platform character counter and a preview of the post on that platform
- [x] Post detail page with role-based actions, comment thread and audit timeline
- [x] Clear messages for 409 (schedule conflict with a link to the clashing post; version conflict with "Load latest version") and 400 (invalid transition)
- [x] Loading, empty and error states (with retry) on every page; responsive down to phone width
- [x] Admin pages for users and clients, including assigning reviewers

### Bonus
- [x] Swagger API documentation – `/api/docs`
- [x] Docker Compose setup – database, API and web app with one command
- [x] Weekly calendar of scheduled posts per client (IST)
- [ ] Real-time notifications (Socket.IO / SSE) – not done
- [ ] Live deployment – not done

---

## Assumptions

Where the brief left room for interpretation:

- **Who schedules:** the post's creator or an admin moves an approved post to SCHEDULED. Reviewers approve content; scheduling is part of the creator's publishing plan.
- **Scheduling conflicts count posts in any status**, drafts included, so two posts can't be approved for the same slot.
- **PUBLISHED is set only by the background job**, never by a user.
- **Creators can see all posts** (the whole agency board) but only edit their own. Reviewers only see their clients' posts.
- **Comments don't change a post's version**, so a reviewer's comment doesn't cause a 409 for someone editing.
- "Clients" are created by the admin; a client with posts can't be deleted, and neither can a user who has written posts or comments.

---

## API overview

All routes are under `/api` and need `Authorization: Bearer <token>` except login. Full details in Swagger.

| Method | Path | Who |
|---|---|---|
| POST | `/auth/login` | public |
| GET | `/auth/me` | any |
| GET / POST | `/posts` | any / creator (`?clientId&platform&status&from&to`) |
| GET / PATCH | `/posts/:id` | any (scoped) / author |
| POST | `/posts/:id/transitions` | depends on the target status |
| GET | `/posts/:id/audit` | any (scoped) |
| GET / POST | `/posts/:id/comments` | any (scoped) |
| GET | `/clients`, `/clients/:id` | any (reviewers: own clients) |
| POST / PATCH / DELETE | `/clients`, `/clients/:id` | admin |
| PUT | `/clients/:id/reviewers` | admin |
| GET / POST / PATCH / DELETE | `/users`, `/users/:id` | admin |

**Errors** always look like this, so the frontend can switch on `code`:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "code": "SCHEDULE_CONFLICT",
  "message": "Post #12 for this client on INSTAGRAM is scheduled within 2 hours of this time",
  "conflictingPostId": 12,
  "path": "/api/posts",
  "timestamp": "2026-10-01T04:00:00.000Z"
}
```

Codes: `VALIDATION_FAILED`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INVALID_TRANSITION`, `COMMENT_REQUIRED`, `POST_NOT_EDITABLE`, `CAPTION_TOO_LONG`, `SCHEDULED_IN_PAST`, `SCHEDULE_CONFLICT`, `VERSION_MISMATCH`, `CONFLICT`, `INTERNAL_ERROR`.

---

## Project structure

```
api/
  prisma/                schema, migrations, seed
  src/
    auth/                login, JWT strategy, guards, decorators
    users/  clients/     admin endpoints
    posts/
      post-workflow.ts   allowed status transitions
      post-policy.ts     who may do what
      caption-limits.ts  per-platform caption limits
      scheduling.ts      2-hour conflict + future-time rules
      posts.service.ts   create / update / transition / queries
    comments/            comment thread
    scheduler/           publish job (every minute)
    common/              error filter, Prisma error helper
web/
  src/
    auth/                auth context, route guard
    pages/               board, editor, detail, calendar, admin
    components/          cards, badges, preview, actions, timeline…
    hooks/queries.ts     data fetching (TanStack Query)
    lib/                 API client, types, IST date helpers
```
