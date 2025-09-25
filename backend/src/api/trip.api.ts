// src/api/trip.api.ts
import { Router, Request, Response } from "express";
import {requireAuth} from '../middleware/requireAuth'
import { withAuth } from "../middleware/withAuth";
import { createTripapi, getTripsapi, updateTripapi, deleteTripapi} from '../trip/index';


const router = Router();

// POST /api/v1/auth/trip
router.post('/create', requireAuth, withAuth(createTripapi as any));

// GET /api/v1/auth/trip
router.get("/get",requireAuth, withAuth(getTripsapi as any))

// POST /api/v1/auth/trip
router.patch("/update/:trip_id",requireAuth, withAuth(updateTripapi as any))

// DELETE /api/v1/auth/trip
router.delete("/delete/:trip_id", requireAuth, withAuth(deleteTripapi as any))

export default router;
