"use client"

import { Sparkles, Calendar, TrendingUp, Play, ExternalLink, ChevronRight } from "lucide-react"
import Link from "next/link"
import Image from "next/image"

// Helper function for dynamic episode/series text
const getEpisodeText = (count: number): string => {
  if (count === 1) return "Серия"
  const lastDigit = count % 10
  const lastTwoDigits = count % 100
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) return "Серий"
  if (lastDigit === 1) return "Серия"
  if (lastDigit >= 2 && lastDigit <= 4) return "Серии"
  return "Серий"
}

interface AnimeShort {
  id: string
  title: string
  poster: string
  episodesCurrent?: number
  year?: number
  airedOn?: string
  status?: string
}

interface UpdatesBannerProps {
  updates: AnimeShort[]
  announcements: AnimeShort[]
}

export function UpdatesBanner({ updates, announcements }: UpdatesBannerProps) {
  if (updates.length === 0 && announcements.length === 0) return null

  return (
    <section className="w-full mb-10 sm:mb-16">
      <div className="mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-3xl font-bold text-foreground mb-1 flex items-center gap-2 sm:gap-3">
            <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-orange-400" />
            Лента событий
          </h2>
          <p className="text-muted-foreground text-xs sm:text-sm">Новые серии и анонсы</p>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-secondary/40 border rounded-xl sm:rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-400" />
              <h3 className="text-base sm:text-lg font-bold text-foreground">Только вышло</h3>
            </div>
            <Link
              href="/schedule"
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition flex items-center gap-1"
            >
              Расписание <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {updates.slice(0, 3).map((anime) => (
              <Link
                key={anime.id}
                href={`/watch/${anime.id}`}
                className="group flex items-center gap-4 rounded-xl p-3 bg-secondary/40 hover:bg-secondary/60 border hover:border-accent transition-all active:scale-[0.99]"
              >
                <div className="relative w-12 h-16 sm:w-14 sm:h-20 rounded-lg overflow-hidden shrink-0 bg-secondary">
                  <Image
                    src={anime.poster}
                    alt={anime.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="56px"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm sm:text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {anime.title}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-black">
                      {getEpisodeText(anime.episodesCurrent || 0)} {anime.episodesCurrent}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground">Обновление</span>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-lg bg-secondary/50 border flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <Play className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-secondary/40 border rounded-xl sm:rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              <h3 className="text-base sm:text-lg font-bold text-foreground">Скоро на экранах</h3>
            </div>
            <Link
              href="/catalog?status=anons"
              className="text-xs sm:text-sm font-medium text-muted-foreground hover:text-foreground transition flex items-center gap-1"
            >
              Все <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {announcements.slice(0, 3).map((anime) => (
              <Link
                key={anime.id}
                href={`/watch/${anime.id}`}
                className="group flex items-center gap-4 rounded-xl p-3 bg-secondary/40 hover:bg-secondary/60 border hover:border-accent transition-all active:scale-[0.99]"
              >
                <div className="relative w-12 h-16 sm:w-14 sm:h-20 rounded-lg overflow-hidden shrink-0 bg-secondary">
                  <Image
                    src={anime.poster}
                    alt={anime.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="56px"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm sm:text-base font-bold text-foreground truncate group-hover:text-primary transition-colors">
                    {anime.title}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-secondary/50 text-muted-foreground border border-border">
                      {anime.year || "TBA"}
                    </span>
                    <span className="text-[10px] sm:text-xs text-muted-foreground truncate">
                      {anime.airedOn ? new Date(anime.airedOn).toLocaleDateString("ru-RU") : "Скоро"}
                    </span>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-lg bg-secondary/50 border flex items-center justify-center text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}