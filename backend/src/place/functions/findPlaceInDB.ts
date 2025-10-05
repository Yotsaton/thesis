// src/place/functions/findPlaceInDB.ts
import type { ITask, IDatabase } from "pg-promise";
import { db } from "../../database/db-promise";
import type { place, geoJSONPoint } from "../../database/database.types";
import type { ResolveInput } from "../types/types";
const SEARCH_RADIUS_METERS = 100;

/** ใช้ตัวรัน query: เลือก t ถ้ามี ไม่งั้น fallback db */
const runner = (t?: ITask<any> | IDatabase<any>) => (t as any) ?? db;

/**
 * ค้นหา place ใน DB
 * 1) ด้วย place_ID_by_ggm (เร็ว/ชัวร์)
 * 2) หรือพิกัด (ใกล้สุดภายในรัศมี)
 */
export async function findPlaceInDB(
  t: ITask<any> | IDatabase<any> | undefined = undefined,
  input: ResolveInput
): Promise<place | null> {
  const r = runner(t);
  try {
    if (input.place_id_by_ggm) {
      const row = (await r.oneOrNone(
        `SELECT * FROM public.place WHERE place_id_by_ggm = $1 LIMIT 1`,
        [input.place_id_by_ggm]
      )) as place | null;
      console.log("type of row.location:", typeof row?.location);
      console.log("findPlaceInDB by place_id_by_ggm:", row);
      if (row) return row;
    }

    if (input.location) {
      const [lon, lat] = input.location.coordinates;
      const row = (await r.oneOrNone(
        `
        SELECT *
        FROM public.place
        WHERE location IS NOT NULL
          AND ST_DWithin(
            location,
            ST_SetSRID(ST_MakePoint($/lon/, $/lat/), 4326),
            $/radius/
          )
        ORDER BY location <-> ST_SetSRID(ST_MakePoint($/lon/, $/lat/), 4326)
        LIMIT 1
        `,
        { lon, lat, radius: SEARCH_RADIUS_METERS }
      )) as place | null;
      if (row) return row;
    }

    return null;
  } catch (err) {
    console.error("findPlaceInDB error:", err);
    throw new Error("Failed to query place from DB");
  }
}
