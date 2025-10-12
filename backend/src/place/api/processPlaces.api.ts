// src/place/api/processPlace.api.ts
import 'dotenv/config'
import type { Request, Response } from "express";
import type { ResolveInput } from "../types/types";
import { processPlaces } from "../functions/processPlaces";
import { ResolveInputSchema, ResolveInputDTO} from "../types/api.types"

/**
 * POST /api/v1/place/process
 *
 * Resolve ข้อมูลสถานที่จาก Google Place ID หรือจากพิกัด (ค้นหาเฉพาะใน DB)
 * แล้วทำ upsert ลงตาราง `public.place` คืนค่าแถว place ที่มี `id` เสมอ
 *
 * พฤติกรรมโดยสรุป (อ้างอิง service `processPlaces`):
 *  - หากมี place_id_by_ggm:
 *      1) ลองหาใน DB
 *      2) ถ้าไม่เจอ → เรียก Google Place Details → insert
 *      3) ถ้าเจอและข้อมูลเก่าเกินกำหนด → เรียก Google → update
 *      4) ถ้าเจอและยังไม่เก่า → คืนค่าจาก DB
 *  - หากไม่มี place_id_by_ggm แต่ส่ง location มา:
 *      - จะค้นหา “เฉพาะใน DB” (เช็คใกล้เคียง) ถ้าไม่พบ → สร้าง record จากพิกัดเปล่า
 *
 * Auth:
 *  - ต้องแนบ access token (ผ่าน middleware withAuth)
 *
 * Env ที่ต้องมี:
 *  - GOOGLE_PLACES_API_KEY: string
 *
 * ตัวอย่างคำขอ:
 *  curl -X POST https://your.api/api/v1/place/process \
 *    -H "Content-Type: application/json" \
 *    -H "Cookie: access_token=YOUR_TOKEN" \
 *    -d '{"place_id_by_ggm":"ChIJN1t_tDeuEmsRUsoyG83frY4"}'
 *
 * หรือ
 *  -d '{"location":{"type":"Point","coordinates":[100.5018,13.7563]}}'
 */
export const processPlace = async (req: Request, res: Response) => {
  // 1) validate body
  const parsed = ResolveInputSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: "invalid_body",
      details: parsed.error.flatten(),
    });
  }
  const input: ResolveInputDTO = parsed.data;
  const inputToFn: ResolveInput = {
    place_id_by_ggm: input.place_id,
    location: input.location,
  }
  // 2) read API key for Google Places
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) {
    // ให้ชัดเจนเมื่อ env ไม่พร้อม
    return res.status(500).json({
      success: false,
      error: "server_misconfigured",
      message: "missing GOOGLE_PLACES_API_KEY",
    });
  }

  // 3) call service
  try {
    const place = await processPlaces(apiKey, inputToFn);
    // หมายเหตุ: service คืน type place (จาก database.types.ts)
    return res.status(200).json({ success: true, place });
  } catch (e: unknown) {
    const msg =
      e instanceof Error ? e.message : typeof e === "string" ? e : "unknown";
    // map ข้อความ error บางอันให้เป็นสถานะที่เหมาะสม
    if (msg === "place_id_required") {
      return res
        .status(400)
        .json({ success: false, error: "place_id_required", message: "ต้องส่ง place_id_by_ggm หรือ location" });
    }
    if (msg === "missing_google_places_api_key") {
      return res.status(500).json({
        success: false,
        error: "server_misconfigured",
        message: "missing GOOGLE_PLACES_API_KEY",
      });
    }
    return res.status(500).json({ success: false, error: "internal_error", message: msg });
  }
};


export default processPlace;
