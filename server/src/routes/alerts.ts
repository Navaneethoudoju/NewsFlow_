import { Router } from "express";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../lib/asyncHandler";
import * as alertsService from "../services/alerts.service";

const router = Router();
router.use(requireAuth, requireRole("EDITOR"));

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    const alerts = await alertsService.listOverdueAlerts();
    res.json({ count: alerts.length, alerts });
  })
);

router.post(
  "/:articleId/dismiss",
  asyncHandler(async (req, res) => {
    await alertsService.dismissAlert(req.user!, req.params.articleId);
    res.status(204).send();
  })
);

export default router;
