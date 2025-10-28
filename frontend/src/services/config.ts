// src/services/config.ts
import type { TripServiceInterface } from '../types.js';

export const CONFIG = {
  GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  API_BASE_URL: import.meta.env.VITE_API_URL,
  OFFLINE_MODE: false, //  OFFLINE_MODE: false, จะเปลี่ยนเป็น Backend Server 
  REQUIRE_AUTH: false, // ⬅️ เพิ่ม Config นี้เข้ามา
};

window.GOOGLE_MAPS_API_KEY = CONFIG.GOOGLE_MAPS_API_KEY;
window.API_BASE_URL = CONFIG.API_BASE_URL;

let serviceModule: TripServiceInterface | null = null;

export async function getTripService(): Promise<TripServiceInterface> {
  if (serviceModule) {
    return serviceModule;
  }

  const module = await import("./tripService.api.js");
  serviceModule = module as unknown as TripServiceInterface;
  
  return serviceModule;
}