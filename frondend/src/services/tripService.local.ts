// src/services/tripService.local.ts
import { appState, setTripList, setCurrentTrip } from "../state/index";
import type { Trip } from '../types';

const STORAGE_KEY = "tiewthai_trips";

function getTripsFromStorage(): Trip[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? (parsed as Trip[]) : [];
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
  const trip = trips.find((t) => t._id === tripId);
  if (trip) {
    setCurrentTrip(trip);
    return { success: true, trip };
  }
  return { success: false, message: "Trip not found" };
}

export async function saveCurrentTrip(): Promise<{ success: boolean; trips?: Trip[]; skipped?: boolean; reused?: boolean }> {
  const { currentTrip, currentTripId } = appState;

  if (!currentTrip?.name || currentTrip.name.trim() === "") {
    alert("Trip name cannot be empty.");
    return { success: false };
  }
  if (!Array.isArray(currentTrip.days) || currentTrip.days.length === 0) {
    return { success: true, skipped: true };
  }

  let trips = getTripsFromStorage();
  
  const updatedTrip: Trip = {
      ...currentTrip,
      updatedAt: new Date().toISOString()
  };

  if (currentTripId) {
    trips = trips.map((t) =>
      t._id === currentTripId ? { ...updatedTrip, _id: currentTripId } : t
    );
  } else {
    // ... (ส่วนที่เหลือเหมือนเดิม แต่ควรใช้ updatedTrip) ...
    const newId = "trip_" + Date.now();
    const newTrip: Trip = {
      ...updatedTrip,
      _id: newId,
      createdAt: new Date().toISOString(),
    };
    trips.push(newTrip);
    setCurrentTrip(newTrip);
    if (!appState.trips.some(t => t._id === newId)) {
        appState.trips.push(newTrip);
    }
  }

  saveTripsToStorage(trips);
  return { success: true, trips };
}

export async function deleteTrip(tripId: string): Promise<{ success: boolean }> {
  let trips = getTripsFromStorage();
  trips = trips.filter((t) => t._id !== tripId);
  saveTripsToStorage(trips);
  appState.trips = trips;
  return { success: true };
}