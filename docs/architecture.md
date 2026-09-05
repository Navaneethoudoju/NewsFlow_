# Architecture

NewsFlow is a small three-tier editorial workflow application. I deliberately kept the architecture boring: a React client, a Node/Express API, and PostgreSQL accessed through Prisma. The important business rules live on the server rather than being duplicated in the browser.

## Moving pieces

### Frontend

The frontend is a React 18 application built with Vite and TypeScript. React Router handles navigation, TanStack Query handles server state and cache invalidation, and Tailwind CSS provides the UI styling. The client talks to the API through the small wrapper in `client/src/lib/api.ts` and authenticates using an HTTP-only cookie.

The main UI areas are:

- login/authentication
- dashboard
- article list/search/filtering
- article creation and editing
- article detail/history/revisions
- sections and writer assignments
- overdue alerts

### Backend

The backend is an Express + TypeScript API. It is split into routes, services, middleware and small domain libraries:

- `routes/` defines HTTP endpoints and validates request shapes.
- `services/` contains the application operations and Prisma queries.
- `middleware/auth.ts` verifies the authentication cookie and role.
- `lib/permissions.ts` contains section/article visibility and assignment checks.
- `lib/workflow.ts` contains the article state machine and transition validation.
- `lib/validate.ts` uses Zod for request validation.
- `lib/asyncHandler.ts` and `errorHandler.ts` keep error handling consistent.
- `history.service.ts` centralises append-only article events.

### Database

PostgreSQL stores users, sections, section assignments, articles, comments, audit events and dismissed overdue alerts. Prisma is used for schema management, migrations and typed database access.

## Where it runs

For production, the intended deployment is:

- React/Vite frontend: static hosting such as Vercel.
- Express API: Render Web Service.
- PostgreSQL: Render PostgreSQL.

The repository also contains a Dockerfile and docker-compose setup for local development/testing. The Render service uses the `server` directory as its root, builds TypeScript, generates the Prisma client, applies migrations on startup, and then starts `dist/index.js`.

## Representative request path: approving an article

1. An editor opens an article that is `IN_REVIEW`.
2. The React UI sends `POST /articles/:id/transition` with `{ action: "APPROVE" }`.
3. Express authentication middleware reads the HTTP-only JWT cookie and attaches the authenticated user to the request.
4. The article service loads the article and checks that the user can see it.
5. The service calls `validateTransition()` in `lib/workflow.ts`.
6. The workflow validator checks the current status, requested action, editor role, and the rule that the approver cannot be the article author.
7. If the move is illegal, an application error is returned with a useful explanation; the database is not changed.
8. If valid, the service updates the article and writes a `STATUS_CHANGE` event containing the old status, new status, actor and timestamp.
9. The updated article is returned to the client.
10. TanStack Query invalidates the relevant article/list/history queries so the UI reflects the new state without a full page reload.

The same principle is used for scheduling, publishing, unpublishing, revisions and bulk operations: the browser can make the action convenient, but it is never trusted to enforce the business rule.

## Why this shape

The main architectural choice was to put workflow and permissions in reusable server-side modules instead of implementing them inside individual route handlers. The article lifecycle is the riskiest part of the assignment, so having one transition validator makes illegal states easier to reason about and test.

I also kept revisions as `Article` records with a self-relation rather than introducing a second content model. A revision therefore gets the same workflow, history and permissions machinery as an ordinary article, while `revisionOfId` connects it to the published article it will replace.

## What I deliberately did not build

I did not build a background job/queue that automatically publishes scheduled articles. The requirement only says that a scheduled article whose publish time has passed and is still unpublished must appear as an overdue alert. Treating overdue publication as an explicit editorial action keeps the system predictable and avoids adding Redis/a worker/cron infrastructure inside a roughly 12-hour assignment.

I also did not build the optional stretch features such as passage-level comments, visual revision diffs, public preview links, a calendar UI, or payment tracking. CSV export covers the required calendar export without adding a second calendar subsystem.

Finally, I did not introduce microservices. The domain is small enough that a modular monolith is easier to deploy, test and explain, and splitting it would add operational complexity without helping any of the ten required goals.
