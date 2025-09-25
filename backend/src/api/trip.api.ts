// src/api/trip.api.ts
import { Router, Request, Response } from "express";
import {requireAuth} from '../middleware/requireAuth'
import { withAuth } from "../middleware/withAuth";
import { createTripapi, getTripsapi, updateTripapi, deleteTripapi, 
         getTripApi 
} from '../trip/index';


const router = Router();

// POST /api/v1/auth/trip
router.post('/create', requireAuth, withAuth(createTripapi as any));

// GET /api/v1/auth/trip/
router.get("/",requireAuth, withAuth(getTripsapi as any))

// GET /api/v1/auth/trip/:trip_id
router.get("/:trip_id",requireAuth, withAuth(getTripApi as any))

// PATCH /api/v1/auth/trip
router.patch("/:trip_id",requireAuth, withAuth(updateTripapi as any))

// DELETE /api/v1/auth/trip
router.delete("/:trip_id", requireAuth, withAuth(deleteTripapi as any))

export default router;
