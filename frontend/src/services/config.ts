// src/services/config.ts
import type { TripServiceInterface } from '../types.js';

export const CONFIG = {
  GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
  OFFLINE_MODE: true, //  OFFLINE_MODE: false, จะเปลี่ยนเป็น Backend Server 
  REQUIRE_AUTH: false, // ⬅️ เพิ่ม Config นี้เข้ามา
};

window.GOOGLE_MAPS_API_KEY = CONFIG.GOOGLE_MAPS_API_KEY;

let serviceModule: TripServiceInterface | null = null;

export async function getTripService(): Promise<TripServiceInterface> {
  if (serviceModule) {
    return serviceModule;
  }

  if (CONFIG.OFFLINE_MODE) {
    // 🔽 แก้ไข Path ให้นามสกุลเป็น .js 🔽
    const module = await import("./tripService.local.js");
    serviceModule = module as unknown as TripServiceInterface;
  } else {
    // 🔽 แก้ไข Path ให้นามสกุลเป็น .js 🔽
    const module = await import("./tripService.api.js");
    serviceModule = module as unknown as TripServiceInterface;
  }
  
  return serviceModule;
}