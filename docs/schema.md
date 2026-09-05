# Schema

The database is PostgreSQL, with Prisma as the ORM/schema layer. I kept the core model relational and explicit because the assignment has several integrity rules around ownership, assignment, workflow history and revisions.

## Tables and columns

### `User`

| Column | Type | Purpose |
|---|---|---|
| `id` | String/CUID | Primary key |
| `email` | String | Login identity; unique |
| `passwordHash` | String | bcrypt password hash |
| `name` | String | Display name |
| `role` | Enum (`EDITOR`, `WRITER`) | Server-side role |
| `createdAt` | DateTime | Account creation time |

A user can own sections, be assigned to sections, author articles, create comments and create audit events.

### `Section`

| Column | Type | Purpose |
|---|---|---|
| `id` | String/CUID | Primary key |
| `name` | String | Section name |
| `description` | String | Section description |
| `ownerEditorId` | String | Foreign key to `User` |
| `archived` | Boolean | Soft archive flag |
| `createdAt` | DateTime | Creation time |
| `updatedAt` | DateTime | Last modification time |

The application verifies that `ownerEditorId` belongs to an editor before a section is created/updated.

### `SectionWriter`

This is the many-to-many join table between writers and sections.

| Column | Type | Purpose |
|---|---|---|
| `sectionId` | String | FK to `Section` |
| `writerId` | String | FK to `User` |
| `createdAt` | DateTime | Assignment time |

The composite primary key `(sectionId, writerId)` prevents duplicate assignments.

### `Article`

| Column | Type | Purpose |
|---|---|---|
| `id` | String/CUID | Primary key |
| `sectionId` | String | FK to `Section` |
| `authorId` | String | FK to `User` |
| `title` | String | Article title |
| `body` | String | Article body |
| `status` | Enum | Draft/review/approved/scheduled/published |
| `publishAt` | DateTime nullable | Scheduled publication time |
| `publishedAt` | DateTime nullable | Actual publication timestamp |
| `createdAt` | DateTime | Creation time |
| `updatedAt` | DateTime | Last content/database update |
| `revisionOfId` | String nullable | Self-FK to the published article being revised |

The self-relation lets a revision use the normal article workflow while remaining linked to its original published article.

### `Comment`

Stores comments made by editors or writers against an article.

- `id`: String/CUID primary key
- `articleId`: FK to `Article`
- `authorId`: FK to `User`
- `content`: String
- `createdAt`: DateTime

Comments are append-only from the application's point of view.

### `ArticleEvent`

This is the audit/history table.

- `id`: String/CUID primary key
- `articleId`: FK to `Article`
- `type`: `STATUS_CHANGE`, `REVISION_OPENED`, `REVISION_PUBLISHED`, `COMMENT`, or `ALERT_DISMISSED`
- `oldStatus`: nullable article status
- `newStatus`: nullable article status
- `actorId`: FK to `User`
- `message`: optional explanatory text
- `createdAt`: DateTime

There is intentionally no update/delete API for this table. The relation from an article uses `onDelete: Restrict`, making accidental cascading deletion of audit records harder.

### `DismissedAlert`

Stores a dismissal against a specific scheduled publish timestamp rather than simply against an article.

- `id`: String/CUID primary key
- `articleId`: FK to `Article`
- `scheduledAt`: DateTime
- `dismissedById`: FK to `User`
- `dismissedAt`: DateTime

The unique constraint `(articleId, scheduledAt)` is what makes a newly rescheduled article alert again: a different `publishAt` is a different dismissal key.

## Relationships

- `User -> Section`: one editor can own many sections.
- `Section -> User` through `SectionWriter`: many-to-many; a section can have many writers and a writer can belong to many sections.
- `Section -> Article`: one-to-many; every article belongs to exactly one section.
- `User -> Article`: one-to-many; a user can author many articles.
- `Article -> Article`: one-to-many self-relation for revisions; one published article can have multiple historical/open revisions, with the application limiting it to one open revision at a time.
- `Article -> ArticleEvent`: one-to-many.
- `Article -> Comment`: one-to-many.
- `Article -> DismissedAlert`: one-to-many over different scheduled timestamps.

## Database constraints vs application rules

I used the database for structural integrity and the application for business workflow.

### Database-enforced

- primary keys
- unique user email
- composite primary key on section assignments
- foreign keys
- cascade behavior where deleting a section assignment/comment is safe
- restrictive behavior for article audit history
- unique `(articleId, scheduledAt)` for dismissed alerts
- indexes used by common article filters and history lookups

### Application-enforced

The database does not know that a writer must be assigned to a section, that only an editor can approve, or that an editor cannot approve their own article. Those are business rules, so they live in permission/workflow services and are covered by tests.

Likewise, the legal state transitions are application rules. A database CHECK constraint could encode part of the state machine, but the actual rules depend on the acting user, action and publish timestamp, so application-level validation is clearer.

## Deliberate denormalisation

I did not deliberately duplicate article content or user/section names into the main tables. `publishedAt` alongside `publishAt` is intentional rather than redundant: scheduled time and actual publication time answer different questions.

The audit table also stores `oldStatus` and `newStatus` even though those values can be inferred from a sequence of article states. That duplication is intentional because an audit event should remain a self-contained record of what happened at that moment.

## What would break first at 100x the data?

The first pressure point would be list/dashboard queries rather than the basic relational model. Article search currently relies on PostgreSQL query filtering and indexed fields; at much larger scale, free-text title/body search would benefit from a PostgreSQL full-text index or a dedicated search service.

The dashboard's weekly publication calculations and large audit timelines would also need stronger aggregation/indexing strategies. CSV export would need streaming rather than building the entire CSV string in memory.

I would address those after measuring real query plans rather than prematurely introducing Elasticsearch, caching or a queue into a small assignment-sized system.
