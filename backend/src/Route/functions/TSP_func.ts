// src/Route/functions/TSP_func.ts
import 'dotenv/config';
import { TSPSolveOptions, type PlaceItem } from "../types/types";

 const ORS_MATRIX_URL = "https://api.openrouteservice.org";
 const ORS_MATRIX_TIMEOUT_MS = 20000; // 20 วินาที
 const ORS_API_KEY = String(process.env.ORS_API_KEY);

// ====== Helpers: ระยะทาง ======
function buildHaversineMatrix(coords: [number, number][]): number[][] {
  const n = coords.length;
  const D: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dij = haversineMeters(coords[i], coords[j]);
      D[i][j] = dij;
      D[j][i] = dij;
    }
  }
  return D;
}

function haversineMeters(a: [number, number], b: [number, number]): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const [lon1, lat1] = a;
  const [lon2, lat2] = b;
  const R = 6371000; // m
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * (Math.sin(dLon / 2) ** 2);
  return 2 * R * Math.asin(Math.sqrt(s1 + s2));
}

async function buildORSMatrix(
  coords: [number, number][],
): Promise<number[][]> {
  if (coords.length > 50) {
    throw new Error(`ORS Matrix จำกัดสูงสุด 50 จุดต่อคำขอ (ปัจจุบัน: ${coords.length})`);
  }
  
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORS_MATRIX_TIMEOUT_MS);

  try {
    const resp = await fetch(`${ORS_MATRIX_URL}/v2/matrix/${encodeURIComponent("driving-car")}`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: ORS_API_KEY,
      },
      body: JSON.stringify({
        locations: coords,          // [[lon,lat], ...]
        metrics: ['distance'],      // ขอระยะทาง (เมตร)
        resolve_locations: false,   // ไม่ต้อง snap/แก้พิกัด
      }),
    });

    if (!resp.ok) {
      const text = await safeText(resp);
      throw new Error(`ORS Matrix error: ${resp.status} ${resp.statusText} - ${text}`);
    }

    const json = (await resp.json()) as { distances?: number[][] };
    const D = json.distances;
    if (!D || !Array.isArray(D) || D.length !== coords.length) {
      throw new Error('ORS Matrix response missing or invalid "distances"');
    }
    return D;
  } catch (err) {
    if ((err as any)?.name === 'AbortError') {
      throw new Error('ORS Matrix request timed out');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return '';
  }
}

function sanitizeMatrix(D: number[][]): void {
  const n = D.length;
  for (let i = 0; i < n; i++) {
    if (!Array.isArray(D[i]) || D[i].length !== n) {
      throw new Error('Distance matrix is not square');
    }
    for (let j = 0; j < n; j++) {
      const v = D[i][j];
      if (!isFinite(v)) D[i][j] = Number.POSITIVE_INFINITY;
      if (i === j) D[i][j] = 0;
    }
  }
}

function pathLengthFromMatrix(order: number[], D: number[][]): number {
  let sum = 0;
  for (let k = 0; k < order.length - 1; k++) {
    const i = order[k];
    const j = order[k + 1];
    const dij = D[i][j];
    if (!isFinite(dij)) return Number.POSITIVE_INFINITY;
    sum += dij;
  }
  return sum;
}

// ====== Helpers: คณิต/perm ======
function* permutations<T>(arr: T[]): Generator<T[]> {
  // Heap's algorithm
  const a = arr.slice();
  const n = a.length;
  const c = new Array(n).fill(0);
  if (n === 0) {
    yield [];
    return;
  }
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

function range(lo: number, hi: number): number[] {
  // รวม lo..hi (ถ้า hi < lo -> [])
  const out: number[] = [];
  for (let i = lo; i <= hi; i++) out.push(i);
  return out;
}

function required<T>(v: T | undefined, msg: string): T {
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) {
    throw new Error(msg);
  }
  return v;
}
// ====== Main function ======
/**
 * แก้ TSP แบบตรึงปลายทาง: order[0] = input[0], order[n-1] = input[n-1]
 * - n <= bruteForceLimit -> exact (permute mids)
 * - อื่น ๆ -> nearest neighbor + 2-opt
 * คืนค่า: { path, order, distanceKm (haversine), distanceKmReal? }
 */
export async function solveTSPFromPlaces(
  places: PlaceItem[],
  opts: TSPSolveOptions
): Promise<PlaceItem[]> {
  if (!Array.isArray(places) || places.length < 2) {
    return places.slice();
  }

  // validate GeoJSON & extract lon/lat
  const coords: [number, number][] = places.map((p, i) => {
    if (!p?.location || p.location.type !== 'Point' || !Array.isArray(p.location.coordinates)) {
      throw new Error(`places[${i}] missing valid GeoJSON Point`);
    }
    const [lon, lat] = p.location.coordinates;
    if (!isFinite(lon) || !isFinite(lat) || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
      throw new Error(`places[${i}] has invalid coordinates [${lon}, ${lat}]`);
    }
    return [lon, lat];
  });

  const n = places.length;
  if (n === 2) return places.slice(); // แค่ start->end ไม่มีอะไรให้เรียง

  const limitMids = opts.limitMids ?? 9;
  const midsCount = Math.max(0, n - 2);
  if (midsCount > limitMids) {
    throw new Error(
      `จำนวนจุดกลาง = ${midsCount} เกินเพดาน brute force (${limitMids}). โปรดลดจำนวนจุดหรือเพิ่ม limitMids`
    );
  }

  // เตรียม "ระยะทางคู่ต่อคู่" เป็นเมทริกซ์ (หน่วย: เมตร)
  const D =
    opts.mode === 'haversine'
      ? buildHaversineMatrix(coords)
      : await buildORSMatrix(coords);

  // ค่าที่ ORS อาจให้ null/undefined/Infinity (ไม่มีเส้นทาง) → ถือว่าเป็น "ตัน" (Infinity)
  sanitizeMatrix(D);

  // brute force เฉพาะจุดกลาง
  const start = 0;
  const end = n - 1;
  const mids = range(1, n - 2); // 1..n-2

  let bestOrder: number[] | null = null;
  let bestLen = Number.POSITIVE_INFINITY;

  for (const perm of permutations(mids)) {
    const order = [start, ...perm, end];
    const len = pathLengthFromMatrix(order, D);
    if (len < bestLen) {
      bestLen = len;
      bestOrder = order;
    }
  }

  if (!bestOrder) {
    // ไม่พบทางที่ใช้ได้ (เช่น มีคู่ที่ไปไม่ถึง) -> คืนลำดับเดิม
    return places.slice();
  }

  return bestOrder.map((i) => places[i]);
}