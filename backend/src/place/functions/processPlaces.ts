// src/place/services/processPlaces.ts
import type { ITask, IDatabase } from "pg-promise";
import { db } from "../../database/db-promise";
import type { place } from "../../database/database.types";
import type { ResolveInput, PlaceInsert, PlacePatch } from "../types/types";
import { findPlaceInDB } from "../functions/findPlaceInDB";
import { fetchGooglePlaceDetails } from "../functions/fetchGooglePlaceDetails";
import { savePlaceToDB } from "../functions/savePlaceToDB";
import { updatePlaceInDB } from "./updatePlaceInDB";
import { savePlaceLocationToDB } from "./savePlaceLocationToDB";
import { TypeOverrides } from "pg";

const runner = (t?: ITask<any> | IDatabase<any>) => (t as any) ?? db;
const STALE_DAYS = 30;
const isStale = (d?: Date) =>
  d ? Date.now() - new Date(d).getTime() > STALE_DAYS * 86400 * 1000 : true;

/**
 * Resolve ข้อมูลสถานที่ (place) ให้ได้แถวจาก DB (มี id เสมอ) โดยยึด Google Place ID เท่านั้น
 *
 * ### พฤติกรรม
 * 1) รับเฉพาะ `input.place_id_by_ggm` เพื่อ resolve จาก Google (หาก DB ไม่มี/ข้อมูลเก่า)
 * 2) ลองหาจาก DB ก่อนด้วย `place_id_by_ggm`
 * 3) ถ้าไม่พบ หรือข้อมูลใน DB เก่ากว่า `STALE_DAYS` → เรียก Google Place Details ด้วย place_id
 * 4) ทำ upsert ตาม `place_ID_by_ggm`:
 *    - มีอยู่แล้ว → update เฉพาะฟิลด์ที่ได้ข้อมูลใหม่ (name/address/geometry/rating/…)
 *    - ไม่มี → insert ใหม่
 * 5) **ไม่** ยิง Google ด้วยพิกัดอีกต่อไป
 * 6) ถ้า caller ส่ง input ที่ไม่มี `place_id_by_ggm`:
 *    - ถ้ามี `location` จะ “ค้นหาเฉพาะใน DB” ให้ (ใกล้สุดในรัศมีที่กำหนด) → พบก็คืน, ไม่พบก็ `throw "place_id_required"`
 *
 * ### Transaction
 * - ถ้าฟังก์ชันนี้ถูกเรียกด้วย `t` (pg-promise task/transaction) จะผูกทุก query อยู่ใน transaction เดียว
 * - ถ้าไม่ได้ส่ง `t` มา จะ fallback ใช้ `db` ปกติ
 *
 * @param tOrApiKey  เมื่อเรียกแบบ (t, apiKey, input) ให้ส่ง `t` มาก่อน; หรือเรียกแบบ (apiKey, input) ก็ได้
 * @param maybeApiKey ค่า API key ของ Google Places (จำเป็น)
 * @param maybeInput  อินพุต ResolveInput `{ place_id_by_ggm: string }`
 *
 * @returns place แถวจากตาราง `public.place` ที่อัปเดต/สร้างแล้ว (ต้องมี `id`)
 *
 * @throws {Error} "missing_google_places_api_key"  หากไม่ส่ง API key มา
 * @throws {Error} "place_id_required"             หากไม่มี place_id และ DB ก็หาไม่เจอ
 */
export async function processPlaces(
  t: ITask<any> | IDatabase<any>,
  apiKey: string,
  input: ResolveInput
): Promise<place>;
export async function processPlaces(
  apiKey: string,
  input: ResolveInput
): Promise<place>;
export async function processPlaces(
  tOrApiKey: ITask<any> | IDatabase<any> | string,
  maybeApiKey: string | ResolveInput,
  maybeInput?: ResolveInput
): Promise<place> {
  const r = runner(typeof tOrApiKey === "string" ? undefined : (tOrApiKey as any));
  const apiKey = typeof tOrApiKey === "string" ? (tOrApiKey as string) : (maybeApiKey as string);
  const input = (typeof tOrApiKey === "string"
    ? (maybeApiKey as ResolveInput)
    : (maybeInput as ResolveInput));

  if (!apiKey) throw new Error("missing_google_places_api_key");

  if (input.place_id_by_ggm){
    const existedid = await findPlaceInDB(r, input);
    if (!existedid) {
      console.log(`[CREATE] 🕵️ ไม่พบ "${input.place_id_by_ggm}", กำลังดึงข้อมูล...`);
      const newPlace = await fetchGooglePlaceDetails(apiKey, input.place_id_by_ggm);
      if(newPlace){
        return await savePlaceToDB(r, newPlace as PlaceInsert);
      }
      throw new Error("Failed to fetch place details from Google");

    } else if (isStale(existedid.updated_at)) {
      console.log(`[UPDATE] 🔄 ข้อมูลของ "${existedid.name_place}" เก่า, กำลังอัปเดต...`);
      const newPlace = await fetchGooglePlaceDetails(apiKey, input.place_id_by_ggm);
      if(newPlace){
        return await updatePlaceInDB(r, existedid.id, newPlace as PlacePatch);
      }
      console.warn("Failed to update place in database using old data");
    } else {
      console.log(`location is ${typeof existedid.location}, skip update`);
      return existedid;
    }
  }

  if (input.location) {
    const existedloc = await findPlaceInDB(r, input);
    if (!existedloc) {
      console.log(`[CREATE] 🕵️ ไม่พบสถานที่ใกล้เคียง, กำลังสร้างใหม่...`);
      return await savePlaceLocationToDB(r, input.location);
    }else {
      return existedloc;
    }
  }
  throw new Error("No valid input provided to processPlaces");
};

/** (ถ้าต้องใช้) batch เวอร์ชันเรียกทีละตัว */
export async function processPlacesBatch(
  t: ITask<any> | IDatabase<any>,
  apiKey: string,
  inputs: ResolveInput[]
): Promise<place[]>;
export async function processPlacesBatch(
  apiKey: string,
  inputs: ResolveInput[]
): Promise<place[]>;
export async function processPlacesBatch(
  tOrApiKey: ITask<any> | IDatabase<any> | string,
  maybeApiKey: string | ResolveInput[],
  maybeInputs?: ResolveInput[]
): Promise<place[]> {
  const r = runner(typeof tOrApiKey === "string" ? undefined : (tOrApiKey as any));
  const apiKey = typeof tOrApiKey === "string" ? (tOrApiKey as string) : (maybeApiKey as string);
  const inputs = (typeof tOrApiKey === "string"
    ? (maybeApiKey as ResolveInput[])
    : (maybeInputs as ResolveInput[])) ?? [];

  const tasks = inputs.map((inp) => processPlaces(r, apiKey, inp).catch(() => null));
  const settled = await Promise.all(tasks);
  return settled.filter((p): p is place => !!p);
};
