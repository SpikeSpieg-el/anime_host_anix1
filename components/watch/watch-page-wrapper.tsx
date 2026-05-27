"use client"

import { useTVMode } from '@/hooks/use-tv-mode'
import { TVWatchPage } from '@/components/tv/tv-watch-page'
import { WatchPageClient } from './watch-page-client'
import type { Anime } from '@/lib/shikimori'

interface WatchPageWrapperProps {
  anime: Anime
  initialEpisode?: number
}

export function WatchPageWrapper({ anime, initialEpisode }: WatchPageWrapperProps) {
  const { isTVMode, isLoading } = useTVMode()

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (isTVMode) {
    return <TVWatchPage anime={anime} initialEpisode={initialEpisode} />
  }

  return <WatchPageClient anime={anime} initialEpisode={initialEpisode} />
}
