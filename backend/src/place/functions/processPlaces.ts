// src/place/services/processPlaces.ts

import { Place, ResolveInput } from '../types/place.type';
import { findPlaceInDB } from './findPlaceInDB';
import { fetchGooglePlaceDetails } from './fetchGooglePlaceDetails';
import { savePlaceToDB } from './savePlaceToDB';
import { updatePlaceInDB } from './updatePlaceInDB';

/**
 * ประมวลผลรายการสถานที่: ตรวจสอบใน DB, ดึงข้อมูลใหม่จาก Google หากจำเป็น, และบันทึกหรืออัปเดต
 *
 * @param inputs - Array ของ ResolveInput ที่มี GGM ID และ Location
 * @param apiKey - Google Maps API Key
 * @returns A Promise that resolves to an array of complete `Place` objects.
 */
export async function processPlaces(
  inputs: ResolveInput[],
  apiKey: string
): Promise<Place[]> {
  if (!apiKey) throw new Error('Google Maps API Key is required.');

  const STALE_PERIOD_MONTHS = 3;
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - STALE_PERIOD_MONTHS);

  const placePromises = inputs.map(async (input) => {
    try {
      const existingPlace = await findPlaceInDB(input.place_id_by_ggm, input.location);

      if (!existingPlace) {
        console.log(`[CREATE] 🕵️ ไม่พบ "${input.place_id_by_ggm}", กำลังดึงข้อมูล...`);
        const newPlace = await fetchGooglePlaceDetails(input.place_id_by_ggm, apiKey);
        if (newPlace) {
          await savePlaceToDB(newPlace);
          return newPlace;
        }
        return null;
      }

      if (existingPlace.last_update_data < threeMonthsAgo) {
        console.log(`[UPDATE] 🔄 ข้อมูลของ "${existingPlace.name_place}" เก่า, กำลังอัปเดต...`);
        const freshPlace = await fetchGooglePlaceDetails(input.place_id_by_ggm, apiKey);
        if (freshPlace) {
          // ใช้ Primary Key ของข้อมูลเดิมในการอัปเดต
          return await updatePlaceInDB(existingPlace.place_id, freshPlace);
        }
        console.warn(`[UPDATE-WARN] ไม่สามารถดึงข้อมูลใหม่สำหรับ "${existingPlace.name_place}", ใช้ข้อมูลเก่า`);
        return existingPlace;
      }

      console.log(`[CACHE HIT] ✅ ข้อมูลของ "${existingPlace.name_place}" ยังใหม่, ใช้ข้อมูลจาก DB`);
      return existingPlace;

    } catch (error) {
      console.error(`เกิดข้อผิดพลาดระหว่างประมวลผล ${input.place_id_by_ggm}:`, error);
      return null;
    }
  });

  const settledResults = await Promise.all(placePromises);
  return settledResults.filter((p): p is Place => p !== null);
}