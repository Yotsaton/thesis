// src/trip/api.ts

import {Request,Response} from "express"
import {createTrip,getTrips,deleteMyTrip,updateMyTrip} from "../index"
import { toDateOnly } from "./toDateOnly"
import {CreateTripBodySchema, GetTripsQuerySchema, TripRow, GetTripsServiceResult} from "../types/api.type"
import {z} from "zod"

export const createMyTrip = async (req: Request, res: Response) =>{
  try {
    // 1) ตรวจ/แปลง input ด้วย zod
    const parsed = CreateTripBodySchema.parse(req.body);

    // 2) ดึง username จาก token (กำหนดโดย requireAuth ของคุณ)
    const username = req.auth?.username;
    if (!username) {
      return res.status(401).json({ error: "unauthorized" });
    }

    // 3) แปลงวันที่ให้เป็น date-only "YYYY-MM-DD" ตามที่ DB คาดหวัง (start_plan/end_plan เป็น DATE)
    const startDateOnly = toDateOnly(parsed.start_plan); // => "YYYY-MM-DD"
    const endDateOnly = toDateOnly(parsed.end_plan);     // => "YYYY-MM-DD"

    // 4) เรียกใช้ฟังก์ชัน createTrip (ปรับพารามิเตอร์ให้ตรงกับลายเซ็นในไฟล์ของคุณ)
    //    จากคุยก่อนหน้า มักรับ: username, header, start_plan, end_plan, (status optional)
    const trip = await createTrip({
      username,
      header: parsed.header,
      start_plan: startDateOnly,
      end_plan: endDateOnly,
    });

    return res.status(201).json(trip);
  } catch (err: any) {
    // จัดการ error จาก zod และ error อื่นๆ
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: "validation_error",
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }

    // ถ้าเป็น error ที่ตั้งใจโยนออกมาจากชั้น service/DB
    if (err?.code === "23505") {
      // ตัวอย่าง: unique_violation ของ trip_id
      return res.status(409).json({ error: "duplicate", code: err.code, detail: err.detail });
    }

    console.error("[createTrip] unexpected error:", err);
    return res.status(500).json({ error: "internal_server_error" });
  }
}

export const getMyTrip = async (req: Request, res: Response) => {
  try {
    // 1) parse & validate query
    const q = GetTripsQuerySchema.parse(req.query);

    // 2) auth
    const username = req.auth?.username;
    if (!username) {
      return res.status(401).json({ error: "unauthorized" });
    }

    // 3) คำนวณช่วงวันที่แบบ date-only string ให้คงที่
    const fromDateOnly = q.from ? toDateOnly(q.from) : undefined; // "YYYY-MM-DD"
    const toDateOnlyStr = q.to ? toDateOnly(q.to) : undefined;

    // 4) สร้างพารามิเตอร์สำหรับชั้น service (getTrips.ts)
    //    - เผื่อฟังก์ชันของคุณรองรับ offset/limit/sort
    const offset = (q.page - 1) * q.limit;

    const serviceParams: Record<string, unknown> = {
      username,
      status: q.status ?? undefined,
      from: fromDateOnly,
      to: toDateOnlyStr,
      // เผื่อมีการรองรับใน getTrips.ts
      offset,
      limit: q.limit,
      sort: q.sort,
      order: q.order,
    };

    // 5) เรียก service
    const result: GetTripsServiceResult = await (getTrips as any)(serviceParams);

    // 6) ทำให้เป็นรูปแบบตอบกลับมาตรฐานเสมอ
    let rows: TripRow[];
    let total: number | undefined;
    let page = q.page;
    let limit = q.limit;

    if (Array.isArray(result)) {
      // กรณี service คืนมาเป็น array เฉย ๆ
      total = result.length;
      // ตัดหน้าเอง (fallback) — ป้องกัน memory ถ้าข้อมลเยอะ ควรให้ service ทำที่ DB
      rows = result.slice(offset, offset + q.limit).map(normalizeTripRowDates);
    } else {
      // กรณี service มีเมทาดาต้า
      rows = (result.rows ?? []).map(normalizeTripRowDates);
      total = result.total ?? rows.length;
      page = result.page ?? page;
      limit = result.limit ?? limit;
    }

    return res.status(200).json({
      page,
      limit,
      total,
      items: rows,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: "validation_error",
        details: err.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    console.error("[getTrips] unexpected error:", err);
    return res.status(500).json({ error: "internal_server_error" });
  }
});