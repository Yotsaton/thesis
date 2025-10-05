// src/trip/function/updateTrip.api.ts
import { Response } from "express";
import type { AuthenticatedRequest } from "../../middleware/type.api";
import { ParamSchema, TripPayloadSchema } from "../types/api.types";
import { updateTripDeep } from "./updateTrip";
import { Trip } from "../types/types";

export const updateTripDeepApi = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.auth?.username) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }
    const { trip_id } = ParamSchema.parse(req.params);
    if (!trip_id) {
      return res.status(400).json({ success: false, error: "trip_id_required" });
    }

    // validate แบบหลวม ๆ ด้วย Zod (หรือจะใช้ schema ที่คุณมีอยู่ก็ได้)
    const parse = TripPayloadSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({
        success: false,
        error: "invalid_payload",
        message: parse.error.issues.map(e => e.message).join("; "),
      });
    }

    const full = await updateTripDeep(req.auth, trip_id, parse.data as Trip);
    return res.status(200).json({ success: true, data: full });
  } catch (err: any) {
    const msg = err?.message || String(err);

    // map conflict ให้เป็น 409
    if (err?.code === "trip_conflict" || err?.code === "day_conflict" || err?.code === "route_conflict") {
      return res.status(409).json({
        success: false,
        error: err.code,
        message: msg,
        details: err.details || null,
      });
    }

    if (msg === "forbidden") {
      return res.status(403).json({ success: false, error: "forbidden" });
    }
    if (msg === "trip_not_found") {
      return res.status(404).json({ success: false, error: "trip_not_found" });
    }
    if (msg === "place_input_missing_place_id_or_location") {
      return res.status(400).json({ success: false, error: "place_input_missing_place_id_or_location" });
    }
    if (msg === "place_not_found_from_process") {
      return res.status(404).json({ success: false, error: "place_not_found_from_process" });
    }

    // อื่น ๆ
    return res.status(500).json({
      success: false,
      error: "unexpected_error",
      message: msg,
    });
  }
};
