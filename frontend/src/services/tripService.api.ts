import { appState, setTripList, setCurrentTrip } from "../state/index.js";
import type { Trip } from "../types.js";
import { summarizeDayRoute } from "../services/routeService.js"; // ✅ import เพิ่ม

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

const API_URL = import.meta.env.VITE_API_URL;

let tripRequestInProgress = false;

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  if (tripRequestInProgress) {
    console.warn("Skipped duplicate trip API request:", endpoint);
    return { success: false, message: "Duplicate request skipped" };
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
      const errorData = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(errorData.message || `HTTP error! status: ${res.status}`);
    }
    return await res.json();
  } catch (err) {
    console.error(`API request error to ${endpoint}:`, err);
    return {
      success: false,
      message: err instanceof Error ? err.message : "Network error",
    };
  } finally {
    tripRequestInProgress = false;
  }
}

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

export async function saveCurrentTrip(): Promise<any> {
  const { currentTrip, currentTripId } = appState;

  if (!currentTrip?.name?.trim() || !currentTrip.days?.length) {
    console.log("Skip saving: Trip is empty.");
    return { success: false, message: "Trip is empty" };
  }

  // ✅ คำนวณ summary สำหรับแต่ละวัน
  for (const day of currentTrip.days) {
    const summary = await summarizeDayRoute(day);
    (day as any).summary = summary;
  }

  console.log("[SUMMARY] Updated trip summaries:", currentTrip.days.map(d => d.summary));

  // 🚫 ไม่ส่ง summary ให้ backend
  const sanitizedTrip = {
    ...currentTrip,
    days: currentTrip.days.map(d => {
      const { summary, ...rest } = d;
      return rest;
    }),
  };

  const { id, ...tripToSend } = sanitizedTrip;

  if (currentTripId) {
    updateSaveStatus("Saving...");
    const data = await apiRequest(`/auth/trip/${currentTripId}/full`, {
      method: "PUT",
      body: JSON.stringify(tripToSend),
    });
    if (data.success && data.data) {
      const newTripWithId: Trip = { ...data.data, id: data.data.id ?? null };
      setCurrentTrip(newTripWithId);
      updateSaveStatus("All changes saved ✅");
    } else updateSaveStatus("Unable to save ❌", true);
    return data;
  } else {
    updateSaveStatus("Saving new plan...");
    const data = await apiRequest("/auth/trip/full", {
      method: "POST",
      body: JSON.stringify(tripToSend),
    });
    if (data.success && data.data) {
      const newTripWithId: Trip = { ...data.data, id: data.data.id ?? null };
      setCurrentTrip(newTripWithId);
      updateSaveStatus("Plan saved ✅");
    } else {
      updateSaveStatus("Unable to save ❌", true);
    }
    return data;
  }
}

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
