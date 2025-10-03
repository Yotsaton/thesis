// src/place/functions/savePlaceToDB.ts
import type { ITask, IDatabase } from "pg-promise";
import { db } from "../../database/db-promise";
import type { place } from "../../database/database.types";
import type { PlaceInsert } from "../types/types";

const runner = (t?: ITask<any> | IDatabase<any>) => (t as any) ?? db;

/**
 * Insert ใหม่ (ให้ DB gen id)
 * - ถ้าใส่ place_ID_by_ggm มาด้วย ควรใช้ upsert ในระดับ service (processPlaces) แทน
 * - ฟังก์ชันนี้ “ไม่ upsert”
 */
export async function savePlaceToDB(
  t: ITask<any> | IDatabase<any> | undefined = undefined,
  p: PlaceInsert
): Promise<place> {
  const r = runner(t);
  const hasLoc = !!p.location && Array.isArray(p.location.coordinates);
  const sql = `
    INSERT INTO public.place (
      name_place, address, location,
      rating, user_rating_total, sumary_place,
      place_id_by_ggm, category, url
    )
    VALUES (
      $/name_place/, $/address/,
      ${hasLoc ? `ST_SetSRID(ST_MakePoint($/lon/, $/lat/), 4326)` : `NULL`},
      $/rating/, $/user_rating_total/, $/sumary_place/,
      $/place_id_by_ggm/, $/category/, $/url/
    )
    RETURNING *;
  `;

  const params = {
    ...p,
    lon: hasLoc ? p.location!.coordinates[0] : undefined,
    lat: hasLoc ? p.location!.coordinates[1] : undefined,
  };

  try {
    const row = (await r.one(sql, params)) as place;
    return row;
  } catch (err) {
    console.error("savePlaceToDB error:", err);
    throw new Error("Failed to save place");
  }
}
