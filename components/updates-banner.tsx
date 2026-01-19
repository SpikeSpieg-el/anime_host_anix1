"use client"

import { Sparkles, Calendar, TrendingUp, Play, ExternalLink, X, ChevronRight } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"

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
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null
  if (updates.length === 0 && announcements.length === 0) return null

  return (
    <section className="w-full mb-10 sm:mb-16">
      <div className="flex items-start justify-between gap-4 mb-4 sm:mb-6">
        <div>
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-1 flex items-center gap-2 sm:gap-3">
            <Sparkles className="w-6 h-6 sm:w-7 sm:h-7 text-orange-400" />
            Лента событий
          </h2>
          <p className="text-zinc-500 text-xs sm:text-sm">Новые серии и анонсы</p>
        </div>

        <button
          onClick={() => setIsDismissed(true)}
          className="p-2 rounded-full bg-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-white border border-white/5 hover:border-white/10 transition-colors"
          title="Скрыть блок"
          aria-label="Скрыть ленту событий"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl sm:rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-orange-400" />
              <h3 className="text-base sm:text-lg font-bold text-white">Только вышло</h3>
            </div>
            <Link
              href="/catalog?status=ongoing&sort=new"
              className="text-xs sm:text-sm font-medium text-zinc-400 hover:text-white transition flex items-center gap-1"
            >
              Расписание <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {updates.slice(0, 3).map((anime) => (
              <Link
                key={anime.id}
                href={`/watch/${anime.id}`}
                className="group flex items-center gap-4 rounded-xl p-3 bg-zinc-950/40 hover:bg-zinc-950/60 border border-white/5 hover:border-zinc-600 transition-all active:scale-[0.99]"
              >
                <div className="relative w-12 h-16 sm:w-14 sm:h-20 rounded-lg overflow-hidden shrink-0 bg-zinc-900">
                  <Image
                    src={anime.poster}
                    alt={anime.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="56px"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm sm:text-base font-bold text-white truncate group-hover:text-orange-400 transition-colors">
                    {anime.title}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-black">
                      EP {anime.episodesCurrent}
                    </span>
                    <span className="text-[10px] sm:text-xs text-zinc-500">Обновление</span>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-lg bg-zinc-800/50 border border-white/5 flex items-center justify-center text-zinc-300 group-hover:bg-orange-500/10 group-hover:text-orange-400 transition-colors">
                  <Play className="w-4 h-4" />
                </div>
              </Link>
            ))}
          </div>
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800 rounded-xl sm:rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-400" />
              <h3 className="text-base sm:text-lg font-bold text-white">Скоро на экранах</h3>
            </div>
            <Link
              href="/catalog?status=anons"
              className="text-xs sm:text-sm font-medium text-zinc-400 hover:text-white transition flex items-center gap-1"
            >
              Все <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="space-y-3">
            {announcements.slice(0, 3).map((anime) => (
              <Link
                key={anime.id}
                href={`/watch/${anime.id}`}
                className="group flex items-center gap-4 rounded-xl p-3 bg-zinc-950/40 hover:bg-zinc-950/60 border border-white/5 hover:border-zinc-600 transition-all active:scale-[0.99]"
              >
                <div className="relative w-12 h-16 sm:w-14 sm:h-20 rounded-lg overflow-hidden shrink-0 bg-zinc-900">
                  <Image
                    src={anime.poster}
                    alt={anime.title}
                    fill
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                    sizes="56px"
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm sm:text-base font-bold text-white truncate group-hover:text-purple-400 transition-colors">
                    {anime.title}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800/50 text-zinc-300 border border-white/5">
                      {anime.year || "TBA"}
                    </span>
                    <span className="text-[10px] sm:text-xs text-zinc-500 truncate">
                      {anime.airedOn ? new Date(anime.airedOn).toLocaleDateString("ru-RU") : "Скоро"}
                    </span>
                  </div>
                </div>

                <div className="w-9 h-9 rounded-lg bg-zinc-800/50 border border-white/5 flex items-center justify-center text-zinc-300 group-hover:bg-purple-500/10 group-hover:text-purple-300 transition-colors">
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