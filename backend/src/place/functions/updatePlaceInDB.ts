// src/place/services/updatePlaceInDB.ts
import type { ITask, IDatabase } from "pg-promise";
import { db, pgp } from "../../database/db-promise";
import type { place } from "../../database/database.types";
import type { PlacePatch } from "../types/types";

const runner = (t?: ITask<any> | IDatabase<any>) => (t as any) ?? db;

/**
 * อัปเดตแบบ merge (เฉพาะฟิลด์ที่ส่งมา ไม่เขียนทับเป็น NULL)
 */
export async function updatePlaceInDB(
  t: ITask<any> | IDatabase<any> | undefined = undefined,
  id: string,
  patch: PlacePatch
): Promise<place> {
  const r = runner(t);
  const { location, ...rest } = patch;

  const sets: string[] = [];
  const values: Record<string, unknown> = { id };

  // ฟิลด์ทั่วไป
  Object.entries(rest).forEach(([k, v]) => {
    if (v === undefined) return;
    sets.push(`${pgp.as.name(k)} = $/${k}/`);
    values[k] = v;
  });

  // location
  if (location && Array.isArray(location.coordinates)) {
    sets.push(`location = ST_SetSRID(ST_MakePoint($/lon/, $/lat/), 4326)`);
    values["lon"] = location.coordinates[0];
    values["lat"] = location.coordinates[1];
  }

  if (!sets.length) {
    // ไม่มีอะไรให้อัปเดต → คืนค่าปัจจุบัน
    return await (r.one(`SELECT * FROM public.place WHERE id = $/id/`, { id })) as place;
  }

  const sql = `
    UPDATE public.place
    SET ${sets.join(", ")}, updated_at = NOW()
    WHERE id = $/id/
    RETURNING *;
  `;

  try {
    const row = (await r.one(sql, values)) as place;
    console.log(`updatePlaceInDB: Updated place id=${id}`);
    return row;
  } catch (err) {
    console.error("updatePlaceInDB error:", err);
    throw new Error("Failed to update place");
  }
}
