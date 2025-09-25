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

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem("authToken") || "DUMMY_TOKEN_FOR_DEV";
  try {
    const res = await fetch(`/api${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: res.statusText }));
      throw new Error(err.message || "An HTTP error occurred");
    }
    return res.status === 204 ? { success: true } : await res.json();
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "A network error occurred.";
    console.error(`API request error to ${endpoint}:`, error);
    return { success: false, message: errorMessage };
  }
}

export async function loadTripList(): Promise<any> {
  const data = await apiRequest("/trips", { method: "GET" });
  if (data.success) {
    setTripList(data.trips as Trip[]);
  }
  return data;
}

export async function loadTrip(tripId: string): Promise<any> {
  const data = await apiRequest(`/trips/${tripId}`, { method: "GET" });
  if (data.success) {
    setCurrentTrip(data.trip as Trip);
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
    appState.trips = appState.trips.filter((t) => t._id !== tripId);
  }
  return data;
}