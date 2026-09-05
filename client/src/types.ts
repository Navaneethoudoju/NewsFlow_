export type Role = "EDITOR" | "WRITER";

export type ArticleStatus = "DRAFT" | "IN_REVIEW" | "APPROVED" | "SCHEDULED" | "PUBLISHED";

export type TransitionAction =
  | "SUBMIT_FOR_REVIEW"
  | "SEND_BACK_TO_DRAFT"
  | "APPROVE"
  | "SCHEDULE"
  | "PUBLISH"
  | "UNSCHEDULE"
  | "UNPUBLISH";

export type EventType =
  | "STATUS_CHANGE"
  | "REVISION_OPENED"
  | "REVISION_PUBLISHED"
  | "COMMENT"
  | "ALERT_DISMISSED";

export interface UserRef {
  id: string;
  name: string;
  email: string;
}

export interface SectionRef {
  id: string;
  name: string;
  archived?: boolean;
}

export interface Section {
  id: string;
  name: string;
  description: string;
  ownerEditorId: string;
  ownerEditor: UserRef;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
  writers: { writer: UserRef }[];
  _count: { articles: number };
}

export interface Article {
  id: string;
  title: string;
  body: string;
  status: ArticleStatus;
  sectionId: string;
  section: SectionRef;
  authorId: string;
  author: UserRef;
  publishAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  revisionOfId: string | null;
}

export interface ArticleListResponse {
  items: Article[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ArticleEvent {
  id: string;
  articleId: string;
  type: EventType;
  oldStatus: ArticleStatus | null;
  newStatus: ArticleStatus | null;
  actorId: string;
  actor: {
    id: string;
    name: string;
  };
  article: {
    id: string;
    title: string;
  };
  message: string | null;
  createdAt: string;
}
export interface Comment {
  id: string;
  articleId: string;
  authorId: string;
  author: UserRef;
  content: string;
  createdAt: string;
}

export interface BulkResult {
  articleId: string;
  success: boolean;
  reason?: string;
}

export interface OverdueAlert {
  articleId: string;
  title: string;
  section: SectionRef;
  author: UserRef;
  scheduledAt: string;
  overdueMs: number;
}

export interface DashboardSummary {
  drafts: number;
  inReview: number;
  approved: number;
  scheduled: number;
  published: number;
  overdue: number;
}

export interface StatusCount {
  status: ArticleStatus;
  count: number;
}

export interface SectionCount {
  sectionId: string;
  sectionName: string;
  count: number;
}

export interface WeeklyPublished {
  weekStart: string;
  count: number;
}

export interface UpcomingArticle {
  id: string;
  title: string;
  status: ArticleStatus;
  publishAt: string | null;
  section: SectionRef;
  author: UserRef;
}
