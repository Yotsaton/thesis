import { appState, setTripList, setCurrentTrip } from "../state/index.js";
import type { Trip } from '../types.js'; // ⬅️ 1. แก้ไข: import Type จากที่ใหม่

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
    return data ? JSON.parse(data) as Trip[] : [];
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
  // 🔽 2. ใช้ id ในการค้นหา 🔽
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
  
  const tripToSave: Omit<Trip, 'id'> = {
      ...currentTrip,
      updatedAt: new Date().toISOString()
  };

  if (currentTripId) {
    // UPDATE
    let found = false;
    trips = trips.map((t) => {
      if (t.id === currentTripId) {
        found = true;
        return { ...tripToSave, id: currentTripId };
      }
      return t;
    });
    if (!found) {
        const newId = "local_trip_" + Date.now();
        const newTrip: Trip = { ...tripToSave, id: newId };
        trips.push(newTrip);
        setCurrentTrip(newTrip);
    }
  } else {
    // CREATE
    const newId = "local_trip_" + Date.now();
    // 🔽 3. ลบ 'createdAt' ที่ไม่มีใน interface ใหม่ออกไป
    const newTrip: Trip = {
      ...tripToSave,
      id: newId,
    };
    trips.push(newTrip);
    setCurrentTrip(newTrip);
  }

  saveTripsToStorage(trips);
  updateSaveStatus("All changes saved ✅");
  return { success: true, trip: appState.currentTrip };
}

export async function deleteTrip(tripId: string, ifMatchUpdatedAt: string | Date): Promise<{ success: boolean}> {
  let trips = getTripsFromStorage();
  // 🔽 2. ใช้ id ในการกรอง 🔽
  trips = trips.filter((t) => t.id !== tripId);
  saveTripsToStorage(trips);
  appState.trips = trips;
  return { success: true };
}