"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

interface EpisodeSelectorProps {
  totalEpisodes: number
  currentEpisode: number
  onSelectEpisode: (episode: number) => void
}

export function EpisodeSelector({ 
  totalEpisodes, 
  currentEpisode, 
  onSelectEpisode 
}: EpisodeSelectorProps) {
  const episodesPerPage = 24
  const [isCollapsed, setIsCollapsed] = useState(true)
  const scrollRowRef = useRef<HTMLDivElement>(null)
  
  // Вычисляем начальную страницу на основе текущей серии
  // (currentEpisode - 1) потому что серии с 1, а индексы с 0
  const initialPage = Math.floor((currentEpisode - 1) / episodesPerPage)
  
  const [currentPage, setCurrentPage] = useState(initialPage)

  const totalPages = Math.ceil(totalEpisodes / episodesPerPage)
  const startEpisode = currentPage * episodesPerPage + 1
  const endEpisode = Math.min(startEpisode + episodesPerPage - 1, totalEpisodes)
  const allEpisodes = useMemo(() => Array.from({ length: totalEpisodes }, (_, i) => i + 1), [totalEpisodes])

  // Если currentEpisode изменился извне (например, переключили в плеере), 
  // подстраиваем страницу, если серия не видна
  useEffect(() => {
    const targetPage = Math.floor((currentEpisode - 1) / episodesPerPage)
    if (targetPage !== currentPage) {
      setCurrentPage(targetPage)
    }
  }, [currentEpisode])

  // В свернутом режиме автоматически скроллим до выбранной серии
  useEffect(() => {
    if (!isCollapsed || !scrollRowRef.current) return
    const active = scrollRowRef.current.querySelector<HTMLButtonElement>(`[data-episode="${currentEpisode}"]`)
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
  }, [currentEpisode, isCollapsed])

  const handlePrevPage = () => {
    if (currentPage > 0) setCurrentPage(currentPage - 1)
  }

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) setCurrentPage(currentPage + 1)
  }

  const episodes = Array.from(
    { length: endEpisode - startEpisode + 1 },
    (_, i) => startEpisode + i
  )

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-400">
          {isCollapsed ? "Галерея серий" : "Сетки серий"}
        </span>
        <button
          type="button"
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="text-xs font-semibold text-orange-500 hover:text-orange-400 transition underline underline-offset-4"
        >
          {isCollapsed ? "Развернуть" : "Свернуть"}
        </button>
      </div>

      {isCollapsed ? (
        <div
          ref={scrollRowRef}
          className="flex items-center gap-2 overflow-x-auto pb-2 hide-scrollbar"
        >
          {allEpisodes.map((episode) => (
            <button
              key={episode}
              data-episode={episode}
              type="button"
              onClick={() => onSelectEpisode(episode)}
              className={`
                flex-shrink-0 px-3 py-2 rounded-lg text-sm font-medium transition-all border
                ${currentEpisode === episode
                  ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/30'
                  : 'bg-zinc-900/80 text-zinc-300 border-zinc-800 hover:border-zinc-600 hover:text-white'
                }
              `}
            >
              {episode}
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 mb-6">
            {episodes.map((episode) => (
              <button
                key={episode}
                type="button"
                onClick={() => onSelectEpisode(episode)}
                className={`
                  relative aspect-square rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center
                  ${currentEpisode === episode
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30 scale-105 z-10'
                    : 'bg-zinc-800/50 text-zinc-400 hover:bg-zinc-700 hover:text-white border border-white/5 hover:border-white/10'
                  }
                `}
              >
                {episode}
              </button>
            ))}
          </div>

          {/* Пагинация (показываем только если страниц > 1) */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-4 py-2 bg-zinc-950/30 rounded-lg border border-white/5 w-fit mx-auto px-4">
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={currentPage === 0}
                className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft size={18} />
              </button>
              
              <span className="text-xs font-medium text-zinc-500 min-w-[90px] text-center">
                {startEpisode} - {endEpisode} <span className="text-zinc-700 mx-1">/</span> {totalEpisodes}
              </span>
              
              <button
                type="button"
                onClick={handleNextPage}
                disabled={currentPage === totalPages - 1}
                className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}