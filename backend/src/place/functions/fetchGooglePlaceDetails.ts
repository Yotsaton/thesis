// src/place/functions/fetchGooglePlaceDetails.ts
import { geoJSONPoint } from "../../database/database.types";
import type {
  GooglePlaceV1PlaceDetailsResponse,
  PlaceInsert,
  ResolveInput,
} from "../types/types";


/**
 * แปลงผลจาก Places API (New) -> โครงข้อมูลที่ตรงกับตาราง place ใน DB ของคุณ
 * หมายเหตุคอลัมน์ DB:
 * - name_place:        text
 * - address:           text
 * - location:          geography (เราจะให้ caller แปลงเป็น GeoJSONPoint แล้ว pg adapter รับเข้า geography)
 * - rating:            real
 * - user_rating_total: integer
 * - sumary_place:      text
 * - place_id_by_ggm:   text (เก็บ Place ID)
 * - category:          text[]
 * - url:               text (ลิงก์ Google Maps แบบคงที่)
 */
function toPlaceInsertFromV1(
  json: GooglePlaceV1PlaceDetailsResponse
): Partial<PlaceInsert> {
  if (!json?.id) return { place_id_by_ggm: null };

  const lat = json.location?.latitude ?? null;
  const lng = json.location?.longitude ?? null;

  const location: geoJSONPoint | undefined =
    typeof lat === "number" && typeof lng === "number"
      ? { type: "Point", coordinates: [Number(lng), Number(lat)] }
      : undefined;

  return {
    name_place: json.displayName?.text ?? null,
    address: json.formattedAddress ?? null,
    location, // ให้ pg-promise adapter แปลงเป็น geography/WKB ต่อในชั้น DB
    rating: typeof json.rating === "number" ? json.rating : null,
    user_rating_total:
      typeof json.userRatingCount === "number" ? json.userRatingCount : null,
    sumary_place: json.editorialSummary?.overview ?? null,
    place_id_by_ggm: json.id ?? null,
    category: json.types && json.types.length ? json.types : null,
    url: json.googleMapsUri ?? null,
  } as Partial<PlaceInsert>;
}

/**
 * ดึงรายละเอียดสถานที่จาก Places API (New) v1 ด้วย Place ID
 * @param input ต้องมี place_id_by_ggm (Google Place ID)
 * @returns Partial<PlaceInsert> ที่แม็ปฟิลด์สำหรับบันทึกลง DB
 *
 */
export async function fetchGooglePlaceDetails(
  placeId: string
): Promise<PlaceInsert> {
  
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("missing_google_api_key");

  const params = new URLSearchParams({
    languageCode: "th",
    regionCode: "TH",
  });

  const URL = `https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?${params.toString()}`;
  const fields = [
    "id",
    "displayName",
    "formattedAddress",
    "location",
    "rating",
    "userRatingCount",
    "editorialSummary",
    "googleMapsUri",
    "types",
  ].join(",");

  const resp = await fetch(URL, {
    method: "GET",
    headers: {
      // ใน REST v1 ใส่ API key ผ่าน header ได้ (แนะนำ) หรือจะใช้เป็น `key=` ใน query ก็ได้
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fields
    },
  });

  if (!resp.ok) {
    // v1 จะตอบเป็นรายละเอียด error ของ google.rpc.Status ใน body
    const msg = await resp.text().catch(() => "");
    throw new Error(`google_places_v1_error_${resp.status}: ${msg}`);
  }

  const data = (await resp.json()) as GooglePlaceV1PlaceDetailsResponse;
  const mapped = toPlaceInsertFromV1(data);

  if (mapped.place_id_by_ggm && mapped.place_id_by_ggm !== placeId) {
    // ป้องกันกรณี placeId ถูก refresh/เปลี่ยน — แจ้งเตือนให้ทราบ
    console.warn(
      `fetchGooglePlaceDetails(v1): returned Place ID differs (input: ${placeId} vs result: ${mapped.place_id_by_ggm}).`
    );
  }
  if (!mapped.location?.coordinates) {
    throw new Error("failed_to_fetch_place_details");
  }

  return mapped as PlaceInsert;
}
