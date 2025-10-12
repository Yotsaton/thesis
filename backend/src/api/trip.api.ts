// .src/api/trip.api.ts
import { Router } from "express";
import {requireAuth} from '../middleware/requireAuth'
import { withAuth } from "../middleware/withAuth";
import { activityLogger } from "../middleware/activityLogger";
import { createTripApi, getTripsapi, updateTripDeepApi, deleteTripSoftApi,
  getFullTripApi
} from '../trip/index';

const router = Router();

// POST /api/v1/auth/trip/full
router.post('/full', requireAuth, 
  activityLogger(() => ({ action: 'create_trip' })),
  withAuth(createTripApi as any));

// GET /api/v1/auth/trip/
router.get("/",requireAuth,
  activityLogger(() => ({ action: 'get_trips_list' })),
  withAuth(getTripsapi as any))

// GET /api/v1/auth/trip/:trip_id/full
router.get("/:trip_id/full",requireAuth,
  activityLogger(() => ({ action: 'get_full_trip' })),
  withAuth(getFullTripApi as any))

// PUT /api/v1/auth/trip/:trip_id/full
router.put("/:trip_id/full",requireAuth,
  activityLogger(() => ({ action: 'update_trip' })),
  withAuth(updateTripDeepApi as any))

// DELETE /api/v1/auth/trip/:trip_id
router.delete("/:trip_id", requireAuth,
  activityLogger(() => ({ action: 'delete_trip' })),
  withAuth(deleteTripSoftApi as any))


export default router;
