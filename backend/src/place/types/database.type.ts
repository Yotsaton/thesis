// src/place/types/database.types.ts

// Interface สำหรับข้อมูลที่ได้จาก DB (มี location เป็น GeoJSON string)
export interface PlaceDbRow {
  place_ID: string;
  name_place: string;
  address: string;
  location: string; // From ST_AsGeoJSON, will be a string like '{"type":"Point","coordinates":[...]}'
  rating: number | null;
  user_rating_total: number | null;
  sumary_place: string | null;
  place_ID_by_ggm: string | null;
  category: string[] | null;
  url: string | null;
  last_update_data: Date;
}