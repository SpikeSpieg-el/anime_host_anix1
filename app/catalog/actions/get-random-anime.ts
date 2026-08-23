'use server'

import { getAnimeCatalog } from "@/lib/shikimori"
import type { CatalogFilters } from "@/lib/shikimori"

export async function fetchRandomAnime(filters?: CatalogFilters) {
  try {
    // Если фильтры заданы, используем их, иначе - пустые фильтры для случайного выбора
    const randomFilters: CatalogFilters = {
      page: 1,
      limit: 100, // Берём больше, чтобы иметь выбор
      order: 'popularity',
      search: '',
      ...filters
    }

    const animes = await getAnimeCatalog(randomFilters)
    
    if (animes.length === 0) {
      return null
    }

    // Выбираем случайное аниме из списка
    const randomIndex = Math.floor(Math.random() * animes.length)
    return animes[randomIndex]
  } catch (error) {
    console.error("Error fetching random anime:", error)
    return null
  }
}
