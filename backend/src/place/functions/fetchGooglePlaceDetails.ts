// src/place/functions/fetchGooglePlaceDetails.ts
import { geoJSONPoint } from "../../database/database.types";
import type { GooglePlaceDetailsResponse, PlaceInsert, ResolveInput } from "../types/types";

/**
 * แปลงผล Google → โครงข้อมูลสำหรับ DB (PlaceInsert บางส่วน)
 * (geometry/พิกัดจะถูกแปลงที่ caller หากต้องการเก็บ)
 */
function toPlaceInsertFromDetails(
  json: GooglePlaceDetailsResponse
): Partial<PlaceInsert> {
  const r = json.result;
  if (!r) return { place_id_by_ggm: null };

  const location: geoJSONPoint =  { type: "Point", 
    coordinates: [Number(r.geometry?.location?.lng), Number(r.geometry?.location?.lat)] 
  }; // [lng, lat]

  return {
    name_place: r.name ?? null,
    address: r.formatted_address ?? null,
    location: location,
    rating: typeof r.rating === "number" ? r.rating : null,
    user_rating_total: typeof r.user_ratings_total === "number" ? r.user_ratings_total : null,
    sumary_place: r.editorial_summary?.overview ?? null,
    place_id_by_ggm: r.place_id ?? null,
    category: Array.isArray(r.types) ? r.types : null,
    url: r.url ?? null,
  };
}
// ต้องแก้ให้return locationใน meta ด้วย(promise<insertplace>)
/**
 * ✅ ดึงรายละเอียดจาก Google ด้วย "place_id" เท่านั้น
 * - ถ้า input ไม่ใช่ place_id (เช่นมี location) → throw
 */
export async function fetchGooglePlaceDetails(
  apiKey: string,
  input: string
): Promise<PlaceInsert> {
  if (!apiKey) throw new Error("missing_google_places_api_key");

  const placeId = input;
  const fields =
    "name,formatted_address,geometry,place_id,rating,user_ratings_total,editorial_summary,url,types";
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(
    placeId
  )}&fields=${encodeURIComponent(fields)}&key=${encodeURIComponent(apiKey)}`;

  const resp = await fetch(url);
  if(!resp.ok) {
    console.error("fetchGooglePlaceDetails error response:", resp);
    throw new Error(`google_places_api_error_${resp.status}`);
  }

  const data = (await resp.json()) as GooglePlaceDetailsResponse;
  const result = toPlaceInsertFromDetails(data);
  if(result.place_id_by_ggm !== placeId) {
    console.warn(
      `fetchGooglePlaceDetails: place_id ไม่ตรง! (input: ${placeId}, result: ${result.place_id_by_ggm})`
    );
  }
  if(!result.location?.coordinates) throw new Error("failed_to_fetch_place_details");

  return result as PlaceInsert;
}
