// src/Route/functions/getRoute.ts
import "dotenv/config";
import { RouteSummary, PlannedRoute } from "../types/route.types";
import type { place, geoJSONPoint} from "../../database/database.types";
import { solveTSPFromPlaces } from "./TSP_func";

const API_KEY = process.env.ORS_API_KEY!;
const ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-car";

/**
 * เรียก OpenRouteService ด้วยลิสต์พิกัด (lon/lat) ตามลำดับ
 * @param locations อาร์เรย์ของพิกัด (longitude/latitude) ตามลำดับการเดินทาง
 * @returns สรุปเส้นทางจริง (ระยะ, เวลา, คำสั่งนำทาง, geometry)
 */
export async function getRoute(locations: geoJSONPoint[]): Promise<RouteSummary> {
  if (locations.length < 2) {
    throw new Error("At least two locations are required");
  }

  // ORS ต้องการแค่ [lon, lat]
  const coords = locations.map(loc => [loc.coordinates[0], loc.coordinates[1]]);

  const res = await fetch(ORS_URL, {
    method: "POST",
    headers: {
      "Authorization": API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      coordinates: coords,
      // ปรับ option เพิ่มเติมได้ เช่น profile/avoid/features ฯลฯ
      instructions: true,
      geometry: true,
    }),
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`ORS error ${res.status}: ${msg}`);
  }

  const data = await res.json();
  const route = data.routes?.[0];
  if (!route) throw new Error("No route found from ORS");

  // แปลง steps
  const steps = (route.segments ?? []).flatMap((seg: any) =>
    (seg.steps ?? []).map((step: any) => ({
      instruction: step.instruction,
      distance: step.distance,
      duration: step.duration,
    }))
  );

  return {
    distance: route.summary.distance,
    duration: route.summary.duration,
    steps,
    geometry: route.geometry,
  };
}

/**
 * เรียก ORS โดยรับ Place[] โดยตรง (ตามลำดับที่ให้มา)
 * @param places ลำดับสถานที่
 */
export async function getRouteFromPlaces(places: place[]): Promise<RouteSummary> {
  return getRoute(places.map(p => p.location))
}

/**
 * (แนะนำใช้) คำนวณลำดับด้วย TSP แล้วขอเส้นทางจริงจาก ORS ต่อให้เลย
 * @param places รายการสถานที่ทั้งหมด
 * @param startPlaceId place_id จุดเริ่ม
 * @param endPlaceId place_id จุดจบ
 * @returns PlannedRoute { path: Place[], tspDistanceKm, route }
 */
export async function planTspAndGetRoute(
  places: place[],
  startPlaceId: string,
  endPlaceId: string
): Promise<PlannedRoute> {
  // 1) วางลำดับด้วย TSP (ฟังก์ชันของคุณที่คืน { path: Place[], distance })
  const { path, distance } = solveTSPFromPlaces(places, startPlaceId, endPlaceId);

  // 2) เรียก ORS เพื่อได้รายละเอียดเส้นทางจริง
  const route = await getRouteFromPlaces(path);

  return {
    path,
    tspDistanceKm: distance,
    route,
  };
}
