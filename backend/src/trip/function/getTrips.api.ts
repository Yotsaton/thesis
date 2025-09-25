// src/trip/function/getTrip.api.ts
import {type Response } from "express";
import {AuthenticatedRequest, ListQuerySchema, type ListQueryParsed, ParamSchema} from "../types/api.type";
import { getTrips, getTrip} from "./getTrips";
import { Accessor, ListTripsOptions } from "../types/type";
import { success } from "zod";

/**
 * GET /api/v1/auth/trip
 * ดึงรายการทริปของผู้ใช้ที่ล็อกอิน (ยึด username จาก req.auth)
 * body = {
 *   q?: string,
 *   status?: string,
 *   from?: Date,
 *   to?: Date,
 *   page?: number ?? 1,
 *   page_size?: number ?? 20,
 *   username?: string, // สำหรับ admin ค้นหาโดย username (รองรับ "alice,bob")
 *   sort?: string,     // "col:dir" เช่น "created_at:desc"
 * }

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
/**
 * GET /api/v1/auth/trip/:trip_id
 * ดึงข้อมูลทริปเดียวตาม trip_id (ยึด username จาก req.auth)
 */

export const getTripApi = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { trip_id } = ParamSchema.parse(req.params);
    const auth: Accessor = req.auth;

    if (!trip_id) {
      return res.status(400).json({
        success: false,
        error: "missing_trip_id",
      });
    }

    const trip = await getTrip(auth, trip_id);

    if (!trip) {
      return res.status(404).json({
        success: false,
        error: "trip_not_found",
      });
    }

    // ตรวจสอบสิทธิ์: admin ดูได้ทุก trip, user ดูได้เฉพาะของตัวเอง
    const isAdmin = !!(auth.is_super_user || auth.is_staff_user);
    if (!isAdmin && trip.username !== auth.username) {
      return res.status(403).json({
        success: false,
        error: "forbidden",
      });
    }

    return res.status(200).json({
      success: true,
      data: trip,
    });
  } catch (err: any) {
    const msg = typeof err?.message === "string" ? err.message : "unexpected_error";
    return res.status(500).json({
      success: false,
      error: msg,
    });
  }
};