"use client"

import { Sparkles, Calendar, TrendingUp, Play, ExternalLink, X } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"

// Определяем интерфейс для пропсов, чтобы TS не ругался
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
  
  // Если данных нет, не показываем баннер
  if (updates.length === 0 && announcements.length === 0) return null

  return (
    <div className="w-full rounded-2xl bg-gradient-to-r from-orange-900/40 via-red-900/40 to-pink-900/40 backdrop-blur-md mb-12 relative overflow-hidden border border-orange-500/20 shadow-2xl">
      {/* Шумовой эффект */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 pointer-events-none"></div>
      
      {/* Анимированный фон */}
      <div className="absolute inset-0 bg-gradient-to-br from-orange-500/5 via-transparent to-pink-500/5 animate-pulse pointer-events-none"></div>
      
      <div className="relative z-10 p-6 md:p-8">
        {/* Заголовок с иконкой */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-orange-400" />
            <h3 className="text-2xl font-bold text-white">Лента обновлений</h3>
          </div>
          <div className="h-px bg-gradient-to-r from-orange-500/50 to-transparent flex-1"></div>
        </div>

        {/* Две колонки: Обновления и Анонсы */}
        <div className="grid md:grid-cols-2 gap-8">
          
          {/* Левая колонка - Новые серии */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <h4 className="text-lg font-semibold text-green-400">Свежие серии</h4>
            </div>
            
            <div className="space-y-3">
              {updates.map((anime) => (
                <Link 
                  key={anime.id}
                  href={`/watch/${anime.id}`}
                  className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all hover:scale-[1.01] hover:border-orange-500/30 group"
                >
                  {/* Миниатюра */}
                  <div className="relative w-12 h-16 rounded-md overflow-hidden flex-shrink-0 bg-zinc-800">
                    <Image
                      src={anime.poster}
                      alt={anime.title}
                      fill
                      className="object-cover"
                    />
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-medium text-sm truncate pr-2 group-hover:text-orange-400 transition-colors">
                        {anime.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="text-zinc-300 bg-zinc-800/80 px-1.5 py-0.5 rounded">
                           {anime.episodesCurrent ? `${anime.episodesCurrent} серия` : 'Новинка'}
                        </span>
                        <span className="text-zinc-500">•</span>
                        <span className="text-zinc-400">Только что</span>
                    </div>
                  </div>
                  
                  {/* Иконка перехода */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-orange-500/20 text-orange-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                    <Play className="w-3 h-3 ml-0.5" fill="currentColor" />
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Правая колонка - Анонсы */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar className="w-4 h-4 text-purple-400" />
              <h4 className="text-lg font-semibold text-purple-400">Скоро на экранах</h4>
            </div>
            
            <div className="space-y-3">
              {announcements.map((anime) => (
                <Link 
                  key={anime.id}
                  href={`/watch/${anime.id}`}
                  className="flex items-start gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all hover:scale-[1.01] hover:border-purple-500/30 group"
                >
                  <div className="relative w-12 h-16 rounded-md overflow-hidden flex-shrink-0 bg-zinc-800">
                    <Image
                      src={anime.poster}
                      alt={anime.title}
                      fill
                      className="object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                    />
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-purple-500"></div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-white font-medium text-sm truncate pr-2 group-hover:text-purple-300 transition-colors">
                        {anime.title}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                         <span className="text-purple-300 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">
                           Анонс
                        </span>
                        <span className="text-zinc-500">•</span>
                        <span className="text-zinc-400">{anime.year || "Скоро"}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-500/20 text-purple-400 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all">
                    <ExternalLink className="w-3 h-3" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* Кнопка закрытия */}
        <button 
          onClick={() => setIsDismissed(true)}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white bg-black/20 hover:bg-black/50 rounded-full p-1 transition-all"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}