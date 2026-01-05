"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { PlayerLoading } from "@/components/player-loading"
import type { Anime } from "@/lib/anime-data"
import { Tv, Server } from "lucide-react"

interface PlayerInterfaceProps {
  anime: Anime
}

export function PlayerInterface({ anime }: PlayerInterfaceProps) {
  const availableVoiceovers = Object.keys(anime.players)
  
  const [currentVoiceover, setCurrentVoiceover] = useState(availableVoiceovers[0])
  const [currentEpisodeIndex, setCurrentEpisodeIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  
  const currentVideoUrl = anime.players[currentVoiceover][currentEpisodeIndex]
  const totalEpisodes = anime.players[currentVoiceover].length

  useEffect(() => {
    setIsLoading(true)
    
    // Имитируем минимальное время загрузки для UX
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 800)

    return () => clearTimeout(timer)
  }, [currentVideoUrl])

  const handleIframeLoad = () => {
    setIsLoading(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Плеер */}
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black border border-zinc-800 shadow-2xl group z-20">
        {isLoading && <PlayerLoading />}
        <iframe
          key={currentVideoUrl}
          src={currentVideoUrl}
          title={`${anime.title}`}
          className={`h-full w-full object-cover transition-opacity duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
          allowFullScreen
          // ВАЖНО: Разрешения для сторонних плееров (Namy, Alloha и др.)
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
          referrerPolicy="origin" // Помогает обходить некоторые блокировки
          onLoad={handleIframeLoad}
        />
      </div>

      {/* Панель управления (Табы) */}
      <div className="rounded-xl border border-white/5 bg-zinc-900/50 p-4 md:p-6 backdrop-blur-sm">
        
        {/* Выбор источника (Плеера) */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3 text-zinc-500">
             <Server size={14} />
             <h3 className="text-xs font-medium uppercase tracking-wider">Источник</h3>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {availableVoiceovers.map((vo) => (
              <Button
                key={vo}
                variant={currentVoiceover === vo ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setCurrentVoiceover(vo)
                  setCurrentEpisodeIndex(0)
                }}
                className={`transition-all font-medium ${
                  currentVoiceover === vo
                    ? "bg-orange-600 text-white hover:bg-orange-700 border-transparent shadow-[0_0_15px_rgba(234,88,12,0.3)]"
                    : "border-zinc-700 bg-zinc-800/30 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                }`}
              >
                {vo}
              </Button>
            ))}
          </div>
        </div>

        {/* Выбор серии (Показываем только если серий > 1) */}
        {totalEpisodes > 1 && (
          <div>
            <div className="flex items-center justify-between mb-3 text-zinc-500">
               <div className="flex items-center gap-2">
                 <Tv size={14} />
                 <h3 className="text-xs font-medium uppercase tracking-wider">Серии</h3>
               </div>
               <span className="text-xs text-orange-500 font-medium">Выбрана: {currentEpisodeIndex + 1}</span>
            </div>
            
            <div className="grid grid-cols-5 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              {anime.players[currentVoiceover].map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentEpisodeIndex(index)}
                  className={`flex h-9 items-center justify-center rounded-md text-sm font-bold transition-all ${
                    currentEpisodeIndex === index
                      ? "bg-white text-black shadow-lg scale-105"
                      : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 border border-zinc-700/50"
                  }`}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}