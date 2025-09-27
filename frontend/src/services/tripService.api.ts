import { appState, setTripList, setCurrentTrip } from "../state/index.js";
import type { Trip } from "../types.js"; // ⬅️ 1. แก้ไข: import Type จากที่ใหม่

let saveTimeout: number;

function updateSaveStatus(message: string, isError: boolean = false): void {
  const statusEl = document.getElementById("save-status");
  if (!statusEl) return;
  
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffadad" : "#d8f1d8";
  
  window.clearTimeout(saveTimeout);
  if (message && !message.includes("Saving")) {
    saveTimeout = window.setTimeout(() => { if(statusEl) statusEl.textContent = ""; }, 3000);
  }
}

const API_URL = import.meta.env.VITE_API_URL;

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const controller = new AbortController();
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      credentials: "include",
      signal: controller.signal,
      headers: {
        "Accept": "application/json",
        ...(options.headers || {}),
      },
      redirect: 'manual',
    });

    const ctype = res.headers.get('content-type') || '';
    const isJson = ctype.includes('application/json');

    if (!res.ok) {
      const body = isJson ? await res.json().catch(() => ({})) : await res.text().catch(() => '');
      const message = (isJson && typeof body === 'object' && body && (body as any).message) || `HTTP ${res.status} ${res.statusText}`;
      const errorObj = new Error(String(message));
      (errorObj as any).status = res.status;
      throw errorObj;
    }

    return res.status === 204 ? { success: true } : await res.json();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "A network error occurred.";
    console.error(`API request error to ${endpoint}:`, error);
    return { success: false, message: errorMessage };
  }
}

export async function loadTripList(): Promise<any> {
  const data = await apiRequest("/auth/trip/", { method: "GET" });
  if (data.success && Array.isArray(data.trips)) {
    // 🔽 2. แปลงข้อมูล _id จาก backend เป็น id ที่ frontend ใช้
    const tripsForState: Trip[] = data.trips.map((trip: any) => ({
      ...trip,
      id: trip._id ?? null,
    }));
    setTripList(tripsForState);
  }
  return data;
}

export async function loadTrip(tripId: string): Promise<any> {
  const data = await apiRequest(`/auth/trips/${tripId}`, { method: "GET" });
  if (data.success && data.trip) {
    const tripForState: Trip = { ...data.trip, id: data.trip._id ?? null };
    setCurrentTrip(tripForState);
  }
  return data;
}

export async function saveCurrentTrip(): Promise<any> {
  const { currentTrip, currentTripId } = appState;

  if (!currentTrip?.name?.trim() || !currentTrip.days?.length) {
    console.log("Skip saving: Trip is empty.");
    return { success: false, message: "Trip is empty" };
  }
  
  // 3. แปลง id กลับเป็น _id ก่อนส่งให้ backend (ถ้า backend ยังใช้ _id)
  const { id, ...tripToSend } = currentTrip;

  if (currentTripId) {
    // UPDATE
    updateSaveStatus("Saving...");
    const data = await apiRequest(`/auth/trips/${currentTripId}`, {
      method: "PUT",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tripToSend),
    });
    if (data.success) updateSaveStatus("All changes saved ✅");
    else updateSaveStatus("Unable to save ❌", true);
    return data;
  } else {
    // CREATE
    updateSaveStatus("Saving new plan...");
    const data = await apiRequest("/trips", {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tripToSend),
    });
    if (data.success && data.trip) {
      const newTripWithId: Trip = { ...data.trip, id: data.trip._id ?? null };
      setCurrentTrip(newTripWithId);
      appState.trips.push(newTripWithId);
      updateSaveStatus("Plan saved ✅");
    } else {
      updateSaveStatus("Unable to save ❌", true);
    }
    return data;
  }
}

export async function deleteTrip(tripId: string): Promise<any> {
  const data = await apiRequest(`/trips/${tripId}`, { method: "DELETE" });
  if (data.success) {
    appState.trips = appState.trips.filter((t) => t.id !== tripId);
  }
  return data;
}