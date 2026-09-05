import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth";
import { validate } from "../lib/validate";
import { asyncHandler } from "../lib/asyncHandler";
import * as sectionService from "../services/section.service";

const router = Router();
router.use(requireAuth);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const includeArchived = req.query.includeArchived !== "false";
    const sections = await sectionService.listSections(req.user!, includeArchived);
    res.json(sections);
  })
);

router.get(
  "/writers",
  requireRole("EDITOR"),
  asyncHandler(async (_req, res) => {
    res.json(await sectionService.listWriters());
  })
);

router.get(
  "/editors",
  requireRole("EDITOR"),
  asyncHandler(async (_req, res) => {
    res.json(await sectionService.listEditors());
  })
);

router.get(
  "/:id",
  asyncHandler(async (req, res) => {
    res.json(await sectionService.getSection(req.params.id));
  })
);

const sectionSchema = z.object({
  name: z.string().min(1, "Name is required.").max(120),
  description: z.string().min(1, "Description is required.").max(2000),
  ownerEditorId: z.string().optional(),
});

router.post(
  "/",
  requireRole("EDITOR"),
  validate(sectionSchema),
  asyncHandler(async (req, res) => {
    const section = await sectionService.createSection(req.user!, req.body);
    res.status(201).json(section);
  })
);

router.patch(
  "/:id",
  requireRole("EDITOR"),
  validate(sectionSchema.partial()),
  asyncHandler(async (req, res) => {
    res.json(await sectionService.updateSection(req.params.id, req.body));
  })
);

router.post(
  "/:id/archive",
  requireRole("EDITOR"),
  asyncHandler(async (req, res) => {
    res.json(await sectionService.setSectionArchived(req.params.id, true));
  })
);

router.post(
  "/:id/restore",
  requireRole("EDITOR"),
  asyncHandler(async (req, res) => {
    res.json(await sectionService.setSectionArchived(req.params.id, false));
  })
);

const writerSchema = z.object({ writerId: z.string().min(1) });

router.post(
  "/:id/writers",
  requireRole("EDITOR"),
  validate(writerSchema),
  asyncHandler(async (req, res) => {
    res.json(await sectionService.assignWriter(req.params.id, req.body.writerId));
  })
);

router.delete(
  "/:id/writers/:writerId",
  requireRole("EDITOR"),
  asyncHandler(async (req, res) => {
    res.json(await sectionService.removeWriter(req.params.id, req.params.writerId));
  })
);

export default router;
