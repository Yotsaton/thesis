// src/api/cProject.api.ts
import { Router, Request, Response } from "express";
import {requireAuth} from '../middleware/requireAuth'
import { withAuth } from "../middleware/withAuth";
import { createTripapi,getTripsapi} from '../trip/index';


const router = Router();

// POST /api/v1/auth/trip
router.post('/create', requireAuth, withAuth(createTripapi as any));

// POST /api/v1/auth/trip
router.get("/get",requireAuth, withAuth(getTripsapi as any))

export default router;
