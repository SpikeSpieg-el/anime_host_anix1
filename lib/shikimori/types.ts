export interface ShikimoriAnime {
  id: number;
  name: string;
  russian: string;
  image: {
    original: string;
    preview: string;
    x96?: string;
    x48?: string;
  };
  score: string;
  episodes: number;
  episodes_aired: number;
  status: string;
  aired_on: string;
  kind: string;
  rating: string; // Важно для фильтрации хентая
  description?: string;
  genres?: { id: number; name: string; russian: string }[];
  alternative_names?: string[];
  synonyms?: string[];
  [key: string]: any;
}

export interface Anime {
  id: string;
  shikimoriId: string;
  title: string;
  originalTitle: string;
  poster: string;
  backdrop?: string;
  rating: number;
  year: number;
  airedOn?: string;
  episodesCurrent: number;
  episodesTotal: number;
  status: string;
  description: string;
  genres: string[];
  quality: string;
}

export interface CatalogFilters {
  page?: number;
  limit?: number;
  order?: string;
  genre?: string | string[];
  status?: string;
  kind?: string;
  year?: string | string[];
  score?: string;
  search?: string;
  allowNsfw?: boolean;
  enableGenreFallback?: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  date: string;
  author: string;
  comments: number;
  url: string;
}

export interface FranchiseItem {
  id: string;
  title: string;
  poster: string;
  year?: number;
  kind?: string;
  weight: number;
  isCurrent: boolean;
}

export interface WeeklySchedule {
  [dayIndex: number]: Anime[];
}