// ./src/api/route.api.ts
import { Router } from "express";
import {requireAuth} from '../middleware/requireAuth'
import { withAuth } from "../middleware/withAuth";
import { getRouteapi, getTSPWithRouteapi} from '../Route/index';


const router = Router();

// GET /api/v1/auth/route
router.post("/", requireAuth, withAuth(getRouteapi as any));

// GET /api/v1/auth/route
// router.post("/withTSP", requireAuth, withAuth(getTSPWithRouteapi as any));

//ทดสอบไม่ใช้ requireAuth, withAuth
router.post("/withTSP",getTSPWithRouteapi);

export default router;