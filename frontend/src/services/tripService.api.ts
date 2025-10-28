import { appState, setTripList, setCurrentTrip } from "../state/index.js";
import type { Trip } from "../types.js";
import { summarizeDayRoute } from "../services/routeService.js"; // ✅ ใช้อยู่แล้ว

// === Local UI Save Status ===
let saveTimeout: number;
function updateSaveStatus(message: string, isError: boolean = false): void {
  const statusEl = document.getElementById("save-status");
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffadad" : "#d8f1d8";

  window.clearTimeout(saveTimeout);
  if (message && !message.includes("Saving")) {
    saveTimeout = window.setTimeout(() => {
      if (statusEl) statusEl.textContent = "";
    }, 3000);
  }
}

// === API Config ===
const API_URL = import.meta.env.VITE_API_URL;
export let tripRequestInProgress = false;
export let pendingSave = false; // ✅ ระบบคิวบันทึกซ้ำ

// === API Helper ===
async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  if (tripRequestInProgress) {
    console.warn("[TripAPI] Busy, queued duplicate:", endpoint);
    pendingSave = true;
    return { success: false, message: "Queued for next save" };
  }

  tripRequestInProgress = true;
  const controller = new AbortController();

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errData.message || `HTTP ${res.status}`);
    }

    return await res.json();
  } catch (err) {
    console.error(`[TripAPI] Error @ ${endpoint}:`, err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Network error",
    };
  } finally {
    tripRequestInProgress = false;

    // ✅ ถ้ามีคิวค้างไว้ ให้ retry หลัง API เสร็จ
    if (pendingSave) {
      pendingSave = false;
      console.log("[TripAPI] Processing queued save...");
      setTimeout(() => saveCurrentTrip(), 300);
    }
  }
}

// === Load Trips ===
export async function loadTripList(): Promise<any> {
  const data = await apiRequest("/auth/trip/", { method: "GET" });
  if (data.success && Array.isArray(data.trips)) {
    const tripsForState: Trip[] = data.trips.map((trip: any) => ({
      ...trip,
      id: trip._id ?? null,
    }));
    setTripList(tripsForState);
  }
  return data;
}

export async function loadTrip(tripId: string): Promise<any> {
  const data = await apiRequest(`/auth/trip/${tripId}/full`, { method: "GET" });
  if (data.success && data.data) {
    const tripForState: Trip = { ...data.data, id: data.data.id ?? null };
    setCurrentTrip(tripForState);
  }
  return data;
}

// === Save Trip (with summary + safer control) ===
export async function saveCurrentTrip(): Promise<any> {
  if (tripRequestInProgress) {
    console.warn("[TripAPI] Skipped save: request still in progress");
    return;
  }

  const { currentTrip, currentTripId } = appState;
  console.log(`[TripAPI] Save triggered @${new Date().toLocaleTimeString()} | tripId=${currentTripId}`);

  // 🔒 ป้องกัน save ข้อมูลว่าง
  if (!currentTrip?.name?.trim() || !currentTrip.days?.length) {
    console.log("[TripAPI] Skip saving (empty trip).");
    return { success: false, message: "Trip is empty" };
  }

  // ✅ Normalize order ก่อนบันทึก (deep clone)
  try {
    for (const day of currentTrip.days) {
      if (day.items && Array.isArray(day.items)) {
        day.items = day.items.map((item, index) => ({
          ...structuredClone(item),
          order: index,
        }));
      }
    }
    console.log("[TripAPI] Normalized order:", currentTrip.days.map(d => d.items?.map(i => (i as any).order)));
  } catch (err) {
    console.warn("[TripAPI] Failed to normalize order:", err);
  }

  // 🧠 คำนวณ summary แต่ละวัน (client only)
  for (const day of currentTrip.days) {
    try {
      const summary = await summarizeDayRoute(day);
      (day as any).summary = summary;
    } catch (err) {
      console.warn("[TripAPI] Failed to summarize route:", err);
    }
  }

  console.log("[SUMMARY] Updated trip summaries:", currentTrip.days.map(d => d.summary));

  // 🚫 ไม่ส่ง summary ให้ backend
  const sanitizedTrip = {
    ...structuredClone(currentTrip),
    days: currentTrip.days.map(d => {
      const { summary, ...rest } = d;
      return rest;
    }),
  };

  const { id, ...tripToSend } = sanitizedTrip;
  const endpoint = currentTripId
    ? `/auth/trip/${currentTripId}/full`
    : "/auth/trip/full";
  const method = currentTripId ? "PUT" : "POST";

  // 💾 Update status
  updateSaveStatus(currentTripId ? "Saving..." : "Saving new plan...");

  const data = await apiRequest(endpoint, {
    method,
    body: JSON.stringify(tripToSend),
  });

  // 🧩 Update State & UI
  if (data.success && data.data) {
    const newTrip: Trip = { ...data.data, id: data.data.id ?? null };
    // ✅ merge state เดิมเพื่อไม่ให้ค่าใหม่หาย
    appState.currentTrip = { ...appState.currentTrip, ...newTrip };
    setCurrentTrip(appState.currentTrip);
    updateSaveStatus(currentTripId ? "All changes saved ✅" : "Plan saved ✅");
  } else {
    updateSaveStatus("Unable to save ❌", true);
  }

  return data;
}

// === Delete Trip ===
export async function deleteTrip(tripId: string, updated_at: string): Promise<any> {
  const data = await apiRequest(`/auth/trip/${tripId}`, {
    method: "DELETE",
    body: JSON.stringify({ updated_at: new Date(updated_at).toISOString() }),
  });
  if (data.success) {
    appState.trips = appState.trips.filter((t) => t.id !== tripId);
  }
  return data;
}
