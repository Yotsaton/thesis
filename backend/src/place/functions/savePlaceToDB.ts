// src/place/functions/savePlaceToDB.ts

import {db} from '../../database/db-promise';
import {Place} from '../types/place.type';

/**
 * บันทึกข้อมูลสถานที่ (Place) ลงในฐานข้อมูล PostgreSQL
 *
 * @param place - อ็อบเจกต์ข้อมูลสถานที่ที่ต้องการบันทึก
 * @throws Will throw an error if the database operation fails.
 */
export async function savePlaceToDB(place: Place): Promise<void> {
  const insertQuery = `
    INSERT INTO public.place(
      "place_ID", name_place, address, location, rating,
      user_rating_total, sumary_place, "place_ID_by_ggm",
      category, url, last_update_data
    ) VALUES (
      $/place_id/, $/name_place/, $/formatted_address/,
      ST_SetSRID(ST_MakePoint($/longitude/, $/latitude/), 4326),
      $/rating/, $/user_rating_total/, $/sumary_place/,
      $/place_id_by_ggm/, $/category/, $/url/, $/last_update_data/
    );
  `;

  try {
    await db.none(insertQuery, {
      ...place,
      longitude: place.location.coordinates[0],
      latitude: place.location.coordinates[1],
    });
    console.log(`✔️ บันทึกสถานที่ "${place.name_place}" ลงฐานข้อมูลสำเร็จ`);
  } catch (error) {
    console.error(`❌ เกิดข้อผิดพลาดในการบันทึกข้อมูลสถานที่ (ID: ${place.place_id}):`, error);
    throw new Error('Failed to save place to the database.');
  }
}