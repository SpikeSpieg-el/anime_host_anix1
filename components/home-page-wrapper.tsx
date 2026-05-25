"use client"

import { useTVMode } from '@/hooks/use-tv-mode'
import { TVHomePage } from './tv-home-page'
import { Navbar } from './navbar'
import { FloatingNav } from './floating-nav'
import { HeroBanner } from './hero-banner'
import { HeroBannerSkeleton } from './skeleton'
import { HomePageClient } from './home-client'
import type { Anime, RecommendationReason } from '@/lib/shikimori'

interface HomePageWrapperProps {
  topOfWeekHeroWithDetails: Anime | null
  recommendedAnime: Anime | null
  recommendationReason?: RecommendationReason
  initialData: {
    popularNow: Anime[]
    popularAlways: Anime[]
    ongoingAnime: Anime[]
    newsUpdates: any[]
    announcements: any[]
  }
}

export function HomePageWrapper({
  topOfWeekHeroWithDetails,
  recommendedAnime,
  recommendationReason,
  initialData,
}: HomePageWrapperProps) {
  const { isTVMode, isLoading } = useTVMode()

  if (isLoading) {
    return (
      <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24">
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </main>
    )
  }

  if (isTVMode) {
    return (
      <TVHomePage
        popularNow={initialData.popularNow}
        ongoingAnime={initialData.ongoingAnime}
      />
    )
  }

  return (
    <main className="min-h-screen bg-background text-foreground pb-20 md:pb-24 selection:bg-orange-500/30 relative">
      <div className="absolute inset-0 z-0 pointer-events-none opacity-[0.07]">
        <div className="absolute inset-0 bg-[radial-gradient(#fff_1px,transparent_1px)] [background-size:20px_20px]" />
      </div>

      <Navbar />
      <FloatingNav />
      <section id="hero">
        {topOfWeekHeroWithDetails || recommendedAnime ? (
          <HeroBanner
            topOfWeekAnime={topOfWeekHeroWithDetails}
            recommendedAnime={recommendedAnime}
            recommendationReason={recommendationReason}
          />
        ) : (
          <HeroBannerSkeleton />
        )}
      </section>
      <HomePageClient initialData={initialData} />
    </main>
  )
}
