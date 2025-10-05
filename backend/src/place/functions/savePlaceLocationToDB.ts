// src/place/functions/savePlaceLocationToDB.ts
import type { ITask, IDatabase } from "pg-promise";
import { db } from "../../database/db-promise";
import type { place, geoJSONPoint } from "../../database/database.types";

const runner = (t?: ITask<any> | IDatabase<any>) => (t as any) ?? db;

/** อัปเดตเฉพาะ location */
export async function savePlaceLocationToDB(
  t: ITask<any> | IDatabase<any> | undefined = undefined,
  location: geoJSONPoint
): Promise<place> {
  const r = runner(t);
  const [lon, lat] = location.coordinates;
  const sql = `
    INSERT INTO public.place
    (location, updated_at)
    VALUES (ST_SetSRID(ST_MakePoint($/lon/, $/lat/), 4326), NOW())
    RETURNING *;
  `;
  return ( await r.one(sql, { lon, lat })) as place;
}
