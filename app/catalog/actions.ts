'use server'

import { getAnimeCatalog } from "@/lib/shikimori"
import type { CatalogFilters } from "@/lib/shikimori"

export async function fetchAnimeData(filters: CatalogFilters) {
  try {
    const limit = filters.limit || 24;
    const animes = await getAnimeCatalog(filters);

    return {
      animes,
      // Если пришло меньше аниме, чем лимит, значит дальше ничего нет
      hasMore: animes.length >= limit
    };
  } catch (error) {
    console.error("Action error:", error);
    return { animes: [], hasMore: false };
  }
}
