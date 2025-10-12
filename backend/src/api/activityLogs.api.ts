// src/activity/api/getActivityLogs.api.ts

import { Router } from "express";
import { getActivityLogsApi } from "../activity/api/getActivityLogs.api";
import { requireAuth } from "../middleware/requireAuth";
import { activityLogger } from "../middleware/activityLogger";

const router = Router();

// GET /api/v1/auth/activity/logs
router.get("/logs", requireAuth,
  activityLogger(
    () => "Viewed activity logs", 
    (req) => (req as any).auth?.username
  ),
  getActivityLogsApi
);

export default router;