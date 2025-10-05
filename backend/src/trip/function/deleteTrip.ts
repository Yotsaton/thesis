// src/trip/function/deleteTrip.ts
import { db } from "../../database/db-promise";
import type { Accessor } from "../../middleware/type.api";
import type { trip as TripRow } from "../../database/database.types";
import type { UpdateOptions } from "../types/types";

/**
 * Soft delete ทริป:
 * - เปลี่ยน status เป็น 'delete'
 * - ตั้ง deleted_at = now()
 * - ไม่ลบ day_trip / route
 * - ตรวจสิทธิ์: เจ้าของ / แอดมิน/สตาฟ
 * - รองรับ optimistic concurrency ผ่าน opts.updatedAt (ISO string)
 * - Idempotent: ถ้าเป็น 'delete' อยู่แล้ว จะคืนผลสำเร็จเช่นกัน
 */
export async function deleteTripSoft(
  accessor: Accessor,
  tripId: string,
  opts: UpdateOptions
): Promise<{ id: string; status: "deleted"; deleted_at: string }> {
  if (!accessor?.username) throw new Error("unauthorized");
  if (!tripId) throw new Error("trip_id_required");

  return db.tx(async (t) => {
    // ล็อกแถวทริปเพื่อกันแข่งกันแก้/ลบ
    const trip = await t.oneOrNone<TripRow>(
      `SELECT id, username, status, updated_at, deleted_at
         FROM public.trip
        WHERE id = $1
        FOR UPDATE`,
      [tripId]
    );
    if (!trip) throw new Error("trip_not_found");

    const isOwner = trip.username === accessor.username;
    const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);
    if (!isOwner && !isAdmin) throw new Error("forbidden");

    // optimistic concurrency (ถ้าclientส่ง ifMatchUpdatedAt มา)
    if (opts.ifMatchUpdatedAt) {
      const clientTs = new Date(opts.ifMatchUpdatedAt).toISOString();
      const serverTs = new Date(trip.updated_at as unknown as string).toISOString();
      if (clientTs !== serverTs) {
        const err: any = new Error("trip_conflict");
        err.code = "trip_conflict";
        err.details = { level: "trip", serverUpdatedAt: serverTs, clientUpdatedAt: clientTs };
        throw err;
      }
    }

    // Idempotent: ถ้าลบไปแล้ว ให้คืนค่าปัจจุบัน
    if (trip.status === "deleted") {
      return {
        id: trip.id,
        status: "deleted",
        deleted_at: (trip.deleted_at as unknown as string) ?? new Date().toISOString(),
      };
    }

    // อัปเดตเป็น soft delete
    const updated = await t.one<Pick<TripRow, "id" | "status" | "deleted_at">>(
      `UPDATE public.trip
          SET status = 'deleted',
              deleted_at = now(),
              updated_at = now()
        WHERE id = $1
      RETURNING id, status, deleted_at`,
      [tripId]
    );

    return {
      id: updated.id,
      status: "deleted",
      deleted_at: updated.deleted_at as unknown as string,
    };
  });
}
