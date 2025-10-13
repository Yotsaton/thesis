import type { PlaceItem, GeoJSONPoint, Day } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

// --- Request cache / lock state ---
const lastCalls: Record<string, number> = {};
let lastRequestHash: string | null = null;
let lastRequestTime = 0;

/**
 * เรียก API อย่างปลอดภัย พร้อมระบบกันซ้ำ (debounce) ที่ชาญฉลาด
 */
async function apiRequest(
  endpoint: string,
  body: object,
  method: "POST" | "GET" = "POST",
  options: { force?: boolean } = {}
): Promise<any> {
  const now = Date.now();
  const bodyHash = JSON.stringify({ endpoint, body });
  const key = bodyHash;

  // 🔒 ป้องกันยิงซ้ำถี่เกิน 1.5 วิ
  if (lastCalls[key] && now - lastCalls[key] < 1500 && !options.force) {
    console.warn(`⏩ Skipped duplicate route API call: ${endpoint}`);
    return { success: false, message: "Skipped duplicate route request" };
  }
  lastCalls[key] = now;

  lastRequestHash = bodyHash;
  lastRequestTime = now;

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
    const message =
      error instanceof Error ? error.message : "A network error occurred.";
    console.error(`API request error to ${endpoint}:`, message);

    if (message.includes("missing GOOGLE_PLACES_API_KEY")) {
      console.warn("⚠️ Missing GOOGLE_PLACES_API_KEY — check backend .env");
    }

    return { success: false, message };
  }
}

export async function getDirections(
  origin: GeoJSONPoint,
  destination: GeoJSONPoint,
  waypoints: GeoJSONPoint[] = [],
  options: { force?: boolean } = {}
): Promise<{ success: boolean; route?: any; message?: string }> {
  return apiRequest(
    "/auth/route/",
    { origin, destination, waypoint: waypoints },
    "POST",
    options
  );
}

export async function optimizeDayRoute(places: PlaceItem[]): Promise<{
  success: boolean;
  ordered?: PlaceItem[];
  route?: any;
  message?: string;
}> {
  return apiRequest("/auth/route/withTSP", { places });
}

// ✅ สรุประยะทางและเวลาแบบใช้ cache geometry (ไม่ยิง API)
export async function summarizeDayRoute(
  day: Day
): Promise<{ distance: number; duration: number }> {
  const places = (day.items || []).filter(
    (i): i is PlaceItem => i.type === "place" && !!i.location?.coordinates
  );
  if (places.length < 2) return { distance: 0, duration: 0 };

  try {
    const segmentsStr = localStorage.getItem(`day-${day.id}-route-segments`);
    if (segmentsStr) {
      const segments: Array<{ distance: number; duration: number }> = JSON.parse(segmentsStr);
      const distance = segments.reduce((sum, s) => sum + (s?.distance || 0), 0);
      const duration = segments.reduce((sum, s) => sum + (s?.duration || 0), 0);
      return { distance, duration };
    }
  } catch (e) {
    console.warn(`[ROUTE] Failed to parse cache for ${day.id}`, e);
  }

  // 🧭 ถ้าไม่มี cache geometry ให้คืนค่า 0 เพื่อไม่ยิง API ซ้ำ
  console.log(`[ROUTE] No cached route for ${day.id}, skipping API.`);
  return { distance: 0, duration: 0 };
}