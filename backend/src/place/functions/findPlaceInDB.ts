// src/place/functions/findPlaceInDB.ts

import {db} from '../../database/db-promise';
import type {place , geoJSONPoint} from '../../database/database.types'
import {mapDbRowToPlace} from './mapPlaceData';

/**
 * ค้นหาสถานที่ในฐานข้อมูล (DB)
 * 1. ค้นหาด้วย Google Maps Place ID (`place_ID_by_ggm`) ก่อน
 * 2. หากไม่พบ ให้ค้นหาสถานที่ที่ใกล้ที่สุดจากพิกัดที่กำหนดภายในรัศมีที่กำหนด
 *
 * @param googlePlaceId - The Place ID จาก Google Maps
 * @param searchLocation - The geoJSONPoint location to use as a fallback search.
 * @returns A Promise that resolves to a `Place` object or `null` if not found.
 */
export async function findPlaceInDB(
  googlePlaceId: string,
  searchLocation: geoJSONPoint
): Promise<place | null> {
  const BASE_QUERY = `
    SELECT
      "place_ID", name_place, address, ST_AsGeoJSON(location) as location, rating,
      user_rating_total, sumary_place, "place_ID_by_ggm",
      category, url, last_update_data
    FROM public.place
  `;

  try {
    const queryById = `${BASE_QUERY} WHERE "place_ID_by_ggm" = $/googlePlaceId/`;
    const placeById = await db.oneOrNone<place>(queryById, { googlePlaceId });

    if (placeById) {
      return mapDbRowToPlace(placeById);
    }

    const SEARCH_RADIUS_METERS = 50;
    const queryByLocation = `
      ${BASE_QUERY}
      WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint($/longitude/, $/latitude/), 4326), $/radius/)
      ORDER BY ST_Distance(location, ST_SetSRID(ST_MakePoint($/longitude/, $/latitude/), 4326)) ASC
      LIMIT 1;
    `;
    const placeByLocation = await db.oneOrNone<PlaceDbRow>(queryByLocation, {
      longitude: searchLocation.coordinates[0],
      latitude: searchLocation.coordinates[1],
      radius: SEARCH_RADIUS_METERS,
    });

    return placeByLocation ? mapDbRowToPlace(placeByLocation) : null;

  } catch (error) {
    console.error('❌ เกิดข้อผิดพลาดในการค้นหาข้อมูลสถานที่:', error);
    throw new Error('Failed to query place from the database.');
  }
}