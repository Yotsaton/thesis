// src/trip/function/updateTrip.ts
import "dotenv/config";
import { db } from "../../database/db-promise";
import type { Accessor } from "../../middleware/type.api";
import type {
  trip as TripRow,
  day_trip as DayTripRow,
  route as RouteRow,
  place,
  Time,
} from "../../database/database.types";
import type { Trip, PlaceItem, NoteItem } from "../types/types";
import { getFullTrip } from "./getFullTripByid";
import { processPlaces, ResolveInput } from "../../place/index";

// ------------ CONFIG ------------
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_API_KEY;

// ------------ Helper: resolvePlaceIdViaProcess (เหมือนใน createTrip.ts) ------------
async function resolvePlaceIdViaProcess(
  t: any, // pg-promise task/tx
  apiKey: string,
  item: PlaceItem
): Promise<string> {

  // ต้องมี place_id_by_ggm (หรือ place_id) หรือมีพิกัด
  const payload: ResolveInput = {
    place_id_by_ggm: item.place_id ?? undefined,
    location: item.location ?? undefined,
  };

  if (!payload.place_id_by_ggm && !payload.location) {
    throw new Error("place_input_missing_place_id_or_location");
  }

  let placeFromDb: place | null = null;
  try {
    // processPlaces(t, apiKey, payload) ตามสเปกของคุณ
    placeFromDb = await processPlaces(t, apiKey, payload);
  } catch (err: any) {
    const msg = err?.message || String(err);
    if (msg.includes("not_found")) {
      throw new Error("place_not_found_from_process");
    }
    throw err;
  }

  if (!placeFromDb?.id) throw new Error("processPlaces_return_invalid_place");
  return placeFromDb.id;
}

function sameInstant(a: unknown, b: unknown): boolean {
  const ta = new Date(a as any).getTime();
  const tb = new Date(b as any).getTime();
  if (Number.isNaN(ta) || Number.isNaN(tb)) return false;
  return ta === tb; // เทียบเป็น epoch ms
}

