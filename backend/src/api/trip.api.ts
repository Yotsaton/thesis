// .src/api/trip.api.ts
import { Router } from "express";
import {requireAuth} from '../middleware/requireAuth'
import { withAuth } from "../middleware/withAuth";
import { createTripApi, getTripsapi, updateTripDeepApi, deleteTripSoftApi,
  getFullTripApi
} from '../trip/index';

const router = Router();

// POST /api/v1/auth/trip
router.post('/full', requireAuth, withAuth(createTripApi as any));

// GET /api/v1/auth/trip
router.get("/",requireAuth, withAuth(getTripsapi as any))

// GET /api/v1/auth/trip
router.get("/:trip_id/full",requireAuth, withAuth(getFullTripApi as any))

// PUT /api/v1/auth/trip
router.put("/:trip_id/full",requireAuth, withAuth(updateTripDeepApi as any))

// DELETE /api/v1/auth/trip
router.delete("/:trip_id", requireAuth, withAuth(deleteTripSoftApi as any))


export default router;
