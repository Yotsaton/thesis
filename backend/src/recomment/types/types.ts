// src/recomment/types/types.ts

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