// ======================================================================
// UPDATE TRIP (Deep): Trip → day_trip[] → route[](+place|note)
// - อัปเดตเฉพาะแถวที่มี id ใน DB; สร้างใหม่สำหรับแถวที่ไม่มี id; ลบรายการที่หายไป
// - เช็ค updated_at ที่ client ส่งมา (ถ้ามี) กับ DB (optimistic concurrency)
// - index ของ route จะถูกจัดใหม่ตามลำดับ items ที่ client ส่งมา (0..n)
// ======================================================================
export async function updateTripDeep(
  accessor: Accessor,
  tripId: string,
  payload: Trip
): Promise<Trip> {
  if (!accessor?.username) {
    throw new Error("unauthorized");
  }
  const username = accessor.username;

  if (!tripId) {
    throw new Error("trip_id_required");
  }

  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("missing GOOGLE_PLACES_API_KEY");
  }

  // ป้องกันค่าเวลาให้เป็น string | null ตามสคีมา
  const toTimeOrNull = (v: any): Time | null => (v ? (v as Time) : null);

  return db.tx<Trip>(async (t) => {
    // 1) ตรวจสอบสิทธิ์ + ดึงทริปจาก DB
    const tripRow = await t.oneOrNone<TripRow>(
      `
      SELECT id, username, header, created_at, updated_at, start_plan, end_plan, status
      FROM public.trip
      WHERE id = $1
      LIMIT 1
      `,
      [tripId]
    );
    if (!tripRow) throw new Error("trip_not_found");
    // เฉพาะเจ้าของทริปหรือแอดมิน/สตาฟ (ถ้า Accessor มี flag พวกนี้ก็เช็คเพิ่มตามนโยบายคุณ)
    const isOwner = tripRow.username === username;
    const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);
    if (!isOwner && !isAdmin) throw new Error("forbidden");

    // 1.1) เช็ค optimistic concurrency ที่ระดับ Trip (ถ้า client ส่งมา)
    if ((payload as any)?.updatedAt && !sameInstant((payload as any).updatedAt, tripRow.updated_at)) {
      // ให้ client รีเฟรชข้อมูลก่อน
      const err: any = new Error("trip_conflict");
      err.code = "trip_conflict";
      err.details = {
        level: "trip",
        serverUpdatedAt: tripRow.updated_at,
        clientUpdatedAt: (payload as any).updatedAt,
      };
      throw err;
    }

    // 2) UPDATE ตัว head ของทริป (header/start_plan/end_plan/name)
    const name = (payload as any)?.name?.trim?.() || null;

    const updatedTrip = await t.one<TripRow>(
      `
      UPDATE public.trip
         SET header = $[header],
             start_plan = $[start_plan],
             end_plan = $[end_plan],
             updated_at = now()
       WHERE id = $[id]
       RETURNING id, username, header, created_at, updated_at, start_plan, end_plan, status
      `,
      {
        id: tripRow.id,
        header: name,
        start_plan: payload.start_plan,
        end_plan: payload.end_plan,
      }
    );

    // 3) โหลด day_trip และ route ปัจจุบันของทริป
    const existingDays = await t.manyOrNone<DayTripRow>(
      `
      SELECT id, trip_id, created_at, "date", header, updated_at
      FROM public.day_trip
      WHERE trip_id = $1
      ORDER BY "date" ASC, id ASC
      `,
      [tripRow.id]
    );

    // เตรียม map สำหรับค้นหาเร็ว
    const dayById = new Map<string, DayTripRow>();
    existingDays.forEach((d) => dayById.set(d.id, d));

    // สำหรับเก็บ id วันที่ยังมีอยู่ (ไว้ลบที่หายไป)
    const keepDayIds = new Set<string>();

    // เรียงวันตามวันที่จาก payload
    const daysSorted = [...(payload.days ?? [])].sort((a, b) =>
      (a.date || "").localeCompare(b.date || "")
    );

    // 4) วนแต่ละวันจาก payload
    for (const d of daysSorted) {
      let dayRow: DayTripRow;

      if (d.id && dayById.has(d.id)) {
        // มีอยู่ใน DB → เช็ค conflict (ถ้าส่ง updatedAt มา)
        const dbDay = dayById.get(d.id)!;
        if ((d as any).updatedAt && !sameInstant((d as any).updatedAt, dbDay.updated_at)) {
          const err: any = new Error("day_conflict");
          err.code = "day_conflict";
          err.details = {
            level: "day",
            dayId: d.id,
            serverUpdatedAt: dbDay.updated_at,
            clientUpdatedAt: (d as any).updatedAt,
          };
          throw err;
        }

        // อัปเดตวัน
        dayRow = await t.one<DayTripRow>(
          `
          UPDATE public.day_trip
             SET "date" = $[date],
                 header = $[header],
                 updated_at = now()
           WHERE id = $[id]
           RETURNING id, trip_id, created_at, "date", header, updated_at
          `,
          {
            id: d.id,
            date: d.date,
            header: (d.subheading ?? "").trim() || null,
          }
        );
      } else {
        // ไม่มีใน DB → สร้างใหม่
        dayRow = await t.one<DayTripRow>(
          `
          INSERT INTO public.day_trip (trip_id, "date", header)
          VALUES ($[trip_id], $[date], $[header])
          RETURNING id, trip_id, created_at, "date", header, updated_at
          `,
          {
            trip_id: tripRow.id,
            date: d.date,
            header: (d.subheading ?? "").trim() || null,
          }
        );
      }

      keepDayIds.add(dayRow.id);

      // 4.1) จัดการ ITEMS (route) ของวันนั้น
      const existingRoutes = await t.manyOrNone<RouteRow>(
        `
        SELECT id, d_trip_id, place_id, created_at, note, "index",
               updated_at, start_time, end_time, "type"
        FROM public.route
        WHERE d_trip_id = $1
        ORDER BY "index" ASC, id ASC
        `,
        [dayRow.id]
      );

      const routeById = new Map<string, RouteRow>();
      existingRoutes.forEach((r) => routeById.set(r.id, r));
      const keepRouteIds = new Set<string>();

      let index = 0;
      for (const item of d.items ?? []) {
        if (item?.type === "place") {
          // update or insert PLACE item
          if (item.id && routeById.has(item.id)) {
            // UPDATE
            const dbRoute = routeById.get(item.id)!;

            // conflict?
            if ((item as any).updatedAt && !sameInstant((item as any).updatedAt, dbRoute.updated_at)) {
              const err: any = new Error("route_conflict");
              err.code = "route_conflict";
              err.details = {
                level: "route",
                routeId: item.id,
                serverUpdatedAt: dbRoute.updated_at,
                clientUpdatedAt: (item as any).updatedAt,
              };
              throw err;
            }

            // resolve place id (ถ้า client ส่ง place_id/location ใหม่เข้ามา; ถ้าไม่ส่ง ให้คงของเดิม)
            let placeIdToUse = dbRoute.place_id;
            if ((item as PlaceItem).place_id || (item as PlaceItem).location) {
              placeIdToUse = await resolvePlaceIdViaProcess(t, GOOGLE_PLACES_API_KEY!, item as PlaceItem);
            }

            const updated = await t.one<RouteRow>(
              `
              UPDATE public.route
                 SET place_id = $[place_id],
                     note = NULL,
                     "index" = $[index],
                     start_time = $[start_time],
                     end_time = $[end_time],
                     "type" = 'place',
                     updated_at = now()
               WHERE id = $[id]
               RETURNING id, d_trip_id, place_id, created_at, note, "index",
                         updated_at, start_time, end_time, "type"
              `,
              {
                id: item.id,
                place_id: placeIdToUse,
                index,
                start_time: toTimeOrNull((item as PlaceItem).startTime),
                end_time: toTimeOrNull((item as PlaceItem).endTime),
              }
            );

            keepRouteIds.add(updated.id);
            index++;
          } else {
            // INSERT
            const placeId = await resolvePlaceIdViaProcess(t, GOOGLE_PLACES_API_KEY!, item as PlaceItem);

            const inserted = await t.one<RouteRow>(
              `
              INSERT INTO public.route
                (d_trip_id, place_id, note, "index", start_time, end_time, "type")
              VALUES
                ($[day_id], $[place_id], NULL, $[index], $[start_time], $[end_time], 'place')
              RETURNING id, d_trip_id, place_id, created_at, note, "index",
                        updated_at, start_time, end_time, "type"
              `,
              {
                day_id: dayRow.id,
                place_id: placeId,
                index,
                start_time: toTimeOrNull((item as PlaceItem).startTime),
                end_time: toTimeOrNull((item as PlaceItem).endTime),
              }
            );

            keepRouteIds.add(inserted.id);
            index++;
          }
        } else if (item?.type === "note") {
          // NOTE item
          const noteText = (item as NoteItem).text ? (item as NoteItem).text!.trim() : null;

          if (item.id && routeById.has(item.id)) {
            const dbRoute = routeById.get(item.id)!;

            if ((item as any).updatedAt && !sameInstant((item as any).updatedAt, dbRoute.updated_at)) {
              const err: any = new Error("route_conflict");
              err.code = "route_conflict";
              err.details = {
                level: "route",
                routeId: item.id,
                serverUpdatedAt: dbRoute.updated_at,
                clientUpdatedAt: (item as any).updatedAt,
              };
              throw err;
            }

            const updated = await t.one<RouteRow>(
              `
              UPDATE public.route
                 SET place_id = NULL,
                     note = $[note],
                     "index" = $[index],
                     start_time = NULL,
                     end_time = NULL,
                     "type" = 'note',
                     updated_at = now()
               WHERE id = $[id]
               RETURNING id, d_trip_id, place_id, created_at, note, "index",
                         updated_at, start_time, end_time, "type"
              `,
              {
                id: item.id,
                note: noteText,
                index,
              }
            );
            keepRouteIds.add(updated.id);
            index++;
          } else {
            const inserted = await t.one<RouteRow>(
              `
              INSERT INTO public.route
                (d_trip_id, place_id, note, "index", start_time, end_time, "type")
              VALUES
                ($[day_id], NULL, $[note], $[index], NULL, NULL, 'note')
              RETURNING id, d_trip_id, place_id, created_at, note, "index",
                        updated_at, start_time, end_time, "type"
              `,
              {
                day_id: dayRow.id,
                note: noteText,
                index,
              }
            );
            keepRouteIds.add(inserted.id);
            index++;
          }
        } else {
          // type ไม่รู้จัก → ข้ามหรือโยน error ตามนโยบาย
          // throw new Error("unsupported_item_type");
        }
      }

      // 4.2) ลบ route ที่ไม่ได้ถูกส่งมาใน payload (ถือว่าถูกลบ)
      const toDeleteRoutes = existingRoutes
        .filter((r) => !keepRouteIds.has(r.id))
        .map((r) => r.id);

      if (toDeleteRoutes.length > 0) {
        await t.none(
          `DELETE FROM public.route WHERE id IN ($1:csv)`,
          [toDeleteRoutes]
        );
      }
    }

    // 5) ลบ day_trip ที่ไม่ได้ถูกส่งมาใน payload
    const toDeleteDays = existingDays
      .filter((d) => !keepDayIds.has(d.id))
      .map((d) => d.id);

    if (toDeleteDays.length > 0) {
      // ลบ route ของวันนั้นก่อน (ถ้าไม่ได้ตั้ง FK ON DELETE CASCADE)
      await t.none(
        `DELETE FROM public.route WHERE d_trip_id IN ($1:csv)`,
        [toDeleteDays]
      );
      await t.none(
        `DELETE FROM public.day_trip WHERE id IN ($1:csv)`,
        [toDeleteDays]
      );
    }

    // 6) คืนทริปเต็ม ๆ หลังอัปเดต
    const full = await getFullTrip(accessor, tripRow.id, t);
    return full;
  });
}
