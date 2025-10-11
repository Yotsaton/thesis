// src/place/types/place.types.ts
import type { geoJSONPoint, place } from "../../database/database.types";

/** รูปแบบ input ที่ resolver รองรับ */
export type ResolveInput = {
  place_id_by_ggm?: string,
  location?: geoJSONPoint
}; 

/** payload สำหรับ insert (DB จะ gen id เอง) */
export type PlaceInsert = Omit<place, "id" | "updated_at">;

/** payload สำหรับ patch */
export type PlacePatch = Partial<place>;

/**
 * โครงสร้าง Place (v1) ที่เราสนใจบางส่วนจาก Places API (New)
 * เอกสาร: https://developers.google.com/maps/documentation/places/web-service/place-details
 * หมายเหตุ: ใน v1 คีย์หลักใช้ "id" แทน "place_id (legacy)", URI แผนที่อยู่ใน "googleMapsUri",
 * ที่อยู่ใช้ "formattedAddress", พิกัดอยู่ใต้ "location.latLng".
 */
export interface GooglePlaceV1Place {
  id?: string; // Place ID
  displayName?: { text?: string; languageCode?: string };
  formattedAddress?: string;
  location?: {
    latitude?: number,
    longitude?: number 
  };
  rating?: number;
  userRatingCount?: number;
  editorialSummary?: { overview?: string };
  googleMapsUri?: string;
  types?: string[]; // ประเภทสถานที่ (ใหม่เป็น snake_case เดิมกลายเป็น lowerCamel? -> v1 ให้เป็น enum-like string เช่น "restaurant"
  primaryType?: string; // ประเภทหลัก เช่น "place_of_worship" ฯลฯ
}

/** response ของการเรียก v1 /places/{placeId} */
export type GooglePlaceV1PlaceDetailsResponse = GooglePlaceV1Place;
