// src/place/functions/mapPlaceData.ts

import { Place, geoJSONPoint } from '../types/place.type';
import { PlaceDbRow } from '../types/database.type';

/**
 * แปลงข้อมูลจากแถวในฐานข้อมูลให้เป็นอ็อบเจกต์ Place
 * @param row - ข้อมูลดิบจากฐานข้อมูล
 * @returns An object conforming to the Place interface.
 */
export function mapDbRowToPlace(row: PlaceDbRow): Place {
  const locationJSON = JSON.parse(row.location) as geoJSONPoint;

  return {
    place_id: row.place_ID,
    name_place: row.name_place,
    formatted_address: row.address, // Map 'address' from DB to 'formatted_address'
    location: locationJSON,
    last_update_data: row.last_update_data,
    place_id_by_ggm: row.place_ID_by_ggm,
    rating: row.rating,
    user_rating_total: row.user_rating_total,
    sumary_place: row.sumary_place,
    url: row.url,
    category: row.category,
  };
}