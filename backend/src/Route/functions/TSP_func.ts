// src/Route/functions/TSP_func.ts
import type { place } from "../../database/database.types";

/**
 * คำนวณระยะทาง Haversine ระหว่างจุดสองจุด (หน่วย: กิโลเมตร)
 * @param a สถานที่จุดแรก (Place)
 * @param b สถานที่จุดสอง (Place)
 * @returns ระยะทางระหว่างสองจุด (กิโลเมตร)
 */
function distanceBetweenPlaces(a: place, b: place): number {
  const [lon1, lat1] = a.location.coordinates; // GeoJSON: [lon, lat]
  const [lon2, lat2] = b.location.coordinates;

  const R = 6371; // รัศมีโลก (กิโลเมตร)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;

  const h = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * คำนวณระยะทางรวมของเส้นทางตามลำดับดัชนีในอาร์เรย์ places
 * @param places อาร์เรย์ของ Place
 * @param indices ลำดับ index ของสถานที่ตามเส้นทาง
 * @returns ระยะทางรวมของเส้นทาง (กิโลเมตร)
 */
function pathDistanceByIndices(places: place[], indices: number[]): number {
  let total = 0;
  for (let i = 0; i < indices.length - 1; i++) {
    total += distanceBetweenPlaces(places[indices[i]], places[indices[i + 1]]);
  }
  return total;
}

/**
 * ตัวสร้าง Permutation ของอาร์เรย์ (แบบ Generator)
 * @param arr อาร์เรย์ข้อมูล
 * @param start ตำแหน่งเริ่มต้น (ใช้ภายใน recursion)
 * @yields แต่ละ Permutation ของอาร์เรย์
 */
function* permutations<T>(arr: T[], start = 0): Generator<T[]> {
  if (start >= arr.length - 1) {
    yield arr.slice();
    return;
  }
  for (let i = start; i < arr.length; i++) {
    [arr[start], arr[i]] = [arr[i], arr[start]];
    yield* permutations(arr, start + 1);
    [arr[start], arr[i]] = [arr[i], arr[start]];
  }
}

/**
 * คำนวณเส้นทาง TSP แบบมีจุดเริ่มและจุดสิ้นสุด โดยไม่ใช้ solveTSPWithStartEnd
 * (Brute-force: ลองทุกลำดับของจุดกลาง เลือกระยะทางที่สั้นที่สุด)
 *
 * @param places รายการสถานที่ทั้งหมด (Place[])
 * @param startPlaceId place_id ของจุดเริ่มต้น
 * @param endPlaceId place_id ของจุดสิ้นสุด
 * @returns วัตถุ { path: Place[], distance: number }
 *          - path: ลำดับสถานที่ตามเส้นทางที่สั้นที่สุด
 *          - distance: ระยะทางรวม (กิโลเมตร)
 *
 * @throws Error ถ้าจำนวนสถานที่น้อยกว่า 2 หรือหา start/end ไม่พบ
 *
 * @note วิธีนี้มีความซับซ้อน O(n!) กับจำนวนจุดกลาง
 *       ใช้ได้กับจำนวนจุดไม่เยอะ (< 10) ถ้าจุดเยอะควรใช้ heuristic หรือ DP
 */
export function solveTSPFromPlaces(
  places: place[],
  startPlaceId: string,
  endPlaceId: string
): { path: place[]; distance: number } {
  if (!places || places.length < 2) {
    throw new Error('Need at least two places (start and end).');
  }

  const startIndex = places.findIndex(p => p.id === startPlaceId);
  if (startIndex < 0) throw new Error(`startPlaceId not found: ${startPlaceId}`);

  const endIndex = places.findIndex(p => p.id === endPlaceId);
  if (endIndex < 0) throw new Error(`endPlaceId not found: ${endPlaceId}`);

  // ดัชนีของจุดกลาง (ไม่นับ start/end)
  const intermediate: number[] = [];
  for (let i = 0; i < places.length; i++) {
    if (i !== startIndex && i !== endIndex) intermediate.push(i);
  }

  // กรณีมีจุดกลาง ≤ 1 คำนวณตรงๆ
  if (intermediate.length < 2) {
    const simplePath = [startIndex, ...intermediate, endIndex];
    const dist = pathDistanceByIndices(places, simplePath);
    return { path: simplePath.map(i => places[i]), distance: dist };
  }

  // หาลำดับที่สั้นที่สุด
  let bestOrder: number[] | null = null;
  let bestDistance = Infinity;

  for (const perm of permutations(intermediate.slice())) {
    const candidate = [startIndex, ...perm, endIndex];
    const dist = pathDistanceByIndices(places, candidate);
    if (dist < bestDistance) {
      bestDistance = dist;
      bestOrder = candidate;
    }
  }

  if (!bestOrder) {
    // fallback
    const fallback = [startIndex, ...intermediate, endIndex];
    const dist = pathDistanceByIndices(places, fallback);
    return { path: fallback.map(i => places[i]), distance: dist };
  }

  return { path: bestOrder.map(i => places[i]), distance: bestDistance };
}
