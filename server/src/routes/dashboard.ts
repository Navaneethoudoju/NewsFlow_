import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import * as dashboardService from "../services/dashboard.service";

const router = Router();
router.use(requireAuth);

router.get("/summary", asyncHandler(async (req, res) => res.json(await dashboardService.getSummary(req.user!))));
router.get("/by-status", asyncHandler(async (req, res) => res.json(await dashboardService.getByStatus(req.user!))));
router.get("/by-section", asyncHandler(async (req, res) => res.json(await dashboardService.getBySection(req.user!))));
router.get(
  "/weekly-published",
  asyncHandler(async (req, res) => res.json(await dashboardService.getWeeklyPublished(req.user!)))
);
router.get(
  "/recent-activity",
  asyncHandler(async (req, res) => res.json(await dashboardService.getRecentActivity(req.user!)))
);
router.get(
  "/upcoming",
  asyncHandler(async (req, res) => res.json(await dashboardService.getUpcomingPublications(req.user!)))
);

export default router;
