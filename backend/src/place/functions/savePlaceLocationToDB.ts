// src/place/functions/savePlaceLocationToDB.ts

import {db} from '../../database/db-promise';
import {geoJSONPoint} from '../types/place.type';

/**
 * บันทึกข้อมูลเฉพาะ Place ID และ Location ลงในฐานข้อมูล
 *
 * @param placeId - The UUID ที่สร้างขึ้นสำหรับสถานที่นี้
 * @param location - อ็อบเจกต์ geoJSONPoint ที่มีพิกัดของสถานที่
 * @throws Will throw an error if the database operation fails.
 */
export async function savePlaceLocationToDB(
  placeId: string,
  location: geoJSONPoint
): Promise<void> {
  const insertQuery = `
    INSERT INTO public.place("place_ID", location, last_update_data)
    VALUES ($/placeId/, ST_SetSRID(ST_MakePoint($/longitude/, $/latitude/), 4326), $/last_update_data/);
  `;
  try {
    await db.none(insertQuery, {
      placeId: placeId,
      longitude: location.coordinates[0],
      latitude: location.coordinates[1],
      last_update_data: new Date(),
    });
    console.log(`✔️ บันทึก Location (ID: ${placeId}) ลงฐานข้อมูลสำเร็จ`);
  } catch (error) {
    console.error(`❌ เกิดข้อผิดพลาดในการบันทึก Location (ID: ${placeId}):`, error);
    throw new Error('Failed to save place location to the database.');
  }
}