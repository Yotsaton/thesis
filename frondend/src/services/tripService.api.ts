// src/services/tripService.api.js
import { appState, setTripList, setCurrentTrip } from "../state/index.js";

function getStatusEl() {
  return document.getElementById("save-status");
}
let saveTimeout;

function updateSaveStatus(message, isError = false) {
  const statusEl = getStatusEl();
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffadad" : "#d8f1d8";
  if (saveTimeout) clearTimeout(saveTimeout);
  if (message && !message.includes("Saving")) {
    saveTimeout = setTimeout(() => { statusEl.textContent = ""; }, 3000);
  }
}

async function apiRequest(endpoint, options = {}) {
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
    return await res.json();
  } catch (error) {
    console.error(`API request error to ${endpoint}:`, error);
    return { success: false, message: error.message || "A network error occurred." };
  }
}

export async function loadTripList() {
  const data = await apiRequest("/trips", { method: "GET" });
  if (data.success) setTripList(data.trips);
  return data;
}

export async function loadTrip(tripId) {
  const data = await apiRequest(`/trips/${tripId}`, { method: "GET" });
  if (data.success) setCurrentTrip(data.trip);
  return data;
}

export async function saveCurrentTrip() {
  const { currentTrip, currentTripId } = appState;

  if (!currentTrip || !currentTrip.name || currentTrip.name.trim() === "" ||
      !Array.isArray(currentTrip.days) || currentTrip.days.length === 0) {
    console.log("Skip saving: Trip is empty or has no days.");
    return { success: false, message: "Trip is empty" };
  }

  if (currentTripId) {
    updateSaveStatus("Saving...");
    const data = await apiRequest(`/trips/${currentTripId}`, {
      method: "PUT",
      body: JSON.stringify(currentTrip),
    });
    if (data.success) updateSaveStatus("All changes saved ✅");
    else updateSaveStatus("Unable to save ❌", true);
    return data;
  } else {
    updateSaveStatus("Saving new plan...");
    const data = await apiRequest("/trips", {
      method: "POST",
      body: JSON.stringify(currentTrip),
    });
    if (data.success) {
      setCurrentTrip(data.trip);
      appState.trips.push(data.trip);
      updateSaveStatus("Plan saved ✅");
    } else {
      updateSaveStatus("Unable to save ❌", true);
    }
    return data;
  }
}

export async function deleteTrip(tripId) {
  const data = await apiRequest(`/trips/${tripId}`, { method: "DELETE" });
  if (data.success) appState.trips = appState.trips.filter((t) => t._id !== tripId);
  return data;
}