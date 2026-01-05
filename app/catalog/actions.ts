'use server'

import { getAnimeCatalog, CatalogFilters, Anime } from '@/lib/shikimori'

export async function fetchAnimeData(filters: CatalogFilters): Promise<{
  animes: Anime[]
  hasMore: boolean
}> {
  try {
    const animes = await getAnimeCatalog(filters)
    
    // Определяем, есть ли еще данные
    // Если вернулось меньше 24 элементов, значит это последняя страница
    const hasMore = animes.length === (filters.limit || 24)
    
    return { animes, hasMore }
  } catch (error) {
    console.error('Failed to fetch anime data:', error)
    return { animes: [], hasMore: false }
  }
}
