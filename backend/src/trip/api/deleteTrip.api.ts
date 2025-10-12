// src/trip/function/deleteTrip.api.ts
import type { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/type.api";
import { deleteTripSoft } from "../function/deleteTrip";
import { ParamSchema, DeleteBodySchema} from "../types/api.types"

export const deleteTripSoftApi = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.auth?.username) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }
    
    const { trip_id } = ParamSchema.parse(req.params);

    const payload = DeleteBodySchema.safeParse(req.body);
    if (!payload.success) {
      return res.status(422).json({ success: false, error: "invalid_payload", details: payload.error.issues });
    }

    const updatedAt = payload.data.updated_at;

    const result = await deleteTripSoft(req.auth, trip_id, { ifMatchUpdatedAt: updatedAt });
    return res.status(200).json({ success: true, data: result });
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (err?.code === "trip_conflict") {
      return res.status(409).json({ success: false, error: "trip_conflict", details: err.details || null });
    }
    if (msg === "trip_not_found") {
      return res.status(404).json({ success: false, error: "trip_not_found" });
    }
    if (msg === "forbidden") {
      return res.status(403).json({ success: false, error: "forbidden" });
    }
    if (msg === "unauthorized") {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }
    return res.status(500).json({ success: false, error: "unexpected_error", message: msg });
  }
};
