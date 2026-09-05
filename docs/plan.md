# Plan

I treated the assignment as a small production feature rather than starting with UI screens. The first goal was to make the data model and server-side rules correct; the UI was then built on top of those stable API contracts.

## Implementation breakdown

### 1. Understand the rules and design the model

I converted the ten goals into concrete entities and operations: users/roles, sections/assignments, articles, workflow transitions, revisions, comments, audit events and overdue-alert dismissals.

The most important early decision was to model the article lifecycle explicitly instead of scattering status checks throughout the application.

### 2. Database and authentication

I implemented the Prisma schema, PostgreSQL relationships and seed data, then added login/logout/current-user handling with bcrypt and JWT cookies.

I also added role middleware so the server could reject editor-only operations independently of the UI.

### 3. Article workflow and permissions

I implemented the transition state machine and article service. This covered submission, approval, scheduling, publishing, unpublishing, editing rules and revision creation/publishing.

I prioritised this before UI work because an attractive interface would not compensate for an incorrect editorial workflow.

### 4. Sections, assignments, search and bulk actions

I added section management and writer assignment, server-side article search/filter/sort/pagination, bulk schedule/unpublish, and calendar CSV export.

The key check here was that visibility and assignment rules were applied in the database query/service layer rather than filtering a complete article list in the browser.

### 5. Dashboard, history and alerts

I built the dashboard aggregation endpoints, history timeline, comments and overdue alert/dismissal behavior.

The alert design was tested against the tricky case where an article is dismissed and later scheduled again at a different time.

### 6. Frontend integration and workflow UX

I connected the React pages to the API, added protected routes, forms, loading/error/empty states, status actions, revision screens and the alerts navigation badge.

### 7. Verification and deployment preparation

I added and ran workflow and integration tests, seeded realistic demo data, checked the production configuration, and prepared Render/Vercel deployment settings and submission documentation.

## Build order and why

The order was deliberate:

1. schema
2. authentication/authorization
3. workflow rules
4. article/section APIs
5. reporting/search/bulk operations
6. frontend
7. tests and deployment
8. documentation

The workflow was the highest-risk part, so I wanted it to be independently testable before building UI assumptions around it. The frontend then became mostly a representation of API state rather than the place where business rules lived.

## What I cut when time became tight

I kept all ten required goals and cut optional scope instead. I did not implement passage-level comments, visual revision diffs, public preview links, reading-time calculations, style-guide acknowledgement, second approvals, a dedicated calendar UI, freelance payment tracking or cross-section tagging.

I also avoided a background publishing worker. The required behavior is represented by overdue alerts, so a worker would have increased operational complexity without improving the required score proportionally.

## What I would change in the plan next time

I would reserve a slightly larger explicit testing window before polishing the UI. The server-side workflow deserves the most verification because it is where the highest-impact incorrect states can be created.
