// ./src/api/route.api.ts
import { Router } from "express";
import {requireAuth} from '../middleware/requireAuth'
import { withAuth } from "../middleware/withAuth";
import { activityLogger } from "../middleware/activityLogger";
import { getRouteapi, getTSPWithRouteapi} from '../Route/index';

const router = Router();

// GET /api/v1/auth/route/
router.post("/", requireAuth,
  activityLogger(() => ({ action: 'get_route' })),
  withAuth(getRouteapi as any));

// GET /api/v1/auth/route/withTSP
router.post("/withTSP", requireAuth,
  activityLogger(() => ({ action: 'get_tsp_with_route' })),
  withAuth(getTSPWithRouteapi as any));

export default router;