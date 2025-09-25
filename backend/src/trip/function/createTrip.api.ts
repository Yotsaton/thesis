// src/trip/routes/trip.router.ts
import {type Request, type Response } from "express";
import {CreateTripBody, type AuthenticatedRequest} from "../types/api.type"
import { createTrip } from "../function/createTrip";
import type { Accessor } from "../types/type";
import { success } from "zod";


export const createTripapi = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = CreateTripBody.parse(req.body);

    // ยึด username จาก token เสมอ
    const username = req.auth.username;

    const trip = await createTrip({
      username,
      header: parsed.header ?? null,
      start_plan: parsed.start_plan,
      end_plan: parsed.end_plan,
    });

    return res.status(201).json({ 
      success: true,
      data: trip 
    });
  } catch (err: any) {
    // จัดการ error ที่มาจาก zod หรือจากฟังก์ชัน createTrip
    if (err?.name === "ZodError") {
      return res.status(400).json({
        success: false,
        error: "validation_error",
        details: err.issues,
      });
    }

    // โยนข้อความที่เราจัดไว้ใน createTrip.ts (เช็ค constraint/ FK ฯลฯ)
    const msg = typeof err?.message === "string" ? err.message : "unexpected_error";
    const status =
      msg.includes("ไม่พบ username") ? 404 :
      msg.includes("ต้องไม่น้อยกว่า start_plan") ? 400 :
      msg.includes("ข้อมูลไม่ผ่านเงื่อนไขของตาราง") ? 400 :
      500;

    return res.status(status).json({ 
      success: false,
      error: msg });
  }
};

