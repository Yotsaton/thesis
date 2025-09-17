// src/place/types/place.types.ts

// Interface สำหรับ GeoJSON Point
export interface geoJSONPoint {
  type: 'Point';
  coordinates: [number, number]; // [longitude, latitude]
}

export interface placeCore {
  place_id: string; // pk in place table
  name_place: string;
  formatted_address: string;
  location: geoJSONPoint;
  last_update_data : Date;
}

export interface placeExtras {
  place_id_by_ggm :string | null; //place id from google map
  rating? : number | null;
  user_rating_total? : number | null;
  sumary_place? : string | null;
  url? : string | null;
  category: string[] | null;
}

// Interface หลักสำหรับข้อมูลสถานที่
export type Place = placeCore & placeExtras;

// Input สำหรับฟังก์ชัน processPlaces
export interface ResolveInput {
  location: geoJSONPoint; // from frontend
  place_id_by_ggm: string; // from frontend
}