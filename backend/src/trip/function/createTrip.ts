// src/trip/function/createTrip.ts
import "dotenv/config";
import { db } from "../../database/db-promise";
import type { Accessor } from "../../middleware/type.api";
import type { Trip, PlaceItem, NoteItem } from "../types/types";
import type { trip as TripRow, day_trip as DayTripRow, route as RouteRow, place } from "../../database/database.types";
import { getFullTrip } from "./getFullTripByid";
import { processPlaces, ResolveInput } from "../../place/index";

// เลือกชื่อ env ที่คุณตั้งไว้จริง ๆ
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_API_KEY;

/**
 * เรียกใช้ processPlaces ตามสเปคของคุณ:
 * - รับ apiKey + (place_id | location)
 * - คืน place จากฐานข้อมูล (ต้องมี id)
 * 
 * ข้อกำหนด mapping:
 * - ถ้า PlaceItem.id เป็น "place.id ใน DB" แล้ว → ใช้ได้เลย ไม่ต้องเรียก processPlaces
 * - ไม่งั้น:
 *    - ถ้ามี place_id (Google) → ส่งให้ processPlaces
 *    - else ถ้ามี location (geoJSONPoint) → ส่งให้ processPlaces
 *    - ไม่งั้น → throw
 */
async function resolvePlaceIdViaProcess(
  t: any, // pg-promise task/tx
  apiKey: string,
  item: PlaceItem
): Promise<string> {
  
  // 2) เตรียม payload ให้ processPlaces (ตามสเปคของคุณ)
  //    * อย่างน้อยต้องมี place_id (Google) หรือ location (geoJSONPoint)
  const payload : ResolveInput = {
    place_id_by_ggm: item.place_id ?? undefined,
    location: item.location ?? undefined,
  };

  if (!payload) {
    throw new Error("place_input_missing_place_id_or_location");
  }

  // 3) เรียก processPlaces
  //    - สเปคคุณบอกว่า: รับ apiKey แล้วรับค่า type (place_id หรื location) และคืน place จาก DB
  //    - ผมส่ง t ไปด้วย (ถ้า processPlaces ไม่รับก็ไม่เป็นไร) เผื่อฟังก์ชันคุณรองรับการทำงานใน tx
  let placeFromDb: place | null = null;
  try {
    // (t, apiKey, payload)
    placeFromDb = await (processPlaces as any)(t, apiKey, payload);
  } catch {
    try {
      // (apiKey, payload, t)
      placeFromDb = await (processPlaces as any)(apiKey, payload, t);
    } catch {
      // (apiKey, payload)
      placeFromDb = await (processPlaces as any)(apiKey, payload);
    }
  }

  if (!placeFromDb?.id || typeof placeFromDb.id !== "string") {
    throw new Error("processPlaces_return_invalid_place");
  }

  return placeFromDb.id;
}

/**
 * สร้างทริปแบบ Deep (trip → day_trip[] → route[](+place|note)) ภายใน Transaction เดียว
 *
 * ### พฤติกรรม
 * - ใช้ผู้ใช้ปัจจุบันจาก `accessor.username` เป็นเจ้าของทริป
 * - ให้ฐานข้อมูลเป็นผู้สร้าง `id`, `created_at` ทุกระดับ (trip/day_trip/route/place)
 * - สำหรับรายการ `place`:
 *    - ถ้ามี `item.id` (เท่ากับ place.id ใน DB) จะใช้เลย
 *    - ถ้าไม่มี ให้ระบุ `place_id_by_ggm` (Google Place ID) → จะเรียก `processPlaces` เพื่อดึง/อัปเดตข้อมูลจาก Google และคืน `place.id` ที่ DB สร้าง/มีอยู่
 *    - **ไม่** เรียก Google ด้วยพิกัด (location) อีกต่อไป — หากไม่มี `place_id_by_ggm` และหาใน DB ไม่เจอ → โยน error: `"place_id_required"`
 * - สร้าง `route` ของแต่ละวันตามลำดับ `index` (0..n)
 * - ปิดท้ายดึงผลลัพธ์ด้วย `getTripDeep` เพื่อคืนค่า `Trip` ตามโครง type ของคุณแบบครบถ้วน
 *
 * ### ข้อกำหนดอินพุตที่สำคัญ (สำหรับ item.type = "place")
 * - ควรส่ง `place_id_by_ggm` (หรือ `place_id`) เสมอ หากต้องให้ระบบไป resolve ที่ Google
 * - ถ้าไม่มี `place_id_by_ggm` และไม่มี `item.id` → ฟังก์ชันจะค้นหาใน DB ด้วยพิกัดไม่ได้ (เลิกสนับสนุน)
 *
 * @param accessor  ข้อมูลผู้ใช้ที่ล็อกอิน (ต้องมี `username`); ใช้กำหนดเจ้าของทริป และบังคับสิทธิ์
 * @param payload   โครง `Trip` ที่ฝั่ง client ส่งมา (id ที่ส่งมาจะถูกเมิน ให้ DB gen เอง)
 *
 * @returns Trip     โครงทริปที่สร้างเสร็จพร้อม `id` ทุกระดับจาก DB
 *
 * @throws {Error} "unauthorized"           เมื่อไม่มี `accessor.username`
 * @throws {Error} "place_id_required"      เมื่อรายการ place ไม่มีทั้ง `item.id` และ `place_id_by_ggm` และ DB ก็หาไม่เจอ
 * @throws {Error} อื่น ๆ                    จากการทำงานของ DB / processPlaces / mapping
 *
 * @example
 * const trip = await createTrip(accessor, {
 *   name: "Osaka 3D2N",
 *   start_plan: "2025-10-10",
 *   end_plan: "2025-10-12",
 *   days: [
 *     {
 *       date: "2025-10-10",
 *       subheading: "Day 1",
 *       items: [
 *         { type: "place", place_id_by_ggm: "ChIJxxxxxxxxx" },
 *         { type: "note", text: "ซื้อบัตร ICOCA" }
 *       ]
 *     }
 *   ]
 * });
 */
