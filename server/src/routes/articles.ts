import { Router } from "express";
import { z } from "zod";
import { requireAuth } from "../middleware/auth";
import { validate } from "../lib/validate";
import { asyncHandler } from "../lib/asyncHandler";
import { AppError } from "../lib/errors";
import * as articleService from "../services/article.service";

const router = Router();
router.use(requireAuth);

const STATUS_VALUES = ["DRAFT", "IN_REVIEW", "APPROVED", "SCHEDULED", "PUBLISHED"] as const;

const listQuerySchema = z.object({
  search: z.string().trim().max(200).optional(),
  sectionId: z.string().optional(),
  status: z.enum(STATUS_VALUES).optional(),
  authorId: z.string().optional(),
  sortBy: z.enum(["updatedAt", "createdAt", "status", "publishAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// --- Fixed-path routes must come before "/:id" so they aren't swallowed. ---

router.get(
  "/export/calendar.csv",
  asyncHandler(async (_req, res) => {
    const csv = await articleService.exportCalendarCsv();
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="editorial-calendar.csv"');
    res.send(csv);
  })
);

const bulkScheduleSchema = z.object({
  articleIds: z.array(z.string()).min(1, "Select at least one article."),
  publishAt: z.coerce.date(),
});

router.post(
  "/bulk/schedule",
  validate(bulkScheduleSchema),
  asyncHandler(async (req, res) => {
    const results = await articleService.bulkSchedule(req.user!, req.body.articleIds, req.body.publishAt);
    res.json({ results });
  })
);

const bulkIdsSchema = z.object({ articleIds: z.array(z.string()).min(1, "Select at least one article.") });

router.post(
  "/bulk/unpublish",
  validate(bulkIdsSchema),
  asyncHandler(async (req, res) => {
    const results = await articleService.bulkUnpublish(req.user!, req.body.articleIds);
    res.json({ results });
  })
);

router.get(
  "/",
  validate(listQuerySchema, "query"),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuerySchema>;
    res.json(await articleService.listArticles(req.user!, q));
  })
);

const createSchema = z.object({
  title: z.string().min(1, "Title is required.").max(300),
  body: z.string().min(1, "Content is required.").max(200_000),
  sectionId: z.string().min(1, "Section is required."),
  authorId: z.string().optional(),
});

router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const article = await articleService.createArticle(req.user!, req.body);
    res.status(201).json(article);
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await articleService.getArticleById(req.user!, req.params.id));
  })
);

const updateSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  body: z.string().min(1).max(200_000).optional(),
  sectionId: z.string().optional(),
});

router.patch(
  "/:id",
  validate(updateSchema),
  asyncHandler(async (req, res) => {
    res.json(await articleService.updateArticleContent(req.user!, req.params.id, req.body));
  })
);

const ACTION_VALUES = [
  "SUBMIT_FOR_REVIEW",
  "SEND_BACK_TO_DRAFT",
  "APPROVE",
  "SCHEDULE",
  "PUBLISH",
  "UNSCHEDULE",
  "UNPUBLISH",
] as const;

const transitionSchema = z
  .object({
    action: z.enum(ACTION_VALUES),
    publishAt: z.coerce.date().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "SCHEDULE" && !data.publishAt) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "publishAt is required to schedule an article.", path: ["publishAt"] });
    }
  });

router.post(
  "/:id/transition",
  validate(transitionSchema),
  asyncHandler(async (req, res) => {
    res.json(await articleService.transitionArticle(req.user!, req.params.id, req.body));
  })
);

router.post(
  "/:id/revisions",
  asyncHandler(async (req, res) => {
    const revision = await articleService.createRevision(req.user!, req.params.id);
    res.status(201).json(revision);
  })
);

router.get(
  "/:id/revisions",
  asyncHandler(async (req, res) => {
    res.json(await articleService.listRevisions(req.user!, req.params.id));
  })
);

router.get(
  "/:id/history",
  asyncHandler(async (req, res) => {
    res.json(await articleService.getHistory(req.user!, req.params.id));
  })
);

const commentSchema = z.object({ content: z.string().min(1, "Comment cannot be empty.").max(5000) });

router.get(
  "/:id/comments",
  asyncHandler(async (req, res) => {
    res.json(await articleService.listComments(req.user!, req.params.id));
  })
);

router.post(
  "/:id/comments",
  validate(commentSchema),
  asyncHandler(async (req, res) => {
    const comment = await articleService.addComment(req.user!, req.params.id, req.body.content);
    res.status(201).json(comment);
  })
);

router.delete(
  "/:id",
  asyncHandler(async () => {
    throw AppError.badRequest("Articles cannot be permanently deleted; unpublish or archive the section instead.");
  })
);

export default router;
