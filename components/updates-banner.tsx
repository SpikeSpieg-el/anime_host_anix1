"use client"

import { Sparkles, Calendar, TrendingUp, Play, ExternalLink, X } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"

interface AnimeShort {
  id: string
  title: string
  poster: string
  episodesCurrent?: number
  year?: number
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
    // Изменено: mb-6 для мобилок, mb-12 для ПК
    <div className="w-full rounded-2xl bg-gradient-to-r from-orange-900/40 via-red-900/40 to-pink-900/40 backdrop-blur-md mb-6 md:mb-12 relative overflow-hidden border border-orange-500/20 shadow-xl">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-pink-500/5 animate-pulse pointer-events-none"></div>
      
      {/* Изменено: p-4 для мобилок, p-6/p-8 для планшетов/ПК */}
      <div className="relative z-10 p-4 sm:p-6 md:p-8">
        
        {/* Заголовок */}
        <div className="flex flex-row items-center gap-3 mb-4 sm:mb-6 pr-8">
          <div className="flex items-center gap-2 min-w-0 flex-shrink-0">
            <Sparkles className="w-5 h-5 text-orange-400" />
            <h3 className="text-lg sm:text-2xl font-bold text-white truncate">Лента обновлений</h3>
          </div>
          <div className="h-px bg-gradient-to-r from-orange-500/50 to-transparent flex-1"></div>
        </div>

        {/* Сетка: 1 колонка на мобилках, 2 на планшетах (md) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          
          {/* Левая колонка */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h4 className="text-base sm:text-lg font-semibold text-green-400">Свежие серии</h4>
            </div>
            
            <div className="flex flex-col gap-2 sm:gap-3">
              {updates.map((anime) => (
                <Link 
                  key={anime.id}
                  href={`/watch/${anime.id}`}
                  // Добавлено: active:scale-[0.98] для тактильного отклика на телефоне
                  className="flex items-center gap-3 p-2.5 sm:p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 active:bg-white/15 transition-all active:scale-[0.98] sm:hover:scale-[1.01] hover:border-orange-500/30 group"
                >
                  <div className="relative w-10 h-14 sm:w-12 sm:h-16 rounded-md overflow-hidden flex-shrink-0 bg-zinc-800">
                    <Image
                      src={anime.poster}
                      alt={anime.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 640px) 40px, 48px"
                    />
                    <div className="absolute top-1 right-1 w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
                    <p className="text-white font-medium text-xs sm:text-sm truncate pr-1 group-hover:text-orange-400 transition-colors leading-tight mb-1.5">
                      {anime.title}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs">
                        <span className="text-zinc-300 bg-zinc-800/80 px-1.5 py-0.5 rounded border border-white/5">
                           {anime.episodesCurrent ? `${anime.episodesCurrent} серия` : 'Новинка'}
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-400 truncate">Сегодня</span>
                    </div>
                  </div>
                  
                  {/* Иконка: На мобильном (default) видима всегда, на ПК (sm) скрыта и появляется при наведении */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/10 text-orange-400 
                                  opacity-100 sm:opacity-0 sm:-translate-x-2 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 transition-all">
                    <Play className="w-3.5 h-3.5 ml-0.5" fill="currentColor" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Правая колонка */}
          <div className="space-y-3 sm:space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Calendar className="w-4 h-4 text-purple-400" />
              <h4 className="text-base sm:text-lg font-semibold text-purple-400">Скоро на экранах</h4>
            </div>
            
            <div className="flex flex-col gap-2 sm:gap-3">
              {announcements.map((anime) => (
                <Link 
                  key={anime.id}
                  href={`/watch/${anime.id}`}
                  className="flex items-center gap-3 p-2.5 sm:p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 active:bg-white/15 transition-all active:scale-[0.98] sm:hover:scale-[1.01] hover:border-purple-500/30 group"
                >
                  <div className="relative w-10 h-14 sm:w-12 sm:h-16 rounded-md overflow-hidden flex-shrink-0 bg-zinc-800">
                    <Image
                      src={anime.poster}
                      alt={anime.title}
                      fill
                      className="object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                      sizes="(max-width: 640px) 40px, 48px"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col justify-center h-full">
                    <p className="text-white font-medium text-xs sm:text-sm truncate pr-1 group-hover:text-purple-300 transition-colors leading-tight mb-1.5">
                      {anime.title}
                    </p>
                    <div className="flex items-center gap-1.5 text-[10px] sm:text-xs">
                         <span className="text-purple-300 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                           Анонс
                        </span>
                        <span className="text-zinc-600">•</span>
                        <span className="text-zinc-400">{anime.year || "Скоро"}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/10 text-purple-400 
                                  opacity-100 sm:opacity-0 sm:-translate-x-2 sm:group-hover:opacity-100 sm:group-hover:translate-x-0 transition-all">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Кнопка закрытия: увеличена зона клика для пальца */}
        <button 
          onClick={() => setIsDismissed(true)}
          className="absolute top-2 right-2 sm:top-4 sm:right-4 text-zinc-500 hover:text-white bg-black/10 hover:bg-black/40 p-2 sm:p-1 rounded-full transition-all active:scale-90"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}