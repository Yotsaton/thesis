// scripts/app/recommend/recommender.js
let PLACES = [];

export async function loadPlacesIndex() {
  if (PLACES.length) return PLACES;
  const res = await fetch('/public/data/places-index.sample.json'); // เปลี่ยน path เป็นไฟล์จริงภายหลัง
  PLACES = await res.json();
  return PLACES;
}

// Bayesian
const C = 20, m = 4.2;
export function bayesianScore(r, c) {
  const R = r || 0, v = c || 0;
  return (v/(v+C))*R + (C/(v+C))*m;
}

export function haversineKm(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI/180;
  const R = 6371;
  const dLat = toRad(lat2-lat1);
  const dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 +
            Math.cos(toRad(lat1))*Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
  return 2*R*Math.asin(Math.sqrt(a));
}

export function topByProvinces(provinces, allPlaces, limit = 20) {
  const set = new Set(provinces.map(p => p.trim()));
  return allPlaces
    .filter(p => set.has(p.province))
    .map(p => ({ ...p, score: bayesianScore(p.rating, p.rating_count) }))
    .sort((a,b) => b.score - a.score)
    .slice(0, limit);
}

export function nearby(lat, lng, allPlaces, radiusKm = 50, limit = 5) {
  return allPlaces
    .filter(p => haversineKm(lat, lng, p.lat, p.lng) <= radiusKm)
    .map(p => ({ ...p, score: bayesianScore(p.rating, p.rating_count) }))
    .sort((a,b) => b.score - a.score)
    .slice(0, limit);
}
