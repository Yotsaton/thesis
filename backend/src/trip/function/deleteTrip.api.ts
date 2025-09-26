// src/trip/function/deleteTrip.api.ts
import { type RequestHandler } from "express";
import {type AuthenticatedRequest} from "../../middleware/type.api";
import { ParamSchema, DeleteBodySchema } from "../types/api.type";
import { deleteMyTrip } from "../function/deleteTrip"; // ← ฟังก์ชันใน deleteTrip.ts
import type { UpdateOptions } from "../types/type";

/**
 * DELETE /api/v1/auth/trip/delete/:trip_id
 * ลบทริปของผู้ใช้ที่ล็อกอิน
 * - ยึดสิทธิ์จาก req.auth (ต้องผ่าน requireAuth ก่อน)
 * - ถ้าส่ง updated_at มาด้วย จะถูกแมปเป็น ifMatchUpdatedAt เพื่อทำ optimistic concurrency
 */
export const deleteTripapi: RequestHandler = async (req, res) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!;
    const { trip_id } = ParamSchema.parse(req.params);
    const { updated_at } = DeleteBodySchema.parse(req.body);

    const options: UpdateOptions = { ifMatchUpdatedAt: updated_at };

    // สมมุติว่าฟังก์ชันคืนค่าเป็นแถวที่ถูกลบ หรือ boolean/rowCount
    const result = await deleteMyTrip(auth, trip_id, options);

    // รองรับหลายรูปแบบผลลัพธ์
    const deleted =
      typeof result === "boolean"
        ? result
        : Array.isArray(result)
        ? result[0] ?? null
        : typeof result === "number"
        ? result > 0
        : result ?? null;

    if (!deleted) {
      // เคสไม่พบ/สิทธิ์ไม่พอ/if-match ไม่ตรง
      return res.status(404).json({
        success: false,
        error: "ไม่พบทริป หรือคุณไม่มีสิทธิ์ / ข้อมูลไม่ทันสมัย (updated_at ไม่ตรง)",
      });
    }

    // ถ้าอยากได้ 204 ไม่มี body ก็เปลี่ยนเป็น res.status(204).end()
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ success: false, error: "validation_error", details: err.issues });
    }
    const msg = String(err?.message ?? "unexpected_error");
    const status =
      /forbidden|สิทธิ์|ไม่ได้รับอนุญาต/i.test(msg) ? 403 :
      /not\s*found|ไม่พบ|stale|updated_at|concurrency|precondition/i.test(msg) ? 409 :
      500;

    return res.status(status).json({ success: false, error: msg });
  }
};
