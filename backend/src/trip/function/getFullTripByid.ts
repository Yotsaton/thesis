// src/trip/function/getFullTripByid.ts
import { db } from "../../database/db-promise";
import type { trip as TripRow, day_trip as DayTripRow, route as RouteRow, geoJSONPoint } from "../../database/database.types";
import type { Accessor } from "../../middleware/type.api";
import type { Trip, DayItem, PlaceItem, NoteItem } from "../types/types";
import type { ITask, IDatabase } from "pg-promise";

type JoinedRouteRow = RouteRow & {
  p_id: string | null;
  p_name_place: string | null;
  p_address: string | null;
  p_location: geoJSONPoint | null;
  p_rating: number | null;
  p_user_rating_total: number | null;
  p_sumary_place: string | null;
  p_place_id_by_ggm: string | null;
  p_category: string[] | null;
  p_url: string | null;
  p_updated_at: Date | null;
};

export async function getFullTrip(
  accessor: Accessor,
  trip_id: string,
  cx?: ITask<any> | IDatabase<any>
): Promise<Trip> {
  const isAdmin = Boolean(accessor.is_super_user || accessor.is_staff_user);

  const runner = cx ?? db;
  const run = async (t: ITask<any> | IDatabase<any>): Promise<Trip> => {
    // 1) trip
    const trp = await t.oneOrNone<TripRow>(
      `
      SELECT
        id, username, start_plan, end_plan, status,
        created_at, header, updated_at, deleted_at
      FROM public.trip
      WHERE id = $1::uuid AND status != 'delete'
      `,
      [trip_id]
    );

    if (!trp) throw new Error("Trip not found");
    if (!isAdmin && trp.username !== accessor.username) {
      throw new Error("Access denied");
    }

    // 2) day_trip
    const days = await t.any<DayTripRow>(
      `
      SELECT id, trip_id, created_at, "date", header, updated_at
      FROM public.day_trip
      WHERE trip_id = $1::uuid
      ORDER BY "date" ASC, created_at ASC
      `,
      [trp.id]
    );

    const dayIds = days.map(d => d.id);
    const routesByDay: Record<string, JoinedRouteRow[]> = {};

    if (dayIds.length > 0) {
      const routes = await t.any<JoinedRouteRow>(
        `
        SELECT
          r.*,
          p.id  AS p_id,
          p.name_place AS p_name_place,
          p.address    AS p_address,
          p.location   AS p_location,
          p.rating     AS p_rating,
          p.user_rating_total AS p_user_rating_total,
          p.sumary_place AS p_sumary_place,
          p.place_id_by_ggm AS p_place_id_by_ggm,
          p.category   AS p_category,
          p.url        AS p_url,
          p.updated_at AS p_updated_at
        FROM public.route r
        LEFT JOIN public.place p
          ON r.place_id = p.id::uuid
        WHERE r.d_trip_id = ANY($1::uuid[])
        ORDER BY r.d_trip_id ASC, r.index ASC, r.created_at ASC
        `,
        [dayIds]
      );

      for (const r of routes) {
        const k = r.d_trip_id;
        if (!routesByDay[k]) routesByDay[k] = [];
        routesByDay[k].push(r);
      }
    }

    // 4) map โครง Trip
    const result: Trip = {
      id: trp.id,
      name: trp.header ?? "",
      start_plan: trp.start_plan,
      end_plan: trp.end_plan,
      updatedAt: trp.updated_at ?? undefined,

      days: days.map((d) => {
        // ให้ callback ของ map คืน DayItem **ทุกกรณี** แล้ว filter ค่าที่ไม่ใช่ด้วย type guard
        const items: DayItem[] = (routesByDay[d.id] || [])
          .map((r): DayItem | null => {
            if (r.type === "place") {
              const placeItem: PlaceItem = {
                type: "place",
                id: r.id,                               // ถ้าโครงคุณต้องการ route.id แทน ให้เปลี่ยนเป็น r.id
                place_id: r.place_id ?? undefined,
                location: r.p_location ?? undefined,      // ผ่าน parser แล้วจะเป็น geoJSONPoint
                name: r.p_name_place ?? undefined,
                startTime: r.start_time ?? undefined,
                endTime: r.end_time ?? undefined,
              };
              return placeItem;
            } else {
              // r.type === "note"
              const noteItem: NoteItem = {
                type: "note",
                id: r.id,
                text: r.note ?? undefined,
              };
              return noteItem;
            }
          })
          .filter((x): x is DayItem => x !== null); // <-- สำคัญ: ตัด null/undefined ออก + แจ้ง type ให้ TS

        return {
          id: d.id,
          date: d.date,
          subheading: d.header ?? "",
          updatedAt: d.updated_at ? d.updated_at.toISOString() : undefined,
          items, // ตอนนี้เป็น DayItem[] อย่างถูกชนิด
        };
      }),
    };

    return result;
  };

  // ถ้ามี cx มาแล้ว ใช้มันตรง ๆ; ถ้าไม่มีก็หุ้มด้วย tx (พฤติกรรมเดิม)
  if (cx) return run(cx);
  return db.tx(run);
}
