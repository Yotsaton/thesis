import type { PlaceItem, GeoJSONPoint } from "../types";

// ใช้ VITE_API_URL จากไฟล์ .env เพื่อความยืดหยุ่น
const API_URL = import.meta.env.VITE_API_URL;

async function apiRequest(endpoint: string, body: object, method: 'POST' | 'GET' = 'POST'): Promise<any> {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
    }
    return res.json();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "A network error occurred.";
    console.error(`API request error to ${endpoint}:`, error);
    return { success: false, message: errorMessage };
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