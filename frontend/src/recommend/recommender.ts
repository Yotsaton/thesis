// src/recommend/recommender.ts

export interface PlaceRecommendation {
  id: string;
  place_id: string;
  name: string | null;
  address: string | null;
  categories: string[] | null;
  rating: number | null;
  rating_count: number | null;
  detail: string | null;
}

export async function fetchRecommendationsFromAPI(
  provinces: string[],
  categories: string[] = ['tourist_attraction'],
  limit: number = 5
): Promise<PlaceRecommendation[]> {
  try {
    const baseUrl = window.API_BASE_URL;
    const response = await fetch(`${baseUrl}/auth/recomment/from-province`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provinces, categories, limit: limit}),
    });

    const json = await response.json();
    if (!json.success) throw new Error(json.error || 'API failed');

    return json.data as PlaceRecommendation[];
  } catch (err) {
    console.error('[fetchRecommendationsFromAPI] Failed:', err);
    throw err;
  }
}
