// src/trip/function/getFullTripByid.api.ts
import { Response } from "express";
import type { AuthenticatedRequest, Accessor } from "../../middleware/type.api";
import { getFullTrip } from "./getFullTripByid";
import { ParamSchema} from "../types/api.types"

/**
 * @function getFullTripApi
 * @description
 *  API สำหรับดึงข้อมูลทริปแบบเต็ม (Trip → Day[] → Items[Place|Note])
 *  - ตรวจสิทธิ์จาก req.auth: ผู้ใช้ทั่วไปเห็นได้เฉพาะทริปของตนเอง,
 *    ส่วน admin/staff เห็นได้ทุกทริป (ตรรกะอยู่ใน getFullTripApi)
 *  - validate path param :trip_id ด้วย Zod
 *
 * @route GET /api/v1/auth/trip/:trip_id/full
 * @returns 200 { success: true, data: Trip }
 * @returns 400 { success: false, error: "validation_error", details }
 * @returns 403 { success: false, error: "forbidden" }
 * @returns 404 { success: false, error: "trip_not_found" }
 * @returns 500 { success: false, error: "unexpected_error" }
 */
export const getFullTripApi = async (req: AuthenticatedRequest, res: Response) => {

  try {
    const { trip_id } = ParamSchema.parse(req.params);

    // 2) require auth (ชนิดของ req.auth ถูกเติมโดย middleware requireAuth)
    const accessor: Accessor = req.auth;
    if (!accessor?.username) {
      return res.status(401).json({
        success: false,
        error: "unauthorized",
      });
    }

    // 3) ดึงทริปเต็ม
    const data = await getFullTrip(accessor, trip_id);

    // 4) ตอบกลับตามโครง Trip
    return res.status(200).json({
      success: true,
      data,
    });
  } catch (err: any) {
    // จัดการ ZodError (พารามิเตอร์ไม่ถูกต้อง)
    if (err?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        details: err.issues,
      });
    }

    // จัดการ error เชิงธุรกิจจาก service
    const msg = typeof err?.message === "string" ? err.message : "unexpected_error";

    if (msg === "Access denied") {
      return res.status(403).json({
        success: false,
        error: "forbidden",
      });
    }

    if (msg === "Trip not found") {
      return res.status(404).json({
        success: false,
        error: "trip_not_found",
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
