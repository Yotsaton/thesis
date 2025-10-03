// src/trip/function/createTrip.api.ts
import { Response } from "express";
import type { AuthenticatedRequest, Accessor } from "../../middleware/type.api";
import { createTrip } from "./createTrip";
import { TripPayloadSchema } from "../types/api.types";

/**
 * @route POST /api/v1/auth/trip/full
 * @summary สร้างทริปแบบ Deep (Trip → Day[] → Items[place|note]) แล้วคืน Trip พร้อม id ทุกระดับ
 *
 * ### Request Auth
 * - ต้องผ่าน middleware `requireAuth` มาก่อน
 * - ต้องมี `req.auth.username` (บ่งบอกผู้สร้างทริป)
 *
 * ### Request Body (สรุป)
 * {
 *   "name": "Tokyo Food Trip",
 *   "start_plan": "2025-10-10",
 *   "end_plan": "2025-10-12",
 *   "days": [
 *     {
 *       "date": "2025-10-10",
 *       "subheading": "Day 1",
 *       "items": [
 *         { "type": "place", "place_id_by_ggm": "ChIJxxxxxxxxx", "startTime": "09:00", "endTime": "10:00" },
 *         { "type": "note", "text": "จองร้านซูชิ" }
 *       ]
 *     }
 *   ]
 * }
 *
 * ### Response (200/201)
 * {
 *   "success": true,
 *   "data": { Trip ... } // ตาม type.ts ของคุณ, มี id ทุกระดับจาก DB
 * }
 *
 * ### Error
 * - 401 unauthorized — ไม่พบ `req.auth.username`
 * - 400 validation_error — body ไม่ผ่าน schema
 * - 400 place_id_required — มี item.type="place" ที่ไม่มี `place_id_by_ggm` และหาใน DB ไม่เจอ
 * - 500 unexpected_error — กรณีอื่น ๆ
 */
export const createTripApi = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1) auth
    const accessor: Accessor | undefined = req.auth;
    if (!accessor?.username) {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }

    // 2) validate body (แบบหลวม ๆ)
    const payload = TripPayloadSchema.parse(req.body);

    // 3) เรียก service เพื่อสร้างทริป (DB จะ gen id/created_at เอง)
    const data = await createTrip(accessor, payload as any);

    // 4) ส่งคืนผลลัพธ์ Trip ที่มี id ครบทุกระดับ
    return res.status(201).json({ success: true, data });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        details: err.issues,
      });
    }

    const msg = typeof err?.message === "string" ? err.message : "unexpected_error";

    // mapping ข้อผิดพลาดที่ service อาจโยน
    if (msg === "unauthorized") {
      return res.status(401).json({ success: false, error: "unauthorized" });
    }
    if (msg === "place_id_required") {
      // บังคับให้ client ส่ง Google place_id เมื่อเป็น item แบบ place
      return res.status(400).json({
        success: false,
        error: "place_id_required",
        message: "Place items must include `place_id_by_ggm` (Google Place ID).",
      });
    }
    if (msg.startsWith("place_resolution_failed_at_item_")) {
      return res.status(400).json({
        success: false,
        error: "place_resolution_failed",
        message: msg,
      });
    }

    // อื่น ๆ
    return res.status(500).json({
      success: false,
      error: "unexpected_error",
      message: msg,
    });
  }
};
