"use client"
import Image from "next/image"
import Link from "next/link"
import { Play, Info } from "lucide-react"

export function HeroBanner({ anime }: { anime: any }) {
  if (!anime) return null

  return (
    <div className="relative w-full h-[550px] md:h-[700px] mb-12 overflow-hidden">
      {/* Фоновое изображение */}
      <div className="absolute inset-0">
        <Image 
          src={anime.poster} 
          alt={anime.title} 
          fill 
          priority
          className="object-cover object-top opacity-60 md:opacity-100" // На мобиле чуть темнее
        />
        {/* Градиентный переход в черный */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/40 to-transparent" />
      </div>

      {/* Контент */}
      <div className="relative h-full container mx-auto px-4 flex flex-col justify-end pb-20 z-10">
        <div className="max-w-2xl animate-in fade-in slide-in-from-bottom-10 duration-700">
          <span className="inline-block px-3 py-1 mb-4 text-xs font-bold tracking-wider text-orange-400 border border-orange-500/30 bg-orange-500/10 rounded-full uppercase">
            {anime.status === 'Ongoing' ? 'Топ недели' : 'Рекомендуем'}
          </span>
          
          <h1 className="text-4xl md:text-6xl font-black text-white mb-4 leading-tight">
            {anime.title}
          </h1>
          
          <p className="text-zinc-300 text-sm md:text-lg line-clamp-3 mb-8 max-w-xl text-shadow">
            {anime.description || "Погрузитесь в захватывающую историю этого аниме..."}
          </p>
          
          <div className="flex items-center gap-4">
            <Link 
              href={`/watch/${anime.id}`}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 text-white px-8 py-3.5 rounded-xl font-bold transition-all hover:scale-105 shadow-lg shadow-orange-900/20"
            >
              <Play fill="currentColor" size={20} />
              Смотреть
            </Link>
            <button className="flex items-center gap-2 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white px-6 py-3.5 rounded-xl font-bold transition-colors border border-white/10">
              <Info size={20} />
              Подробнее
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}