// src/trip/function/updateTrip.api.ts
import { type RequestHandler } from "express";
import {type AuthenticatedRequest} from "../../middleware/type.api";
import { ParamSchema, UpdateBodySchema } from "../types/api.types";
import { updateMyTrip } from "../function/updateTrip"; // ← ใช้ฟังก์ชันที่คุณมีอยู่
import { UpdateOptions } from "../types/types";

// -------- Handler --------

/**
 * อัปเดตทริปของผู้ใช้ที่ล็อกอิน (partial update)
 * body = {
 *   updated_at: Date,       // เวลาที่ดึงข้อมูลล่าสุด (สำหรับตรวจสอบ concurrency)
 *   header?: string,
 *   status?: string,
 *   start_plan?: Date,
 *   end_plan?: Date,
 * }
 * - ใช้สิทธิ์จาก req.auth (requireAuth ต้องมาก่อน)
 * - ใช้ updateMyTrip(auth, { trip_id, ...fields })
 */
export const updateTripapi: RequestHandler = async (req, res) => {
  try {
    const auth = (req as AuthenticatedRequest).auth!; // requireAuth มาก่อนแล้ว
    const { trip_id } = ParamSchema.parse(req.params);
    const parsed = UpdateBodySchema.parse(req.body);

    const { updated_at, header, status, start_plan, end_plan } = parsed;

    // แยกส่วน options ออกมาตามข้อกำหนดใหม่ (ต้องส่งเสมอ)
    const options: UpdateOptions = { ifMatchUpdatedAt: updated_at };

    // เรียก service/DAO: อัปเดตเฉพาะฟิลด์ที่มีมา
    const updated = await updateMyTrip(
      auth,
      trip_id,
      {
        ...(header !== undefined ? { header } : {}),
        ...(status !== undefined ? { status } : {}),
        ...(start_plan !== undefined ? { start_plan } : {}),
        ...(end_plan !== undefined ? { end_plan } : {}),
      },
      options // ← ส่ง UpdateOptions แยกอาร์กิวเมนต์
    );

    return res.status(200).json({ 
      success: true,
      data: updated 
    });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ 
        success: false,
        error: "validation_error", 
        details: err.issues 
      });
    }
    const msg = String(err?.message ?? "unexpected_error");
    const status =
      /not\s*found|ไม่มี|ไม่พบ/i.test(msg) ? 404 :
      /forbidden|สิทธิ์|ไม่ได้รับอนุญาต/i.test(msg) ? 403 :
      /conflict|version|updated_at|concurrency|precondition/i.test(msg) ? 409 : // เผื่อกรณีเวอร์ชันไม่ตรง
      /constraint|check|date|range|invalid|ไม่ถูกต้อง/i.test(msg) ? 400 :
      500;

    return res.status(status).json({ 
      success: false,
      error: msg 
    });
  }
};