"use client"

import { Sparkles, Calendar, TrendingUp, Play, ExternalLink, X, ChevronRight } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { cn } from "@/lib/utils"

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
    <section className="relative w-full mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Основной контейнер с эффектом стекла */}
      <div className="relative overflow-hidden rounded-3xl border border-white/5 bg-zinc-900/40 backdrop-blur-xl shadow-2xl">
        
        {/* Декоративные фоновые элементы */}
        <div className="absolute top-0 right-0 -mt-20 -mr-20 w-80 h-80 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 -mb-20 -ml-20 w-80 h-80 bg-purple-500/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none" />

        <div className="relative z-10 p-6 md:p-8">
          {/* Заголовок секции */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500/20 to-purple-500/20 border border-white/5 shadow-inner">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white leading-none">Лента событий</h3>
                <p className="text-xs text-zinc-500 font-medium mt-1">Новые серии и анонсы</p>
              </div>
            </div>
            
            <button 
              onClick={() => setIsDismissed(true)}
              className="group p-2 rounded-full hover:bg-white/5 transition-colors text-zinc-500 hover:text-white"
              title="Скрыть блок"
            >
              <X size={20} className="transition-transform group-hover:rotate-90" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 relative">
            {/* Разделитель по центру для десктопа */}
            <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-white/10 to-transparent" />

            {/* ЛЕВАЯ КОЛОНКА: Свежие серии */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-orange-400" />
                <span className="text-sm font-bold text-orange-400 uppercase tracking-widest">Только вышло</span>
              </div>
              
              <div className="space-y-3">
                {updates.slice(0, 3).map((anime, idx) => (
                  <Link 
                    key={anime.id}
                    href={`/watch/${anime.id}`}
                    className="group flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20"
                  >
                    <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 shadow-md">
                      <Image
                        src={anime.poster}
                        alt={anime.title}
                        fill
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        sizes="56px"
                      />
                      {/* Индикатор новизны */}
                      {idx === 0 && (
                        <div className="absolute inset-0 border-2 border-orange-500/50 rounded-xl animate-pulse" />
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0 py-1">
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-orange-400 transition-colors">
                        {anime.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-orange-500 text-black">
                           EP {anime.episodesCurrent}
                        </span>
                        <span className="text-[10px] text-zinc-400">Сегодня</span>
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 group-hover:bg-orange-500 group-hover:text-white transition-all">
                      <Play size={12} fill="currentColor" />
                    </div>
                  </Link>
                ))}
              </div>
              
              <Link href="/catalog?status=ongoing&sort=new" className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-white transition-colors ml-1">
                Показать расписание <ChevronRight size={12} />
              </Link>
            </div>

            {/* ПРАВАЯ КОЛОНКА: Анонсы */}
            <div className="space-y-5">
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-purple-400 uppercase tracking-widest">Скоро на экранах</span>
              </div>
              
              <div className="space-y-3">
                {announcements.slice(0, 3).map((anime) => (
                  <Link 
                    key={anime.id}
                    href={`/watch/${anime.id}`}
                    className="group flex items-center gap-4 p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-transparent hover:border-white/5 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-black/20"
                  >
                    <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 grayscale group-hover:grayscale-0 transition-all duration-500 shadow-md">
                      <Image
                        src={anime.poster}
                        alt={anime.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                      />
                    </div>
                    
                    <div className="flex-1 min-w-0 py-1">
                      <h4 className="text-sm font-bold text-white truncate group-hover:text-purple-400 transition-colors">
                        {anime.title}
                      </h4>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-zinc-800 text-zinc-300 border border-zinc-700">
                           {anime.year || 'TBA'}
                        </span>
                        <span className="text-[10px] text-zinc-400 truncate">
                          {anime.airedOn ? new Date(anime.airedOn).toLocaleDateString("ru-RU") : "Скоро"}
                        </span>
                      </div>
                    </div>

                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-500 group-hover:bg-purple-500 group-hover:text-white transition-all">
                      <ExternalLink size={12} />
                    </div>
                  </Link>
                ))}
              </div>

               <Link href="/catalog?status=anons" className="inline-flex items-center gap-1 text-xs font-bold text-zinc-500 hover:text-white transition-colors ml-1">
                Все анонсы <ChevronRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}