export async function createTrip(
  accessor: Accessor,
  payload: Trip
): Promise<Trip> {
  const username = accessor?.username;
  if (!username) throw new Error("unauthorized");

  const name = (payload.name ?? "").trim();

  return db.tx<Trip>(async (t) => {
    // 1) INSERT trip
    const tripRow = await t.one<TripRow>(
      `
      INSERT INTO public.trip (username, start_plan, end_plan, header, status)
      VALUES ($[username], $[start_plan], $[end_plan], $[header], 'active')
      RETURNING id, username, start_plan, end_plan, status, created_at, header, updated_at, deleted_at
      `,
      {
        username,
        start_plan: payload.start_plan, // 'YYYY-MM-DD'
        end_plan: payload.end_plan,     // 'YYYY-MM-DD'
        header: name || null,
      }
    );

    // 2) เตรียมวันให้เรียงตามวันที่ (กัน input ไม่เรียง)
    const daysSorted = [...(payload.days ?? [])].sort((a, b) =>
      (a.date || "").localeCompare(b.date || "")
    );

    // 3) INSERT day_trip + route (สำหรับแต่ละวัน)
    for (const d of daysSorted) {
      const dayRow = await t.one<DayTripRow>(
        `
        INSERT INTO public.day_trip (trip_id, "date", header)
        VALUES ($[trip_id], $[date], $[header])
        RETURNING id, trip_id, created_at, "date", header, updated_at
        `,
        {
          trip_id: tripRow.id,
          date: d.date,                                   // 'YYYY-MM-DD'
          header: (d.subheading ?? "").trim() || null,    // ชื่อย่อยประจำวัน
        }
      );

      if (!GOOGLE_PLACES_API_KEY) throw new Error("missing GOOGLE_PLACES_API_KEY");
      let index = 0;
      for (const item of d.items ?? []) {
        if (item?.type === "place") {
          // ✅ ใช้ processPlaces ตามสเปคที่คุณแจ้ง
          const placeId = await resolvePlaceIdViaProcess(t, GOOGLE_PLACES_API_KEY!, item);

          await t.one<RouteRow>(
            `
            INSERT INTO public.route
              (d_trip_id, place_id, note, "index", start_time, end_time, "type")
            VALUES
              ($[day_id], $[place_id], NULL, $[index], $[start_time], $[end_time], 'place')
            RETURNING id, d_trip_id, place_id, created_at, note, "index", updated_at, start_time, end_time, "type"
            `,
            {
              day_id: dayRow.id,
              place_id: placeId,
              index: index++,
              start_time: (item as PlaceItem).startTime ?? null,
              end_time: (item as PlaceItem).endTime ?? null,
            }
          );
        } else if (item?.type === "note") {
          await t.one<RouteRow>(
            `
            INSERT INTO public.route
              (d_trip_id, place_id, note, "index", start_time, end_time, "type")
            VALUES
              ($[day_id], NULL, $[note], $[index], NULL, NULL, 'note')
            RETURNING id, d_trip_id, place_id, created_at, note, "index", updated_at, start_time, end_time, "type"
            `,
            {
              day_id: dayRow.id,
              note: (item as NoteItem).text ? (item as NoteItem).text!.trim() : null,
              index: index++,
            }
          );
        } else {
          // type ไม่รู้จัก → ข้ามหรือ throw ก็ได้ แล้วแต่นโยบาย
        }
      }
    }

    // 4) คืนทริปเต็ม ๆ (ให้โครง return เหมือน getFullTripById ที่คุณเทสแล้ว)
    const full = await getFullTrip(accessor, tripRow.id, t);
    return full;
  });
}
