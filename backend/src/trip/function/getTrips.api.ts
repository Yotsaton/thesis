// src/trip/function/getTrip.api.ts
import {type Response } from "express";
import {AuthenticatedRequest, ListQuerySchema, type ListQueryParsed} from "../types/api.type";
import { getTrips } from "./getTrips";
import { Accessor, ListTripsOptions } from "../types/type";
import { success } from "zod";

/**
 * GET /api/v1/trips
 * ดึงรายการทริปของผู้ใช้ที่ล็อกอิน (ยึด username จาก req.auth)
 * ถ้าเป็น admin สามารถระบุ ?username=alice หรือ ?username=alice,bob เพื่อค้นหาได้
 */
export const getTripsapi = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed: ListQueryParsed = ListQuerySchema.parse(req.query);
    const auth: Accessor = req.auth;

    const {
      q,
      status,
      from,
      to,
      orderBy,
      direction,
      limit,
      offset,
      page,
      page_size,
      usernames: parsedUsernames,
    } = parsed;

    const isAdmin = !!(auth.is_super_user || auth.is_staff_user);

    // ถ้าไม่ใช่ admin → จำกัดที่ตัวเองเท่านั้น
    // ถ้าเป็น admin และมี parsedUsernames → ใช้ที่ส่งมา, ถ้าไม่มี → อนุญาตให้ดูทั้งหมด (ปล่อย undefined)
    const usernames = isAdmin
      ? (parsedUsernames && parsedUsernames.length ? parsedUsernames : undefined)
      : [auth.username];

    const { items, total } = await getTrips(auth, {
      usernames,                 // ← ตรงกับ ListTripsOptions
      status,
      from,
      to,
      q,
      orderBy,                   // "start_plan" | "created_at" | "updated_at"
      order: direction,                 // "asc" | "desc"
      limit,
      offset,
    });

    return res.status(200).json({
      success: true,
      data: items,
      pagination: {
        page,
        page_size,
        total,
        total_pages: Math.max(1, Math.ceil((total ?? 0) / page_size)),
      },
      sort: { order_by: orderBy, direction },
      filters: { q, status, from, to, usernames: isAdmin ? usernames : [auth.username] },
    });
  } catch (err: any) {
    if (err?.name === "ZodError") {
      return res.status(400).json({ 
        error: "validation_error", details: err.issues,
        success: false,
      });
    }
    const msg = typeof err?.message === "string" ? err.message : "unexpected_error";
    return res.status(500).json({ 
      success: false,
      error: msg });
  }
};