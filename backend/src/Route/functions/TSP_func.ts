// src/Route/functions/TSP_func.ts

import { RouteResult, TSPSolveOptions, type PlaceItem } from "../types/types";
import { getRoute } from "./getRoute";

/** Ensure PlaceItem has a valid GeoJSON Point and return [lon, lat] */
function getLonLat(p: PlaceItem, i: number): [number, number] {
  if (!p.location || p.location.type !== "Point" || !Array.isArray(p.location.coordinates)) {
    throw new Error(`PlaceItem[${i}] is missing a valid GeoJSON Point location`);
  }
  const [lon, lat] = p.location.coordinates;
  if (
    typeof lon !== "number" || typeof lat !== "number" ||
    lon < -180 || lon > 180 || lat < -90 || lat > 90
  ) {
    throw new Error(`PlaceItem[${i}] has invalid lon/lat: [${lon}, ${lat}]`);
  }
  return [lon, lat];
}

/** Haversine distance (km) using PlaceItem.location */
function haversineKm(a: PlaceItem, b: PlaceItem): number {
  const [lon1, lat1] = getLonLat(a, -1);
  const [lon2, lat2] = getLonLat(b, -1);
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * (Math.sin(dLon / 2) ** 2);
  return 2 * R * Math.asin(Math.sqrt(s1 + s2));
}

/** Sum of Haversine along an order of indices */
function pathHaversineKmByOrder(places: PlaceItem[], order: number[]): number {
  let sum = 0;
  for (let i = 0; i < order.length - 1; i++) {
    sum += haversineKm(places[order[i]], places[order[i + 1]]);
  }
  return sum;
}

/** Evaluate a full order using ORS real route distance once (km). */
async function pathRealKmByOrder(places: PlaceItem[], order: number[]): Promise<number> {
  const first = places[order[0]].location;
  const last = places[order[order.length - 1]].location;
  const vias = order.slice(1, -1).map(i => places[i].location);
  try {
    const { route } = await getRoute(first, last, vias);
    return route.distance / 1000; // meters -> km
  } catch {
    // Fallback หาก ORS ล้มเหลว ใช้ Haversine แทน
    return pathHaversineKmByOrder(places, order);
  }
}

/** Simple permutations generator for small arrays */
function* permutations<T>(arr: T[]): Generator<T[]> {
  const a = arr.slice();
  const n = a.length;
  const c = new Array(n).fill(0);
  yield a.slice();
  let i = 0;
  while (i < n) {
    if (c[i] < i) {
      if (i % 2 === 0) {
        [a[0], a[i]] = [a[i], a[0]];
      } else {
        [a[c[i]], a[i]] = [a[i], a[c[i]]];
      }
      yield a.slice();
      c[i] += 1;
      i = 0;
    } else {
      c[i] = 0;
      i += 1;
    }
  }
}

/** Greedy nearest-neighbor สำหรับจุดกลาง (ตรึงปลายทางสองด้าน) */
function nearestNeighborOrder(places: PlaceItem[], start: number, end: number, mids: number[]): number[] {
  const remaining = new Set(mids);
  const order = [start];
  let curr = start;
  while (remaining.size > 0) {
    let best: number | null = null;
    let bestD = Infinity;
    for (const j of remaining) {
      const d = haversineKm(places[curr], places[j]);
      if (d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best === null) break;
    order.push(best);
    remaining.delete(best);
    curr = best;
  }
  order.push(end);
  return order;
}

/** 2-opt improvement (ใช้ Haversine เร็ว ๆ) ปลายทางคงที่ */
function twoOptImprove(places: PlaceItem[], order: number[]): number[] {
  const n = order.length;
  let improved = true;
  let bestOrder = order.slice();
  let bestLen = pathHaversineKmByOrder(places, bestOrder);

  while (improved) {
    improved = false;
    for (let i = 1; i < n - 2; i++) {       // skip fixed start
      for (let k = i + 1; k < n - 1; k++) { // skip fixed end
        const newOrder = bestOrder.slice(0, i)
          .concat(bestOrder.slice(i, k + 1).reverse(), bestOrder.slice(k + 1));
        const newLen = pathHaversineKmByOrder(places, newOrder);
        if (newLen + 1e-9 < bestLen) {
          bestLen = newLen;
          bestOrder = newOrder;
          improved = true;
        }
      }
    }
  }
  return bestOrder;
}

/**
 * แก้ TSP แบบตรึงปลายทาง: order[0] = input[0], order[n-1] = input[n-1]
 * - n <= bruteForceLimit -> exact (permute mids)
 * - อื่น ๆ -> nearest neighbor + 2-opt
 * คืนค่า: { path, order, distanceKm (haversine), distanceKmReal? }
 */
export async function solveTSPFromPlaces(
  places: PlaceItem[],
  opts: TSPSolveOptions = {}
): Promise<{ path: PlaceItem[]; }> {
  if (!Array.isArray(places) || places.length < 2) {
    throw new Error("solveTSPFromPlaces: need at least 2 places (start & end).");
  }

  // ตรวจพิกัดให้ครบก่อน จะได้ fail ไว
  for (let i = 0; i < places.length; i++) getLonLat(places[i], i);

  const n = places.length;
  const start = 0;
  const end = n - 1;

  const mids: number[] = [];
  for (let i = 1; i < n - 1; i++) mids.push(i);

  const distanceMode = opts.distanceMode ?? "haversine";
  const bruteForceLimit = opts.bruteForceLimit ?? 9;

  let bestOrder: number[] | null = null;
  let bestScore = Infinity;

  if (n <= bruteForceLimit) {
    // exact search (permute mids)
    for (const perm of permutations(mids)) {
      const order = [start, ...perm, end];
      const score = pathHaversineKmByOrder(places, order);
      if (score < bestScore) {
        bestScore = score;
        bestOrder = order;
      }
    }
  } else {
    // heuristic
    const nn = nearestNeighborOrder(places, start, end, mids);
    bestOrder = twoOptImprove(places, nn);
    bestScore = pathHaversineKmByOrder(places, bestOrder);
  }

  if (!bestOrder) {
    const fallback = [start, ...mids, end];
    return {
      path: fallback.map(i => places[i]),
    };
  }
  
  return { path: bestOrder.map(i => places[i]) };
}
