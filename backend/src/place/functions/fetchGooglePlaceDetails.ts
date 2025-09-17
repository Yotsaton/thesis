// src/place/functions/fetchGooglePlaceDetails.ts

import { v4 as uuidv4 } from 'uuid';
import type {place , geoJSONPoint} from '../../database/database.types'

interface GooglePlaceDetailsResponse {
  result: {
    name: string;
    formatted_address: string;
    geometry: { location: { lat: number; lng: number; }; };
    place_id: string;
    rating?: number;
    user_ratings_total?: number;
    editorial_summary?: { overview: string; };
    url: string;
    types?: string[];
  };
  status: string;
  error_message?: string;
}

/**
 * ดึงข้อมูลรายละเอียดสถานที่จาก Google Maps Place Details API
 *
 * @param googlePlaceId - Place ID ของสถานที่ที่ต้องการค้นหา
 * @param apiKey - Google Maps API Key
 * @returns A Promise that resolves to a `Place` object or `null`.
 */
export async function fetchGooglePlaceDetails(
  googlePlaceId: string,
  apiKey: string
): Promise<place | null> {
  const fields = ['name', 'formatted_address', 'geometry', 'place_id', 'rating',
                  'user_ratings_total', 'editorial_summary', 'url', 'types'].join(',');
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${googlePlaceId}&fields=${fields}&key=${apiKey}&language=th`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`HTTP error! status: ${response.status}`);
      return null;
    }
    const data: GooglePlaceDetailsResponse = await response.json();
    if (data.status !== 'OK') {
      console.warn(`Google API Error: ${data.status} for Place ID ${googlePlaceId}.`);
      return null;
    }

    const { result } = data;
    return {
      id: uuidv4(),
      name_place: result.name,
      address: result.formatted_address,
      location: {
        type: 'Point',
        coordinates: [result.geometry.location.lng, result.geometry.location.lat],
      },
      updated_at: new Date(),
      place_ID_by_ggm: result.place_id,
      rating: result.rating ?? null,
      user_rating_total: result.user_ratings_total ?? null,
      sumary_place: result.editorial_summary?.overview ?? null,
      url: result.url ?? null,
      category: result.types ?? null,
    };
  } catch (error) {
    console.error('Fetch operation failed:', error);
    return null;
  }
}