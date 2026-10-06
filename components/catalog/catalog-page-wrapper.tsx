"use client"

import { useTVMode } from '@/hooks/use-tv-mode'
import { TVCatalogPage } from '@/components/tv/tv-catalog-page'
import { CatalogClient } from './catalog-client'
import type { Anime, CatalogFilters } from '@/lib/shikimori'

interface CatalogPageWrapperProps {
  initialFilters: CatalogFilters
  /**
   * Первая страница каталога, отрендеренная на сервере.
   * Без неё HTML каталога вообще не содержал ссылок на /watch/* —
   * поисковики не могли найти тайтлы за пределами sitemap.
   */
  initialAnimes?: Anime[]
}

export function CatalogPageWrapper({ initialFilters, initialAnimes }: CatalogPageWrapperProps) {
  const { isTVMode, isLoading } = useTVMode()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (isTVMode) {
    return <TVCatalogPage allowNsfw={initialFilters.allowNsfw} />
  }

  return <CatalogClient initialFilters={initialFilters} initialAnimes={initialAnimes} />
}
