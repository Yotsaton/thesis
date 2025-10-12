// src/recomment/functions/recommentFromProvince.api.ts
import { Response } from "express";
import { z } from "zod";
import type { AuthenticatedRequest } from "../../middleware/type.api";
import type { PlaceRecommendation } from "../types/types";
import { recommentFromProvince } from "../functions/recommentFromProvince";
import { RecommentParams, RecommentParamsSchema } from "../types/types.api";

/** util: แปลง input ให้เป็น string[] ได้ทั้ง "a,b" | ["a","b"] | "a" */
function toStringArray(input: unknown): string[] | undefined {
  if (input == null) return undefined;
  if (Array.isArray(input)) {
    return input
      .flatMap((v) => (typeof v === "string" ? v.split(",") : []))
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof input === "string") {
    return input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return undefined;
}

/**
 * API: แนะนำสถานที่จาก “จังหวัด + หมวดหมู่”
 * - method ที่แนะนำ: POST
 *   body:
 *   {
 *     "provinces": ["chiang mai", "lamphun"],     // จำเป็น
 *     "categories": ["park","museum"],            // ไม่ส่งมาก็ได้ (default = ["tourist_attraction"])
 *     "limit": 30                                 // ไม่ส่งมาก็ได้ (1..200)
 *   }
 *
 * - รองรับ GET ด้วย query string เช่น
 *   /api/recomment/from-province?provinces=bangkok&categories=park,museum&limit=20
 *
 * การคืนค่า:
 *   { success: true, data: PlaceRecommendation[], meta: {...} }
 */
export const recommentFromProvinceApi = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // 1) รวมพารามิเตอร์จากทั้ง query และ body (body มาก่อน, query เป็น fallback)
    const provinces =
      toStringArray((req.body && (req.body as any).provinces) ?? req.query.provinces);
    const categories =
      toStringArray((req.body && (req.body as any).categories) ?? req.query.categories);
    const limitRaw =
      (req.body && (req.body as any).limit) ?? req.query.limit;

    const limit =
      typeof limitRaw === "number"
        ? limitRaw
        : typeof limitRaw === "string"
        ? Number(limitRaw)
        : undefined;

    // 2) validate + ค่าเริ่มต้น
    const params: RecommentParams = RecommentParamsSchema.parse({
      provinces,
      categories,
      limit,
    });

    // 3) เรียก service
    const data: PlaceRecommendation[] = await recommentFromProvince(
      params.provinces,
      params.categories,
      params.limit
    );

    // 4) ตอบผลลัพธ์
    return res.status(200).json({
      success: true,
      data,
      meta: {
        count: data.length,
        provinces: params.provinces,
        categories: params.categories,
        limit: params.limit,
      },
    });
  } catch (err: any) {
    // Zod validate ผิด -> 400
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "invalid_params",
        details: err.flatten(),
      });
    }

    // อื่น ๆ -> 500
    const msg = err?.message || String(err);
    console.error("[recommentFromProvinceApi] error:", err);
    return res.status(500).json({
      success: false,
      error: "unexpected_error",
      message: msg,
    });
  }
};
