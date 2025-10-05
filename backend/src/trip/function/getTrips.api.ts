// src/trip/function/getTrip.api.ts
import {type Response } from "express";
import {type AuthenticatedRequest, Accessor} from "../../middleware/type.api";
import { ListQuerySchema, type ListQueryParsed, ParamSchema} from "../types/api.types";
import { getTrips, getTrip} from "./getTrips";

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
      status,          // enum 'active' | 'deleted' (default 'active')
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

    // ถ้าไม่ใช่ admin → จำกัดที่ตัวเอง
    const usernames = isAdmin
      ? (parsedUsernames && parsedUsernames.length ? parsedUsernames : undefined)
      : [auth.username];

    const { items, total } = await getTrips(auth, {
      usernames,
      status,
      from,
      to,
      q,
      orderBy,
      order: direction,
      limit,
      offset,
    });

    const trips = items.map(trip => ({
      id: trip.id,
      name: trip.header,
      start_plan: trip.start_plan,
      end_plan: trip.end_plan,
      status: trip.status,
      updatedAt: trip.updated_at,
      deletedAt: trip.deleted_at,
    }));

    return res.status(200).json({
      success: true,
      trips,
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
        error: "validation_error",
        details: err.issues,
        success: false,
      });
    }
    const msg = typeof err?.message === "string" ? err.message : "unexpected_error";
    return res.status(500).json({
      success: false,
      error: msg,
    });
  }
};
