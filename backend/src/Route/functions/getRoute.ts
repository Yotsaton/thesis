  // src/Route/functions/getRoute.ts
import "dotenv/config";
import {ORSGeoJSONResponse, RouteResult} from "../types/types";
import type { place, geoJSONPoint} from "../../database/database.types";

const API_KEY = process.env.ORS_API_KEY!;
const ORS_URL = "https://api.openrouteservice.org/v2/directions/driving-car";

if (!API_KEY) {
  // เตือนตั้งแต่ตอนโหลดโมดูล จะได้รู้ว่า env ไม่ครบ
  console.warn("[getRoute] WARNING: ORS_API_KEY is not set.");
}

/** แปลง geoJSONPoint -> [lon, lat] พร้อมตรวจสอบขอบเขต */
function toLonLat(p: geoJSONPoint, label: string): [number, number] {
  if (!p || p.type !== "Point" || !Array.isArray(p.coordinates) || p.coordinates.length !== 2) {
    throw new Error(`Invalid geoJSONPoint for ${label}`);
  }
  const [lon, lat] = p.coordinates;
  if (typeof lon !== "number" || typeof lat !== "number" || lon < -180 || lon > 180 || lat < -90 || lat > 90) {
    throw new Error(`Invalid coordinates range for ${label}`);
  }
  return [lon, lat];
}

/**
 * คำนวณเส้นทางด้วย ORS โปรไฟล์ driving-car
 * รับ origin, destination, waypoint[] (GeoJSON Point)
 * คืนค่า { route } ที่ประกอบด้วย distance, duration, geometry และ segments (distance/duration ต่อช่วง)
 */
export async function getRoute(
  origin: geoJSONPoint,
  destination: geoJSONPoint,
  waypoint: geoJSONPoint[] = []
): Promise<{ route: RouteResult}> {
  // 1) เตรียมลำดับพิกัด [origin, ...waypoint, destination]
  const coords: [number, number][] = [
    toLonLat(origin, "origin"),
    ...waypoint.map((w, i) => toLonLat(w, `waypoint[${i}]`)),
    toLonLat(destination, "destination"),
  ];

  if (coords.length < 2) {
    throw new Error("At least origin and destination are required");
  }

  // 2) เรียก ORS (รูปแบบ geojson) ปิด instructions เพื่อตัด steps ออก เหลือแต่ segments
  const res = await fetch(`${ORS_URL}/geojson`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: API_KEY, // ส่งค่า key ตรง ๆ (ไม่ใช่ Bearer)
    },
    body: JSON.stringify({
      coordinates: coords,
      instructions: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`OpenRouteService error: ${res.status} ${res.statusText} ${text}`);
  }

  const data = (await res.json()) as ORSGeoJSONResponse;

  if (!data.features?.length) {
    throw new Error("No route found from OpenRouteService");
  }
  // 3) ดึงข้อมูลที่ต้องการจาก feature แรก
  const feature = data.features[0];
  const routeResult: RouteResult = {
    distance: feature.properties?.summary?.distance ?? 0, // meters
    duration: feature.properties?.summary?.duration ?? 0, // seconds
    geometry: feature.geometry,
    segments: (feature.properties?.segments ?? []).map(seg => ({
      distance: seg.distance ?? 0,
      duration: seg.duration ?? 0,
    })),
  };

  if (!routeResult.geometry || routeResult.geometry.type !== "LineString" || !Array.isArray(routeResult.geometry.coordinates)) {
    throw new Error("Invalid geometry from OpenRouteService");
  }
  return { route: routeResult };
}


/**
 * เรียก ORS โดยรับ Place[] โดยตรง (ตามลำดับที่ให้มา)
 * @param places ลำดับสถานที่
 * @return RouteResult { distance, duration, geometry, segments }
 */
export async function getRouteFromPlaces(places: place[]): Promise<RouteResult> {
  const { route } = await getRoute(
    places[0].location,
    places[places.length - 1].location,
    places.slice(1, -1).map(p => p.location)
  );
  return route;
}
