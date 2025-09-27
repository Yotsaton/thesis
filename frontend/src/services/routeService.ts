//src/services/routeService.ts 
import type { PlaceItem, Trip } from "../types";

// ใช้ VITE_API_URL จากไฟล์ .env เพื่อความยืดหยุ่น
const API_URL = import.meta.env.VITE_API_URL;

async function apiRequest(endpoint: string, body: object, method: 'POST' | 'GET' = 'POST'): Promise<any> {
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      method,
      credentials: "include", // สำคัญมาก สำหรับการส่ง token cookie
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errorData.message || 'An HTTP error occurred');
    }
    return res.json();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "A network error occurred.";
    console.error(`API request error to ${endpoint}:`, error);
    return { success: false, message: errorMessage };
  }
}

// ฟังก์ชันสำหรับเรียก API /route/withTSP
export async function optimizeDayRoute(places: PlaceItem[]): Promise<{ success: boolean; ordered?: PlaceItem[]; route?: any; message?: string }> {
  return apiRequest('/auth/route/withTSP', { places });
}