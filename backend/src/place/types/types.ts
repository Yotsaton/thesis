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

/** โครง response จาก Google ที่เราสนใจ (ให้พอเพื่อ map เข้าฐานข้อมูล) */
export interface GooglePlaceDetailsResponse {
  result?: {
    name?: string;
    formatted_address?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
    place_id?: string;
    rating?: number;
    user_ratings_total?: number;
    editorial_summary?: { overview?: string };
    url?: string;
    types?: string[];
  };
  status: string;
}
