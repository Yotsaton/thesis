// src/services/tripService.local.js
import { appState, setTripList, setCurrentTrip } from "../state/index.js";

const STORAGE_KEY = "tiewthai_trips";

function getTripsFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error("Failed to parse trips from storage:", e);
    return [];
  }
}
function saveTripsToStorage(trips) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(trips));
}

export async function loadTripList() {
  const trips = getTripsFromStorage();
  setTripList(trips);
  return { success: true, trips };
}

export async function loadTrip(tripId) {
  const trips = getTripsFromStorage();
  const trip = trips.find((t) => t._id === tripId);
  if (trip) {
    setCurrentTrip(trip);
    return { success: true, trip };
  }
  return { success: false, message: "Trip not found" };
}

export async function saveCurrentTrip() {
  const { currentTrip, currentTripId } = appState;

  if (!currentTrip?.name || currentTrip.name.trim() === "") {
    alert("Trip name cannot be empty.");
    return { success: false };
  }
  if (!Array.isArray(currentTrip.days) || currentTrip.days.length === 0) {
    return { success: true, skipped: true };
  }

  let trips = getTripsFromStorage();

  // always update updatedAt
  currentTrip.updatedAt = new Date().toISOString();

  if (currentTripId) {
    trips = trips.map((t) =>
      t._id === currentTripId
        ? { ...currentTrip, _id: currentTripId }
        : t
    );
  } else {
    const maybeDup = trips.find(
      (t) =>
        t.name === currentTrip.name &&
        JSON.stringify((t.days || []).map((d) => d.date)) ===
          JSON.stringify((currentTrip.days || []).map((d) => d.date))
    );
    if (maybeDup) {
      setCurrentTrip(maybeDup);
      return { success: true, reused: true };
    }
    const newId = "trip_" + Date.now();
    const newTrip = {
      ...currentTrip,
      _id: newId,
      createdAt: new Date().toISOString(),
    };
    trips.push(newTrip);
    setCurrentTrip(newTrip);
    appState.trips.push(newTrip);
  }

  saveTripsToStorage(trips);
  return { success: true, trips };
}

export async function deleteTrip(tripId) {
  let trips = getTripsFromStorage();
  trips = trips.filter((t) => t._id !== tripId);
  saveTripsToStorage(trips);
  appState.trips = trips;
  return { success: true };
}