"use client"

import { useTVMode } from '@/hooks/use-tv-mode'
import { TVWatchPage } from '@/components/tv/tv-watch-page'
import { Navbar } from '@/components/layout/navbar'
import { Footer } from '@/components/layout/footer'
import { WatchPageClient } from './watch-page-client'
import { WatchOrderSection } from './watch-order-section'
import { CoverProvider } from '@/components/providers/cover-provider'
import type { Anime, FranchiseItem } from '@/lib/shikimori'
import { PlayCircle, Tv, Film, Calendar, Star, Users, Info } from 'lucide-react'

function getEpisodeText(count: number): string {
  if (count === 1) return "Серия"
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "Серий"
  if (lastDigit === 1) return "Серия"
  if (lastDigit >= 2 && lastDigit <= 4) return "Серии"
  return "Серий"
}

function getStatusLabel(status?: string): string {
  switch (status) {
    case 'ongoing': return 'Онгоинг'
    case 'released': return 'Вышел'
    case 'anons': return 'Анонс'
    default: return ''
  }
}

function getKindLabel(kind?: string): string {
  switch (kind) {
    case 'tv': return 'TV Сериал'
    case 'movie': return 'Фильм'
    case 'ova': return 'OVA'
    case 'ona': return 'ONA'
    case 'special': return 'Спешл'
    case 'music': return 'Клип'
    default: return ''
  }
}

interface WatchPageLayoutWrapperProps {
  anime: Anime & {
    russian?: string
    english?: string
    japanese?: string
    kind?: string
    score?: string | number
    originalTitle?: string
  }
  initialEpisode?: number
  watchOrder: FranchiseItem[]
}

export function WatchPageLayoutWrapper({ anime, initialEpisode, watchOrder }: WatchPageLayoutWrapperProps) {
  const { isTVMode, isLoading } = useTVMode()

  const statusLabel = getStatusLabel((anime as any).status)
  const kindLabel = getKindLabel(anime.kind)
  const episodesCurrent = anime.episodesCurrent || 0
  const episodesTotal = anime.episodesTotal || 0
  const score = typeof anime.score === 'number' ? anime.score.toFixed(2) : (anime.score?.toString() || '')
  const animeTitle = (anime as any).russian || anime.title

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

      <div className="container mx-auto px-4 py-6 md:py-8 relative z-10 max-w-7xl">
        {/* Плеер и верхний блок информации */}
        <WatchPageClient
          anime={anime}
          initialEpisode={initialEpisode}
        />

        {/* ЕДИНЫЙ БЛОК: Описание + Жанры + Мета + SEO */}
        <article 
          className="mt-8 p-5 md:p-7 rounded-2xl bg-card/30 border border-border/60 backdrop-blur-sm shadow-xl"
          itemScope 
          itemProp="about"
        >
          <header className="mb-5 border-b border-border/50 pb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-3 flex items-center gap-2" itemProp="name">
              <Info className="w-5 h-5 text-primary shrink-0" />
              Смотреть {animeTitle} онлайн бесплатно
            </h2>
            
            {/* Мета-бейджи */}
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-muted-foreground">
              {kindLabel && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/80 border border-border/50 text-foreground font-medium">
                  {anime.kind === 'movie' ? <Film className="w-3.5 h-3.5 text-primary" /> : <Tv className="w-3.5 h-3.5 text-primary" />}
                  {kindLabel}
                </span>
              )}
              {statusLabel && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/80 border border-border/50 text-foreground font-medium">
                  <Calendar className="w-3.5 h-3.5 text-primary" />
                  {statusLabel}
                </span>
              )}
              {episodesTotal > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/80 border border-border/50 text-foreground font-medium">
                  <PlayCircle className="w-3.5 h-3.5 text-primary" />
                  {episodesCurrent}/{episodesTotal} {getEpisodeText(episodesTotal)}
                </span>
              )}
              {score && parseFloat(score) > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-secondary/80 border border-border/50 font-bold text-yellow-400">
                  <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                  {score}
                </span>
              )}
            </div>
          </header>

          {/* Главное описание аниме */}
          {anime.description && (
            <div className="mb-6" itemProp="description">
              <p className="text-muted-foreground leading-relaxed whitespace-pre-line text-base sm:text-lg">
                {anime.description}
              </p>
            </div>
          )}

          {/* Жанры */}
          {anime.genres && anime.genres.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs uppercase tracking-wider font-bold text-foreground mb-3 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-primary" />
                Жанры:
              </h3>
              <ul className="flex flex-wrap gap-2">
                {anime.genres.map((genre) => (
                  <li key={genre}>
                    <a 
                      href={`/catalog?genre=${encodeURIComponent(genre)}`}
                      className="inline-block px-3.5 py-1.5 rounded-full bg-secondary/60 border border-border/80 text-muted-foreground hover:text-primary hover:border-primary/40 text-xs sm:text-sm font-medium transition-all"
                    >
                      {genre}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* SEO подвал страницы */}
          <div className="pt-4 border-t border-border/50">
            <p className="text-xs sm:text-sm text-muted-foreground/80 leading-relaxed">
              <strong className="text-foreground">{animeTitle}</strong> — смотреть аниме онлайн бесплатно в хорошем качестве HD на сайте Weebx. 
              Все серии с русской озвучкой и субтитрами доступны без регистрации.
              {(anime as any).originalTitle && (anime as any).originalTitle !== animeTitle ? ` Оригинальное название: ${(anime as any).originalTitle}.` : ''}
              {(anime as any).english && (anime as any).english !== animeTitle && (anime as any).english !== (anime as any).originalTitle ? ` Английское название: ${(anime as any).english}.` : ''}
            </p>
          </div>
        </article>

        {/* Порядок просмотра */}
        <CoverProvider>
          <WatchOrderSection watchOrder={watchOrder} />
        </CoverProvider>
      </div>

      <Footer />
    </main>
  )
}