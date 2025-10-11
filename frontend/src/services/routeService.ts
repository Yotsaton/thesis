import type { PlaceItem, GeoJSONPoint } from "../types";

// ใช้ VITE_API_URL จากไฟล์ .env เพื่อความยืดหยุ่น
const API_URL = import.meta.env.VITE_API_URL;

let routeRequestLock = false;
let lastRouteTimestamp = 0;

async function apiRequest(endpoint: string, body: object, method: 'POST' | 'GET' = 'POST'): Promise<any> {
  const now = Date.now();
  if (routeRequestLock && now - lastRouteTimestamp < 700) {
    console.warn(`Skipped duplicate route API call: ${endpoint}`);
    return { success: false, message: "Skipped duplicate route request" };
  }
  routeRequestLock = true;
  lastRouteTimestamp = now;

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method,
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let msg = `HTTP error! status: ${res.status}`;
      try {
        const data = await res.json();
        msg = data.message || msg;
      } catch {}
      throw new Error(msg);
    }

    return await res.json();
  } catch (error) {
    const message = error instanceof Error ? error.message : "A network error occurred.";
    console.error(`API request error to ${endpoint}:`, message);

    // เพิ่ม fallback ตรวจ GOOGLE_PLACES_API_KEY หาย
    if (message.includes("missing GOOGLE_PLACES_API_KEY")) {
      console.warn("⚠️ Missing GOOGLE_PLACES_API_KEY — check backend .env or config file");
    }

    return { success: false, message };
  } finally {
    setTimeout(() => (routeRequestLock = false), 600);
  }
}

// 🔽 1. เพิ่มฟังก์ชันใหม่สำหรับเรียก API /route/ 🔽
/**
 * คำนวณเส้นทางจาก origin ไป destination โดยอาจมี waypoints
 * @param origin - จุดเริ่มต้น
 * @param destination - จุดสิ้นสุด
 * @param waypoints - จุดแวะ (ถ้ามี)
 */
export async function getDirections(
  origin: GeoJSONPoint, 
  destination: GeoJSONPoint, 
  waypoints: GeoJSONPoint[] = []
): Promise<{ success: boolean; route?: any; message?: string }> {
  return apiRequest('/auth/route/', { origin, destination, waypoint: waypoints });
}


// ฟังก์ชันสำหรับเรียก API /route/withTSP (ฟังก์ชันนี้ถูกต้องอยู่แล้ว)
export async function optimizeDayRoute(places: PlaceItem[]): Promise<{ success: boolean; ordered?: PlaceItem[]; route?: any; message?: string }> {
  return apiRequest('/auth/route/withTSP', { places });
}