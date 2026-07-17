"use client"

import { useTVMode } from '@/hooks/use-tv-mode'
import { TVWatchPage } from '@/components/tv/tv-watch-page'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { WatchPageClient } from './watch-page-client'
import { WatchOrderSection } from './watch-order-section'
import { CoverProvider } from '@/components/providers/cover-provider'
import type { Anime, FranchiseItem } from '@/lib/shikimori'
import { TextSkeleton } from '@/components/shared/skeleton'

interface WatchPageLayoutWrapperProps {
  anime: Anime
  initialEpisode?: number
  watchOrder: FranchiseItem[]
}

export function WatchPageLayoutWrapper({ anime, initialEpisode, watchOrder }: WatchPageLayoutWrapperProps) {
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

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 relative">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />

      <div className="container mx-auto px-4 py-8 relative z-10">
        <WatchPageClient
          anime={anime}
          initialEpisode={initialEpisode}
        />

        {anime.description ? (
          <div className="mt-8">
            <p className="text-zinc-400 leading-relaxed whitespace-pre-line text-lg">
              {anime.description}
            </p>
          </div>
        ) : (
          <div className="mt-8">
            <TextSkeleton lines={6} />
          </div>
        )}

        <CoverProvider>
          <WatchOrderSection watchOrder={watchOrder} />
        </CoverProvider>
      </div>
      <Footer />
    </main>
  )
}
