// src/place/services/updatePlaceInDB.ts

import {db, pgp} from '../../database/db-promise';
import {Place, geoJSONPoint} from '../types/place.type';
import {findPlaceInDB} from './findPlaceInDB';
import {mapDbRowToPlace} from './mapPlaceData';

/**
 * อัปเดตข้อมูลของสถานที่ที่มีอยู่ โดยใช้ Primary Key (place_id)
 *
 * @param placeId - Primary key ของสถานที่ที่ต้องการอัปเดต
 * @param updateData - อ็อบเจกต์ที่มีข้อมูลใหม่ (อัปเดตเฉพาะฟิลด์ที่ส่งมา)
 * @returns A Promise that resolves to the updated `Place` object.
 */
export async function updatePlaceInDB(
  placeId: string,
  updateData: Partial<Omit<Place, 'place_id' | 'last_update_data'>>
): Promise<Place> {
  const cs = new pgp.helpers.ColumnSet([
      'name_place',
      { name: 'address', prop: 'formatted_address' },
      { name: 'location', mod: ':raw', init: (col) => {
          const loc = col.value as geoJSONPoint;
          return pgp.as.format('ST_SetSRID(ST_MakePoint(${lon}, ${lat}), 4326)', {
            lon: loc.coordinates[0], lat: loc.coordinates[1],
          });
        }},
      'rating', 'user_rating_total', 'sumary_place',
      { name: 'place_ID_by_ggm', prop: 'place_id_by_ggm' },
      'category', 'url', { name: 'last_update_data', cnd: true },
    ], { table: 'place' });

  const dataWithUpdateTimestamp = {...updateData, last_update_data: new Date()};

  try {
    const updateQuery = pgp.helpers.update(dataWithUpdateTimestamp, cs) +
                        pgp.as.format(' WHERE "place_ID" = ${id} RETURNING *', { id: placeId });

    const updatedDbRow = await db.one(updateQuery);
    console.log(`✔️ อัปเดตข้อมูล (ID: ${placeId}) สำเร็จ`);
    return mapDbRowToPlace(updatedDbRow);
  } catch (error) {
    console.error(`❌ เกิดข้อผิดพลาดระหว่างการอัปเดตข้อมูล (ID: ${placeId}):`, error);
    throw new Error('Failed to update place in the database.');
  }
}