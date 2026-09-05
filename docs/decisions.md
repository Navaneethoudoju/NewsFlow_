# Decisions

These are the decisions that shaped the implementation rather than superficial library choices.

## Decision 1 — Use a modular monolith

- **Chose:** One Express/TypeScript backend with separate route, service, middleware and domain modules.
- **Rejected:** Splitting authentication, editorial workflow, reporting and alerts into microservices.
- **Why:** The domain is small and tightly coupled. A modular monolith keeps deployment simple and makes transactions and workflow changes easier to reason about. Microservices would have added networking, deployment and observability overhead without helping the assignment's core requirements.

## Decision 2 — Keep workflow transitions in one state-machine module

- **Chose:** `server/src/lib/workflow.ts` owns the legal transition table and validates role/actor/publish-time conditions.
- **Rejected:** Letting each route directly assign `article.status` and relying on UI buttons to hide illegal actions.
- **Why:** The state machine is the most important business invariant in the application. One validator reduces duplicated rules and makes invalid transitions testable independently of HTTP/UI behavior.

## Decision 3 — Enforce permissions on the server

- **Chose:** Authentication, role checks, section assignments and article visibility are enforced by middleware/services/query filters.
- **Rejected:** Treating hidden React buttons as the main authorization mechanism.
- **Why:** A client can be modified or bypassed. The assignment explicitly requires server-side enforcement, so the API must reject unauthorized operations even when called directly.

## Decision 4 — Model revisions as articles with a self-relation

- **Chose:** A revision is an `Article` with `revisionOfId` pointing to the published article it will replace.
- **Rejected:** A separate `Revision` content table with a second workflow implementation.
- **Why:** Revisions need the same title/body/status/author/history and transition behavior as normal articles. Reusing the Article model avoids duplicating workflow logic. Publishing a revision folds its content into the original published record while keeping the revision event/history intact.

## Decision 5 — Use append-only audit events

- **Chose:** Store status changes, revision events, comments and alert dismissals as historical records with timestamps and actors; do not expose update/delete operations for the audit log.
- **Rejected:** Keeping only `updatedBy`/`updatedAt` fields on articles or allowing editors to edit history.
- **Why:** The requirement is specifically about being able to explain what happened after publication. A mutable last-updated field cannot reconstruct a timeline. The event table also makes the history view straightforward.

## Decision 6 — Derive overdue alerts instead of running a publisher job

- **Chose:** An article is overdue when it is `SCHEDULED`, its `publishAt` is in the past, and its current schedule has not been dismissed.
- **Rejected:** A cron/queue worker that automatically changes status to `PUBLISHED`.
- **Why:** The requirement asks for an alert, not automatic publication. Deriving the alert keeps the system simple and makes missed schedules visible to an editor rather than silently publishing content.

## Decision 7 — Key alert dismissal by article + scheduled timestamp

- **Chose:** `DismissedAlert` has a unique `(articleId, scheduledAt)` key.
- **Rejected:** A single `alertDismissed = true` flag on `Article`.
- **Why:** A dismissed schedule must not suppress a later schedule. When the article is scheduled again for a different time, the new timestamp creates a new alert identity. This was a small schema decision with a direct connection to a tricky requirement.

## Decision 8 — Server-side search, filtering and pagination

- **Chose:** The article endpoint accepts search/filter/sort/page parameters and Prisma builds the database query.
- **Rejected:** Fetching every article and filtering/sorting/paginating in React.
- **Why:** The requirement explicitly calls for server-side behavior. It also prevents the browser from downloading data the user should not see and scales better as the article count grows.

## Decision 9 — Later reversed: initial preference for a separate revision table

- **Chose initially:** A dedicated `Revision` table containing a snapshot of title/body and a reference to the original article.
- **Rejected initially:** Treating revisions as normal Article records.
- **Why initially:** A separate table seemed semantically cleaner because a revision is historically different from a live article.
- **Later reversed:** While implementing the workflow, it became clear that a revision must move through Draft → In Review → Approved → Published with the same permissions, history and validation as a normal article. A second model would have required duplicated workflow/service code and complicated the UI.
- **Final choice:** Use `Article.revisionOfId` as a self-relation. This kept the data model smaller and made the revision workflow reuse the existing article machinery.
