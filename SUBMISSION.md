# Submission

## Links

GitHub repository: https://github.com/Navaneethoudoju/NewsFlow_.git
Live application:

## Notes for the reviewer

NewsFlow is a small editorial workflow system built around server-side permissions and a strict article state machine. The most important business rules are enforced by the API rather than only by the React interface.

The backend is hosted as a Render Web Service and uses PostgreSQL through Prisma. If the selected hosting plan sleeps while idle, the first request after inactivity may take longer than subsequent requests.

The repository includes seeded demo data so the reviewer can immediately see multiple article states, comments, history, revisions and an overdue publish alert.
## Demo credentials

All demo accounts use the same password: password123

- Editor, owns Politics and Culture: editor1@demo.com
- Editor, owns Tech and Sports: editor2@demo.com
- Writer, assigned to Politics and Culture: writer1@demo.com
- Writer, assigned to Culture and Sports: writer2@demo.com
- Writer, assigned to Tech: writer3@demo.com
- Writer, assigned to Tech and Sports: writer4@demo.com

## Stack

Frontend: React and TypeScript built with Vite, React Router for pages,
React Query for server data, React Hook Form with Zod for forms, Recharts
for the dashboard charts, and Tailwind for styling. 

Backend: Node.js with Express and TypeScript, Prisma as the ORM, Zod for
request validation, and a JWT stored in an httpOnly cookie for auth. A
small REST API is all this needs. No GraphQL layer or microservices for a
single-team newsroom tool.

Database: PostgreSQL. The data is relational with real foreign keys between
users, sections, articles and events, so a relational database was the
natural fit.

Hosting: Vercel for the client, Render for the server, Supabase for
Postgres. Free tiers across all three, matching the combination suggested
in the brief.

## Goal checklist

1. Accounts and roles — Done. Email and password login, JWT cookie auth,
   editor and writer roles. All permission checks are enforced server-side
   in lib/permissions.ts and lib/workflow.ts, not just hidden in the UI.
   The UI simply doesn't render actions a role can't take.

2. Sections — Done. Editors create and edit sections with a name,
   description, and owning editor. Archive and restore hides a section
   from default views without deleting its articles.

3. Articles inside sections — Done. Every article has exactly one section
   and one author. Writers can create and edit their own; editors can edit
   any article. Opening a section lists its articles.

4. Article lifecycle with rules — Done. Full Draft, In Review, Approved,
   Scheduled, Published state machine in lib/workflow.ts, including the
   rule that an author can't approve their own work, edits to Approved or
   Scheduled articles reverting to In Review, and the revision system for
   published articles.

5. Section assignments — Done. Editors assign and remove writers through
   the SectionWriter join table. Writers have a "my sections" view and a
   "my articles" view.

6. Finding articles — Done. Server-side search over title and body,
   filters for section, status and author, sorting by updated time, status
   or publish time, and pagination with a total count. Nothing is loaded
   into the browser and filtered client-side.

7. Acting on many articles at once — Done. Bulk schedule and bulk
   unpublish return a per-article success or failure result rather than
   failing the whole batch. CSV export of the editorial calendar, covering
   scheduled and published articles, is a separate endpoint.

8. A dashboard — Done. Headline counts for articles in review, scheduled
   this week, published this week, and open drafts, plus breakdowns by
   status and section, and a chart of articles published per week over the
   last eight weeks.

9. History you cannot rewrite — Done. Every article has an append-only
   timeline covering creation, every status change with old and new status
   and who made it, revisions opened and published, and comments. There is
   no update or delete route for these events.

10. Overdue publish alerts — Done. A Scheduled article past its publish
    time shows as overdue, with a count badge. Dismissal is tied to the
    specific scheduled time, so an article that is unpublished and
    rescheduled will alert again if the new time also passes.

## How much time did you actually spend?
Approximately 12 hours, including implementation, testing, deployment preparation and documentation. The workflow and revision edge cases consumed more time than initially expected, while the basic CRUD screens were relatively quick once the API contracts were stable.

## What would you do next, with another 12 hours?

I would spend the next 12 hours on production hardening rather than adding a large new feature:

Improve automated integration-test coverage around every permission boundary.

Add stronger PostgreSQL full-text search/indexing for title/body queries.

Add a real scheduled publishing worker if the product eventually requires automatic publication.

Improve revision comparison with a visual diff.

Add more polished editor/writer UX around comments, validation and bulk-action results.

Add deployment smoke tests and better observability/logging.

Add the optional content-calendar view if the core workflow remains stable.


## What are you least happy with in this codebase, and why?
The main compromise is that some reporting and dashboard calculations are intentionally simple Prisma queries. They are appropriate for the assignment's scale, but I would want to inspect query plans and add more specialised indexes/aggregations before treating the system as a high-volume newsroom platform.

I also deliberately kept scheduled publishing as an alert rather than an automated background job. That keeps the assignment architecture small, but a real newsroom would probably want a durable scheduler/worker, retry behavior, monitoring and an explicit policy for what happens when a publication job is missed.

The other area I would improve is test breadth. The important workflow paths have unit/integration coverage, but a production system would benefit from a larger matrix of role × status × action cases and end-to-end browser tests for the most important editor journeys.