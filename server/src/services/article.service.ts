import { ArticleStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { AppError } from "../lib/errors";
import { AuthTokenPayload } from "../lib/jwt";
import { articleVisibilityFilter, assertCanViewArticle, assertCanWriteInSection, isEditor } from "../lib/permissions";
import { TransitionAction, validateTransition } from "../lib/workflow";
import { logEvent } from "./history.service";

const AUTHOR_SELECT = { id: true, name: true, email: true } as const;
const SECTION_SELECT = { id: true, name: true, archived: true } as const;

export const ARTICLE_INCLUDE = {
  author: { select: AUTHOR_SELECT },
  section: { select: SECTION_SELECT },
} satisfies Prisma.ArticleInclude;

export interface ArticleListQuery {
  search?: string;
  sectionId?: string;
  status?: ArticleStatus;
  authorId?: string;
  sortBy?: "updatedAt" | "createdAt" | "status" | "publishAt";
  sortOrder?: "asc" | "desc";
  page: number;
  pageSize: number;
}

export async function listArticles(user: AuthTokenPayload, query: ArticleListQuery) {
  const { search, sectionId, status, authorId, sortBy = "updatedAt", sortOrder = "desc", page, pageSize } = query;

  const where: Prisma.ArticleWhereInput = {
    AND: [
      articleVisibilityFilter(user),
      { revisionOfId: null }, // revisions are shown via /articles/:id/revisions, not the main list
      sectionId ? { sectionId } : {},
      status ? { status } : {},
      authorId ? { authorId } : {},
      search
        ? {
            OR: [
              { title: { contains: search, mode: "insensitive" } },
              { body: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const [total, items] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      include: ARTICLE_INCLUDE,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getArticleById(user: AuthTokenPayload, id: string) {
  const article = await prisma.article.findUnique({ where: { id }, include: ARTICLE_INCLUDE });
  if (!article) throw AppError.notFound("Article not found.");
  await assertCanViewArticle(user, article);
  return article;
}

export interface CreateArticleInput {
  title: string;
  body: string;
  sectionId: string;
  authorId?: string; // editors may author on behalf of a writer; defaults to self
}

export async function createArticle(user: AuthTokenPayload, input: CreateArticleInput) {
  const section = await prisma.section.findUnique({ where: { id: input.sectionId } });
  if (!section) throw AppError.notFound("Section not found.");
  if (section.archived) {
    throw AppError.conflict("Archived sections cannot receive new articles.");
  }

  await assertCanWriteInSection(user, input.sectionId);

  const authorId = isEditor(user) ? input.authorId ?? user.id : user.id;
  if (authorId !== user.id) {
    // Editor is creating on behalf of someone else — make sure that person
    // can actually write in this section too.
    const assigned = await prisma.sectionWriter.findUnique({
      where: { sectionId_writerId: { sectionId: input.sectionId, writerId: authorId } },
    });
    if (!assigned) {
      throw AppError.badRequest("The selected author is not assigned to this section.");
    }
  }

  const article = await prisma.$transaction(async (tx) => {
    const created = await tx.article.create({
      data: {
        title: input.title,
        body: input.body,
        sectionId: input.sectionId,
        authorId,
        status: "DRAFT",
      },
      include: ARTICLE_INCLUDE,
    });
    await logEvent(
      { articleId: created.id, type: "STATUS_CHANGE", actorId: user.id, newStatus: "DRAFT", message: "Article created." },
      tx
    );
    return created;
  });

  return article;
}

export interface UpdateArticleInput {
  title?: string;
  body?: string;
  sectionId?: string;
}

// Content may be edited while an article is in any of these statuses.
// IN_REVIEW is deliberately excluded: it's already in front of an editor,
// and PUBLISHED is handled entirely through the revision system instead.
const EDITABLE_STATUSES: ArticleStatus[] = ["DRAFT", "APPROVED", "SCHEDULED"];

export async function updateArticleContent(user: AuthTokenPayload, id: string, input: UpdateArticleInput) {
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) throw AppError.notFound("Article not found.");

  if (article.status === "PUBLISHED") {
    throw AppError.conflict("Published articles cannot be edited directly. Create a revision instead.");
  }
  if (!EDITABLE_STATUSES.includes(article.status)) {
    throw AppError.conflict(`Articles in ${article.status} cannot be edited directly.`);
  }
  if (!isEditor(user) && article.authorId !== user.id) {
    throw AppError.forbidden("You can only edit your own articles.");
  }

  if (input.sectionId && input.sectionId !== article.sectionId) {
    const section = await prisma.section.findUnique({ where: { id: input.sectionId } });
    if (!section) throw AppError.notFound("Section not found.");
    if (section.archived) throw AppError.conflict("Cannot move an article into an archived section.");
    await assertCanWriteInSection(user, input.sectionId);
  }

  // Editing the content of an Approved or Scheduled article means the
  // version an editor already signed off on no longer matches what's about
  // to publish — so the edit itself must send it back to In Review,
  // regardless of who made the edit. A future publish time from a
  // now-void schedule is cleared rather than left dangling.
  const revertsToReview = article.status === "APPROVED" || article.status === "SCHEDULED";
  const newStatus: ArticleStatus = revertsToReview ? "IN_REVIEW" : article.status;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.article.update({
      where: { id },
      data: {
        title: input.title,
        body: input.body,
        sectionId: input.sectionId,
        status: newStatus,
        ...(revertsToReview ? { publishAt: null } : {}),
      },
      include: ARTICLE_INCLUDE,
    });
    await logEvent(
      {
        articleId: id,
        type: "STATUS_CHANGE",
        actorId: user.id,
        oldStatus: article.status,
        newStatus,
        message: revertsToReview
          ? `Content edited; sent back to In Review from ${article.status}.`
          : "Article content updated.",
      },
      tx
    );
    return updated;
  });
}

export interface TransitionInput {
  action: TransitionAction;
  publishAt?: Date | null;
}

export async function transitionArticle(user: AuthTokenPayload, id: string, input: TransitionInput) {
  const article = await prisma.article.findUnique({ where: { id } });
  if (!article) throw AppError.notFound("Article not found.");

  const toStatus = validateTransition({
    action: input.action,
    currentStatus: article.status,
    actorId: user.id,
    actorRole: user.role,
    authorId: article.authorId,
    publishAt: input.publishAt ?? undefined,
  });

  return prisma.$transaction(async (tx) => {
    // If this is a revision being published, re-check the original hasn't
    // moved out of PUBLISHED (e.g. unpublished by someone else) while this
    // revision was in progress — publishing into a non-live article would
    // silently resurrect it with stale metadata.
    if (input.action === "PUBLISH" && article.revisionOfId) {
      const original = await tx.article.findUnique({ where: { id: article.revisionOfId } });
      if (!original || original.status !== "PUBLISHED") {
        throw AppError.conflict(
          "The original article is no longer published, so this revision cannot be published now."
        );
      }
    }

    const data: Prisma.ArticleUpdateInput = { status: toStatus };
    if (input.action === "SCHEDULE") data.publishAt = input.publishAt;
    if (input.action === "PUBLISH") data.publishedAt = new Date();
    if (input.action === "UNSCHEDULE") data.publishAt = null;

    const updated = await tx.article.update({ where: { id }, data, include: ARTICLE_INCLUDE });

    // If this is a revision being published, fold its content back into the
    // original published article and keep the revision's own record intact.
    if (input.action === "PUBLISH" && article.revisionOfId) {
      await tx.article.update({
        where: { id: article.revisionOfId },
        data: { title: updated.title, body: updated.body, publishedAt: new Date() },
      });
      await logEvent(
        {
          articleId: article.revisionOfId,
          type: "REVISION_PUBLISHED",
          actorId: user.id,
          message: `Revision ${article.id} published, replacing live content.`,
        },
        tx
      );
    }

    await logEvent(
      {
        articleId: id,
        type: "STATUS_CHANGE",
        actorId: user.id,
        oldStatus: article.status,
        newStatus: toStatus,
        message: `${input.action.replace(/_/g, " ").toLowerCase()}.`,
      },
      tx
    );

    return updated;
  });
}

export async function createRevision(user: AuthTokenPayload, originalId: string) {
  const original = await prisma.article.findUnique({ where: { id: originalId } });
  if (!original) throw AppError.notFound("Article not found.");
  if (original.status !== "PUBLISHED") {
    throw AppError.conflict("Revisions can only be created for published articles.");
  }
  if (!isEditor(user)) {
    const assigned = await prisma.sectionWriter.findUnique({
      where: { sectionId_writerId: { sectionId: original.sectionId, writerId: user.id } },
    });
    if (!assigned) throw AppError.forbidden("You are not assigned to this article's section.");
  }

  // Only one open (non-published) revision may exist per original at a
  // time. Without this, two people could fork the same live article into
  // diverging drafts and it would be unclear which one "wins" on publish.
  const existingOpen = await prisma.article.findFirst({
    where: { revisionOfId: originalId, status: { not: "PUBLISHED" } },
  });
  if (existingOpen) {
    throw AppError.conflict(
      "An open revision already exists for this article. Continue that revision instead of starting a new one.",
      { existingRevisionId: existingOpen.id }
    );
  }

  return prisma.$transaction(async (tx) => {
    const revision = await tx.article.create({
      data: {
        title: original.title,
        body: original.body,
        sectionId: original.sectionId,
        authorId: user.id,
        status: "DRAFT",
        revisionOfId: original.id,
      },
      include: ARTICLE_INCLUDE,
    });
    await logEvent(
      { articleId: revision.id, type: "REVISION_OPENED", actorId: user.id, newStatus: "DRAFT", message: `Revision opened for published article ${original.id}.` },
      tx
    );
    return revision;
  });
}

export async function listRevisions(user: AuthTokenPayload, originalId: string) {
  const original = await prisma.article.findUnique({ where: { id: originalId } });
  if (!original) throw AppError.notFound("Article not found.");
  await assertCanViewArticle(user, original);

  return prisma.article.findMany({
    where: { revisionOfId: originalId },
    include: ARTICLE_INCLUDE,
    orderBy: { createdAt: "desc" },
  });
}

export async function getHistory(user: AuthTokenPayload, articleId: string) {
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) throw AppError.notFound("Article not found.");
  await assertCanViewArticle(user, article);

  return prisma.articleEvent.findMany({
    where: { articleId },
    include: { actor: { select: AUTHOR_SELECT } },
    orderBy: { createdAt: "asc" },
  });
}

export interface BulkResult {
  articleId: string;
  success: boolean;
  reason?: string;
}

export async function bulkSchedule(user: AuthTokenPayload, articleIds: string[], publishAt: Date): Promise<BulkResult[]> {
  const results: BulkResult[] = [];
  for (const articleId of articleIds) {
    try {
      await transitionArticle(user, articleId, { action: "SCHEDULE", publishAt });
      results.push({ articleId, success: true });
    } catch (err) {
      results.push({ articleId, success: false, reason: err instanceof Error ? err.message : "Unknown error." });
    }
  }
  return results;
}

export async function bulkUnpublish(user: AuthTokenPayload, articleIds: string[]): Promise<BulkResult[]> {
  const results: BulkResult[] = [];
  for (const articleId of articleIds) {
    try {
      await transitionArticle(user, articleId, { action: "UNPUBLISH" });
      results.push({ articleId, success: true });
    } catch (err) {
      results.push({ articleId, success: false, reason: err instanceof Error ? err.message : "Unknown error." });
    }
  }
  return results;
}

export async function addComment(user: AuthTokenPayload, articleId: string, content: string) {
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) throw AppError.notFound("Article not found.");
  await assertCanViewArticle(user, article);

  return prisma.$transaction(async (tx) => {
    const comment = await tx.comment.create({
      data: { articleId, authorId: user.id, content },
      include: { author: { select: AUTHOR_SELECT } },
    });
    await logEvent({ articleId, type: "COMMENT", actorId: user.id, message: "Comment added." }, tx);
    return comment;
  });
}

export async function listComments(user: AuthTokenPayload, articleId: string) {
  const article = await prisma.article.findUnique({ where: { id: articleId } });
  if (!article) throw AppError.notFound("Article not found.");
  await assertCanViewArticle(user, article);

  return prisma.comment.findMany({
    where: { articleId },
    include: { author: { select: AUTHOR_SELECT } },
    orderBy: { createdAt: "asc" },
  });
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function exportCalendarCsv(): Promise<string> {
  const articles = await prisma.article.findMany({
    where: { status: { in: ["SCHEDULED", "PUBLISHED"] }, revisionOfId: null },
    include: ARTICLE_INCLUDE,
    orderBy: { publishAt: "asc" },
  });

  const header = ["Article", "Section", "Author", "Publish Time"];
  const rows = articles.map((a) => [
    a.title,
    a.section.name,
    a.author.name,
    (a.status === "PUBLISHED" ? a.publishedAt ?? a.publishAt : a.publishAt)?.toISOString() ?? "",
  ]);

  return [header, ...rows].map((row) => row.map((v) => csvEscape(String(v))).join(",")).join("\n");
}
