// ./src/api/route.api.ts
import { Router } from "express";
import {requireAuth} from '../middleware/requireAuth'
import { withAuth } from "../middleware/withAuth";
import { getRouteapi, getTSPWithRouteapi} from '../Route/index';


const router = Router();

// GET /api/v1/auth/route
router.get("/", requireAuth, withAuth(getRouteapi as any));

// GET /api/v1/auth/route/:route_id
router.get("/withTSP", requireAuth, withAuth(getTSPWithRouteapi as any));

export default router;