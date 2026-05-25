"use client"

import { useTVMode } from '@/hooks/use-tv-mode'
import { TVCatalogPage } from './tv-catalog-page'
import { CatalogClient } from './catalog-client'
import type { CatalogFilters } from '@/lib/shikimori'

interface CatalogPageWrapperProps {
  initialFilters: CatalogFilters
}

export function CatalogPageWrapper({ initialFilters }: CatalogPageWrapperProps) {
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

  return <CatalogClient initialFilters={initialFilters} />
}
