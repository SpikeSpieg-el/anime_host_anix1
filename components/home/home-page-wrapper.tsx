"use client"

import { useTVMode } from '@/hooks/use-tv-mode'
import { TVHomePage } from '@/components/tv/tv-home-page'
import { Navbar } from '@/components/layout/navbar'
import { FloatingNav } from '@/components/layout/floating-nav'
import { HeroBanner } from './hero-banner'
import { HeroBannerSkeleton } from '@/components/shared/skeleton'
import { HomePageClient } from './home-client'
import { useState, useEffect } from 'react'
import type { Anime, RecommendationReason } from '@/lib/shikimori'

interface HomePageWrapperProps {
  topOfWeekHero: Anime | null
  initialData: {
    popularNow: Anime[]
    popularAlways: Anime[]
    ongoingAnime: Anime[]
    newsUpdates: any[]
    announcements: any[]
  }
}

export function HomePageWrapper({
  topOfWeekHero,
  initialData,
}: HomePageWrapperProps) {
  const { isTVMode, isLoading } = useTVMode()
  const [recommendedAnime, setRecommendedAnime] = useState<Anime | null>(null)
  const [recommendationReason, setRecommendationReason] = useState<RecommendationReason | undefined>()
  const [isRecommendationLoading, setIsRecommendationLoading] = useState(true)
  const [topOfWeekHeroFull, setTopOfWeekHeroFull] = useState<Anime | null>(topOfWeekHero)

  const fetchRecommendation = async () => {
    setIsRecommendationLoading(true)
    const params = new URLSearchParams()
    try {
      const watchedRaw = document.cookie
        .split('; ')
        .find(r => r.startsWith('watched_history='))
        ?.split('=')[1]
      if (watchedRaw) {
        const ids: string[] = JSON.parse(decodeURIComponent(watchedRaw))
        if (ids.length > 0) params.set('watched', ids.join(','))
      }
      const bookmarksRaw = document.cookie
        .split('; ')
        .find(r => r.startsWith('bookmark_ids='))
        ?.split('=')[1]
      if (bookmarksRaw) {
        params.set('bookmarks', decodeURIComponent(bookmarksRaw))
      }
    } catch {}
    if (topOfWeekHero?.id) params.set('excludeId', topOfWeekHero.id)
    params.set('bust', String(Date.now()))

    try {
      const data = await fetch(`/api/hero-recommendation?${params.toString()}`, { cache: 'no-store' }).then(r => r.json())
      if (data?.anime) {
        setRecommendedAnime(data.anime)
        setRecommendationReason(data.reason)
      }
    } finally {
      setIsRecommendationLoading(false)
    }
  }

  useEffect(() => {
    fetchRecommendation().catch(() => {})

    // Дозагружаем детали (жанры) для topOfWeekHero параллельно
    if (topOfWeekHero?.id) {
      fetch(`/api/anime/${topOfWeekHero.id}`)
        .then(r => r.json())
        .then(data => {
          if (data?.genres?.length) {
            setTopOfWeekHeroFull(prev => prev ? { ...prev, genres: data.genres } : prev)
          }
        })
        .catch(() => {})
    }
  }, [topOfWeekHero?.id])

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
        popularAlways={initialData.popularAlways}
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
        {topOfWeekHero ? (
          <HeroBanner
            topOfWeekAnime={topOfWeekHeroFull ?? topOfWeekHero}
            recommendedAnime={recommendedAnime}
            recommendationReason={recommendationReason}
            isRecommendationLoading={isRecommendationLoading}
            onRefreshRecommendation={fetchRecommendation}
          />
        ) : (
          <HeroBannerSkeleton />
        )}
      </section>
      <HomePageClient initialData={initialData} />
    </main>
  )
}
