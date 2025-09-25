//src/recommend/recommender.ts

// สร้าง Interface สำหรับข้อมูลสถานที่ที่ใช้ในไฟล์นี้
export interface Place {
  place_id: string;
  name_th: string;
  province: string;
  lat: number;
  lng: number;
  rating: number | null;
  rating_count: number | null;
  score?: number;
}

let PLACES: Place[] = [];

export async function loadPlacesIndex(): Promise<Place[]> {
  if (PLACES.length) return PLACES;
  const res = await fetch('/data/places-index.sample.json');
  PLACES = await res.json();
  return PLACES;
}

// Bayesian
const C = 20, m = 4.2;
export function bayesianScore(r: number | null | undefined, c: number | null | undefined): number {
  const R = r || 0;
  const v = c || 0;
  return (v / (v + C)) * R + (C / (v + C)) * m;
}

export function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (d: number) => d * Math.PI / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export function topByProvinces(provinces: string[], allPlaces: Place[], limit: number = 20): Place[] {
  const set = new Set(provinces.map(p => p.trim()));
  return allPlaces
    .filter(p => set.has(p.province))
    .map(p => ({ ...p, score: bayesianScore(p.rating, p.rating_count) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}

export function nearby(lat: number, lng: number, allPlaces: Place[], radiusKm: number = 50, limit: number = 5): Place[] {
  return allPlaces
    .filter(p => haversineKm(lat, lng, p.lat, p.lng) <= radiusKm)
    .map(p => ({ ...p, score: bayesianScore(p.rating, p.rating_count) }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, limit);
}