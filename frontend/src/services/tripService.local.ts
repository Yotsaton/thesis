import { appState, setTripList, setCurrentTrip } from "../state/index.js";
import type { Trip } from '../state/index.js'; // ⬅️ import Type จาก state โดยตรง

const STORAGE_KEY = "tiewthai_trips";
let saveTimeout: number;

function updateSaveStatus(message: string, isError: boolean = false): void {
  const statusEl = document.getElementById("save-status");
  if (!statusEl) return;
  
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#ffadad" : "#d8f1d8";
  
  window.clearTimeout(saveTimeout);
  if (message) {
    saveTimeout = window.setTimeout(() => { if(statusEl) statusEl.textContent = ""; }, 3000);
  }
}

function getTripsFromStorage(): Trip[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to parse trips from storage:", e);
    return [];
  }
}

function saveTripsToStorage(trips: Trip[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

export async function loadTripList(): Promise<{ success: boolean; trips: Trip[] }> {
  const trips = getTripsFromStorage();
  setTripList(trips);
  return { success: true, trips };
}

export async function loadTrip(tripId: string): Promise<{ success: boolean; trip?: Trip; message?: string }> {
  const trips = getTripsFromStorage();
  // 🔽 ใช้ id ในการค้นหา 🔽
  const trip = trips.find((t) => t.id === tripId);
  if (trip) {
    setCurrentTrip(trip);
    return { success: true, trip };
  }
  return { success: false, message: "Trip not found" };
}

export async function saveCurrentTrip(): Promise<{ success: boolean; trip?: Trip; message?: string }> {
  const { currentTrip, currentTripId } = appState;

  if (!currentTrip?.name?.trim() || !currentTrip.days?.length) {
    alert("Trip name cannot be empty.");
    return { success: false, message: "Trip name is empty" };
  }

  updateSaveStatus("Saving...");
  let trips = getTripsFromStorage();
  let savedTrip: Trip | undefined;
  
  const tripToSave: Trip = {
      ...currentTrip,
      updatedAt: new Date().toISOString()
  };

  if (currentTripId) {
    // UPDATE
    savedTrip = { ...tripToSave, id: currentTripId };
    trips = trips.map((t) => t.id === currentTripId ? savedTrip : t);
  } else {
    // CREATE
    const newId = "local_trip_" + Date.now();
    savedTrip = {
      ...tripToSave,
      id: newId,
      createdAt: new Date().toISOString(),
    };
    trips.push(savedTrip);
    setCurrentTrip(savedTrip);
  }

  saveTripsToStorage(trips);
  updateSaveStatus("All changes saved ✅");
  return { success: true, trip: savedTrip };
}

export async function deleteTrip(tripId: string): Promise<{ success: boolean }> {
  let trips = getTripsFromStorage();
  // 🔽 ใช้ id ในการกรอง 🔽
  trips = trips.filter((t) => t.id !== tripId);
  saveTripsToStorage(trips);
  appState.trips = trips;
  return { success: true };
}