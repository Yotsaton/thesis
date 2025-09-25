// src/services/tripService.api.ts
import { appState, setTripList, setCurrentTrip } from "../state/index";
import type { Trip } from "../types";

let saveTimeout: number;

function updateSaveStatus(message: string, isError: boolean = false): void {
  const statusEl = document.getElementById("save-status");
  if (!statusEl) return;
  
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffadad" : "#d8f1d8";
  
  clearTimeout(saveTimeout);
  if (message && !message.includes("Saving")) {
    saveTimeout = window.setTimeout(() => { statusEl.textContent = ""; }, 3000);
  }
}

const API_URL = import.meta.env.VITE_API_URL;

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  
  const controller = new AbortController();

  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      credentials: "include", // Include cookies in requests
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
      const message =
        (isJson && typeof body === 'object' && body && (body as any).message) ||
        `HTTP ${res.status} ${res.statusText}`;
      const errorObj = new Error(String(message));
      (errorObj as any).status = res.status;
      (errorObj as any).body = body;
      (errorObj as any).contentType = ctype;
      throw errorObj;
    }

    if(!isJson) {
      const snippet = await res.text().catch(() => '');
      const shortSnippet = snippet.length > 100 ? snippet.slice(0, 100) + '...' : snippet;
      throw new Error(`Expected JSON response but got: ${shortSnippet}`);
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
  if (data.success) {
    setTripList(
      (data.trips as any[]).map(trip => ({
        id: trip._id ?? null,
        name: trip.name,
        start_plan: trip.start_plan,
        end_plan: trip.end_plan,
        days: trip.days,
        updatedAt: trip.updatedAt,
      }))
    );
  }
  return data;
}

// ยังไม่ได้ทำapi endpoint สำหรับดึง trip เดียว
export async function loadTrip(tripId: string): Promise<any> {
  const data = await apiRequest(`/trips/${tripId}`, { method: "GET" });
  if (data.success) {
    // Ensure the trip object has an 'id' property as required by the Trip interface
    const tripWithId: Trip = {
      id: data.trip._id ?? null,
      name: data.trip.name,
      start_plan: data.trip.start_plan,
      end_plan: data.trip.end_plan,
      days: data.trip.days,
      updatedAt: data.trip.updatedAt,
    };
    setCurrentTrip(tripWithId);
  }
  return data;
}

export async function saveCurrentTrip(): Promise<any> {
  const { currentTrip, currentTripId } = appState;

  if (!currentTrip || !currentTrip.name || currentTrip.name.trim() === "" ||
      !Array.isArray(currentTrip.days) || currentTrip.days.length === 0) {
    console.log("Skip saving: Trip is empty or has no days.");
    return { success: false, message: "Trip is empty" };
  }

  if (currentTripId) {
    // UPDATE
    updateSaveStatus("Saving...");
    const data = await apiRequest(`/trips/${currentTripId}`, {
      method: "PUT",
      body: JSON.stringify(currentTrip),
    });
    if (data.success) updateSaveStatus("All changes saved ✅");
    else updateSaveStatus("Unable to save ❌", true);
    return data;
  } else {
    // CREATE
    updateSaveStatus("Saving new plan...");
    const data = await apiRequest("/trips", {
      method: "POST",
      body: JSON.stringify(currentTrip),
    });
    if (data.success && data.trip) {
      setCurrentTrip(data.trip as Trip);
      appState.trips.push(data.trip as Trip);
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