// src/Route/functions/TSP_func.ts

import { type PlaceItem } from "../types/types";

function getLonLat(p: PlaceItem, i: number): [number, number] {
  if (!p.location || p.location.type !== 'Point' || !Array.isArray(p.location.coordinates)) {
    throw new Error(`PlaceItem[${i}] is missing a valid GeoJSON Point location`);
  }
  const [lon, lat] = p.location.coordinates;
  if (
    typeof lon !== 'number' || typeof lat !== 'number' ||
    lon < -180 || lon > 180 || lat < -90 || lat > 90
  ) {
    throw new Error(`PlaceItem[${i}] has out-of-range coordinates [${lon}, ${lat}]`);
  }
  return [lon, lat];
}

// Haversine distance (กิโลเมตร)
function haversineKm(a: PlaceItem, b: PlaceItem): number {
  const [lon1, lat1] = getLonLat(a, -1);
  const [lon2, lat2] = getLonLat(b, -1);
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1r = lat1 * Math.PI / 180;
  const lat2r = lat2 * Math.PI / 180;

  const h = Math.sin(dLat/2) ** 2 + Math.cos(lat1r) * Math.cos(lat2r) * Math.sin(dLon/2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function pathDistanceKmByIndices(places: PlaceItem[], idx: number[]): number {
  let sum = 0;
  for (let i = 0; i < idx.length - 1; i++) {
    sum += haversineKm(places[idx[i]], places[idx[i+1]]);
  }
  return sum;
}

// สร้าง permutation แบบง่าย
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
 * หาเส้นทางสั้นสุด (กม.) โดยตรึงจุดแรกเป็น start และจุดสุดท้ายเป็น end
 * คืน { path, distance } โดย:
 *  - path: PlaceItem[] ตามลำดับเดินทาง
 *  - distance: ระยะรวมหน่วยกิโลเมตร (approx ด้วย Haversine)
 */
export function solveTSPFromPlaces(
  places: PlaceItem[]
): { path: PlaceItem[]} {
  if (!Array.isArray(places) || places.length < 2) {
    throw new Error('Need at least two places (start and end).');
  }

  // ตรวจพิกัดทุกจุดให้ครบก่อน (จะได้ fail ไว)
  for (let i = 0; i < places.length; i++) {
    getLonLat(places[i], i);
  }

  const n = places.length;
  const start = 0;
  const end = n - 1;

  // ดัชนีของจุดกลาง
  const midIdx: number[] = [];
  for (let i = 1; i < n - 1; i++) midIdx.push(i);

  // ไม่มี/มีจุดกลาง 1 จุด → ตอบตรง ๆ
  if (midIdx.length < 2) {
    const order = [start, ...midIdx, end];
    return { path: order.map(i => places[i])};
  }

  // brute-force เฉพาะจุดกลาง
  let bestOrder: number[] | null = null;
  let bestDist = Infinity;

  for (const perm of permutations(midIdx.slice())) {
    const candidate = [start, ...perm, end];
    const dist = pathDistanceKmByIndices(places, candidate);
    if (dist < bestDist) {
      bestDist = dist;
      bestOrder = candidate;
    }
  }

  if (!bestOrder) {
    const fallback = [start, ...midIdx, end];
    return { path: fallback.map(i => places[i])};
  }

  return { path: bestOrder.map(i => places[i])};
}
