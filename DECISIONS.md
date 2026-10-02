# Decisions

A few notes on how I built CampaignHub, what I chose not to do, and what I'd change with more time.

## 1. Three technical decisions

### The workflow is one table, not a set of endpoints

All the status rules live in one object, `ALLOWED_TRANSITIONS` in `api/src/posts/post-workflow.ts`. Each status lists the statuses it can move to, and anything not listed is rejected with a 400 that also tells you which moves *are* allowed. There is a single endpoint for every move, `POST /posts/:id/transitions` with `{ toStatus, version, comment? }`.

Who is allowed to make a move (a reviewer only for their own clients, nobody approving their own post, and so on) is kept separately in `post-policy.ts`. The API also returns `allowedTransitions` for each post, worked out by the same policy code, so the buttons in the React app come from the server instead of a second copy of the rules.

What I didn't do:
- **One endpoint per action** (`/approve`, `/submit`, `/schedule`…). It's a common pattern, but the workflow ends up spread over several handlers and you can't see the whole diagram in one place.
- **A state machine library.** For six states a plain object is easier to read, and easier to change live if someone asks.
- **Repeating the rules in the frontend.** Two copies would drift apart sooner or later.

The unit tests check all 36 from/to combinations: 6 must pass and 30 must fail. When I tried allowing DRAFT → APPROVED just to see, two tests failed straight away, which is what I wanted.

### Optimistic locking with a conditional update

Every post has a `version` that goes up by one on each write. Updates are done with:

```ts
updateMany({ where: { id, version: dto.version }, data: { ..., version: { increment: 1 } } })
```

If that updates 0 rows, someone else saved first, so the API returns 409 with the current version. In the UI the error has a "Load latest version" button. There's also an early `if (dto.version !== post.version)` check, but that's only a quick exit; the real guarantee is the `WHERE` condition, because it's checked by the database at the moment of the write.

What I didn't do:
- **Last write wins.** Simple, but it silently throws away a colleague's changes.
- **Pessimistic locking** ("this post is locked while Priya edits it"). You then need timeouts and a way to unlock when someone just closes the tab. Conflicts here are rare, so it felt like too much.
- **TypeORM's `@VersionColumn`.** I went with Prisma, which has no built-in version column, but the explicit `updateMany` is short and easy to explain anyway.

### Scheduling conflicts: a plain function plus an advisory lock

The rule itself is in `api/src/posts/scheduling.ts`. `conflictWindow()` gives the range from 2 hours before to 2 hours after a time, with both ends exclusive, so two posts exactly 2 hours apart are fine. `findConflict()` returns the closest clashing post, and the 409 response includes its `conflictingPostId` so the UI can link to it. The database query uses the same `conflictWindow()`, so the query and the tested function can't disagree.

The tricky part was concurrency. "Is anything within 2 hours? No? Then insert" isn't atomic: two requests for the same empty slot can both pass the check before either one saves. So inside the transaction I take `pg_advisory_xact_lock(clientId, hashtext(platform))`. Saves for the same client and platform take turns, everything else runs normally, and Postgres releases the lock when the transaction ends.

What I didn't do:
- **A unique constraint.** It can only stop exact duplicates; "within 2 hours" is a range.
- **A Postgres exclusion constraint on a time range.** It would work, but it's harder to read, and it's harder to send back a friendly message with the conflicting post's ID.
- **SERIALIZABLE isolation.** It also works, but every request then needs retry logic for serialization failures.
- **Locking the whole posts table.** It would block clients and platforms that have nothing to do with each other.

One assumption: every post holds its slot, whatever its status, drafts included. It's simpler to explain, and nobody gets surprised later when a draft can't be scheduled.

### Smaller choices

- Times are stored as UTC (`timestamptz`). The API only accepts times that include a timezone, and the frontend shows everything in IST through one helper file, `web/src/lib/datetime.ts`. I didn't trust the browser's timezone, because a reviewer travelling abroad would see wrong times.
- Prisma over TypeORM, for one readable schema file and plain-SQL migrations.
- NestJS 11 and React Router 7 rather than the newest major versions. The new Nest template wouldn't even install cleanly for me, and with a deadline I preferred versions that every plugin and doc already supports.
- The business rules (workflow, permissions, caption limits, scheduling) are in small files with no database access, so they're unit tested without any setup and the whole suite runs in a few seconds.

## 2. A problem I ran into

**Deleting a user was quietly rewriting the audit history.**

I found this with an end-to-end test I wrote near the end. I expected that deleting a reviewer who had approved posts would be refused with a 409. Instead it returned 204, and their approvals in the audit timeline now said "System" (I use an empty actor for the automatic publish job).

The cause was in the schema. `AuditLog.actorId` is optional because of that publish job, and for an optional relation Prisma's default is `ON DELETE SET NULL`. So Postgres did exactly what it was told: it deleted the user and blanked out the actor on their history. I only saw it by opening the generated migration SQL.

The fix was `onDelete: Restrict` on that relation, a new migration (`20261001093045_keep_audit_actor_when_user_deleted`), and a clearer 409 message: "User has posts, comments or workflow history and cannot be deleted. Change their role instead." The lesson for me was to always check the referential actions an ORM generates, because the defaults can silently damage data you care about, and an audit log is exactly that kind of data.

A second problem worth mentioning is the scheduling race described above. Before the advisory lock, I fired two create requests for the same slot at the same time, five times, and all five double-booked (201 and 201). With the lock it's 201 and 409 every time.

## 3. With one more week

- **Real-time updates** with SSE, so the board and post page refresh when someone else moves a post. This is the one bonus I skipped.
- **CI** that runs the unit and API end-to-end tests on every push, and turning my browser checks into a proper Playwright suite in the repo.
- **Refresh tokens in httpOnly cookies** instead of keeping the access token in localStorage.
- **Pagination** on the board, for clients with hundreds of posts.
- **A timezone per client** instead of IST everywhere, since not every brand will be in India.
- **A smaller API Docker image.** It's about 1 GB now because the dev tools are kept for migrations and the seed. I'd run migrations as a separate one-off step instead.
- **A database index on `lower(name)` for clients.** Duplicate names are checked in code, but an index would also close the small gap when two admins create the same client at the same moment.
