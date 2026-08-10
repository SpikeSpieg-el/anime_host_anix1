"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Play, Clock } from "lucide-react"

interface EpisodeSelectorProps {
  totalEpisodes: number
  currentEpisode: number
  onSelectEpisode: (episode: number) => void
  lastWatchedInfo?: {
    season?: number
    episode?: number
    time?: string
    translation?: string
  } | null
}

export function EpisodeSelector({ 
  totalEpisodes, 
  currentEpisode, 
  onSelectEpisode,
  lastWatchedInfo
}: EpisodeSelectorProps) {
  const episodesPerPage = 24
  const [isCollapsed, setIsCollapsed] = useState(true)
  const scrollRowRef = useRef<HTMLDivElement>(null)
  
  const initialPage = Math.floor((Math.max(1, currentEpisode) - 1) / episodesPerPage)
  const [currentPage, setCurrentPage] = useState(initialPage)

  const totalPages = Math.max(1, Math.ceil(totalEpisodes / episodesPerPage))
  const startEpisode = currentPage * episodesPerPage + 1
  const endEpisode = Math.min(startEpisode + episodesPerPage - 1, totalEpisodes)
  const allEpisodes = useMemo(() => Array.from({ length: totalEpisodes }, (_, i) => i + 1), [totalEpisodes])

  // Синхронизация текущей страницы с выбранной серией — только по текущей серии и количеству страниц
  useEffect(() => {
    const targetPage = Math.floor((currentEpisode - 1) / episodesPerPage)
    if (targetPage >= 0 && targetPage < totalPages) {
      setCurrentPage((prev) => (prev === targetPage ? prev : targetPage))
    }
  }, [currentEpisode, totalPages])

  // Автоскролл до выбранной серии в компактном режиме
  useEffect(() => {
    if (!isCollapsed || !scrollRowRef.current) return
    const timer = setTimeout(() => {
      const active = scrollRowRef.current?.querySelector<HTMLButtonElement>(`[data-episode="${currentEpisode}"]`)
      active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" })
    }, 50)
    return () => clearTimeout(timer)
  }, [currentEpisode, isCollapsed])

  const handlePrevPage = () => {
    setCurrentPage((prev) => Math.max(0, prev - 1))
  }

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + 1))
  }

  const episodes = Array.from(
    { length: Math.max(0, endEpisode - startEpisode + 1) },
    (_, i) => startEpisode + i
  )

  // Оптимизация рендера в компактном режиме: показываем окно вокруг текущей серии, чтобы не рендерить тысячи кнопок
  const collapsedWindow = useMemo(() => {
    const maxVisible = 120 // максимум кнопок в ряду при свернутом виде
    if (totalEpisodes <= maxVisible) return allEpisodes

    const half = Math.floor(maxVisible / 2)
    const start = Math.max(1, currentEpisode - half)
    const end = Math.min(totalEpisodes, currentEpisode + half - 1)

    // Если окно у края, сдвигаем чтобы показать maxVisible
    let realStart = start
    let realEnd = end
    if (realEnd - realStart + 1 < maxVisible) {
      if (realStart === 1) {
        realEnd = Math.min(totalEpisodes, realStart + maxVisible - 1)
      } else if (realEnd === totalEpisodes) {
        realStart = Math.max(1, realEnd - maxVisible + 1)
      } else {
        // наполняем с левой стороны при возможности
        realStart = Math.max(1, currentEpisode - half)
        realEnd = Math.min(totalEpisodes, realStart + maxVisible - 1)
      }
    }

    // Если не показываем полный ряд, добавим индикаторы начала/конца (не рендерятся здесь, просто возвращаем массив)
    return Array.from({ length: realEnd - realStart + 1 }, (_, i) => realStart + i)
  }, [allEpisodes, totalEpisodes, currentEpisode])

  return (
    <div className="w-full">
      {/* Прогресс / Последняя остановка */}
      {lastWatchedInfo && lastWatchedInfo.episode && (
        <div className="mb-4 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center flex-shrink-0">
                <Play className="w-4 h-4 text-orange-500 fill-current ml-0.5" />
              </div>
              <div>
                <p className="text-xs text-orange-400 font-medium">Вы остановились на:</p>
                
                <div className="flex items-center gap-2 flex-wrap mt-0.5">
                  <span className="text-sm text-zinc-100 font-bold">
                    {lastWatchedInfo.episode} серия
                  </span>

                  {/* Вывод Таймкода */}
                  {lastWatchedInfo.time && lastWatchedInfo.time !== "0:00" && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-400 bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 rounded-md">
                      <Clock className="w-3 h-3" />
                      {lastWatchedInfo.time}
                    </span>
                  )}

                  {/* Вывод Озвучки */}
                  {lastWatchedInfo.translation && (
                    <span className="text-xs text-zinc-400 font-normal hidden sm:inline">
                      ({lastWatchedInfo.translation})
                    </span>
                  )}
                </div>
              </div>
            </div>

            {lastWatchedInfo.episode !== currentEpisode && (
              <button
                type="button"
                onClick={() => onSelectEpisode(lastWatchedInfo.episode!)}
                className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold transition-colors shadow-md shadow-orange-600/20"
              >
                Продолжить ({lastWatchedInfo.episode} серия)
              </button>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-zinc-400">
          {isCollapsed ? "Галерея серий" : "Сетка серий"}
        </span>
        <button
          type="button"
          onClick={() => {
            const willCollapse = !isCollapsed
            setIsCollapsed(willCollapse)
            // Если разворачиваем в сетку — выставим страницу, содержащую текущую серию
            if (!willCollapse) {
              const targetPage = Math.floor((currentEpisode - 1) / episodesPerPage)
              setCurrentPage((prev) => (prev === targetPage ? prev : targetPage))
            }
          }}
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
          {collapsedWindow.map((episode, idx) => (
            <button
              key={episode}
              data-episode={episode}
              type="button"
              onClick={() => onSelectEpisode(episode)}
              className={`
                flex-shrink-0 px-3.5 py-2 rounded-lg text-sm font-medium transition-all border
                ${currentEpisode === episode
                  ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/30 font-bold'
                  : 'bg-zinc-900/80 text-zinc-300 border-zinc-800 hover:border-zinc-600 hover:text-white'
                }
              `}
            >
              {episode}
            </button>
          ))}

          {collapsedWindow[0] !== 1 && (
            <div className="flex items-center gap-2 ml-2">
              <span className="text-xs text-zinc-400">…</span>
              <button type="button" onClick={() => onSelectEpisode(1)} className="px-3 py-1 rounded-md text-xs text-zinc-300 hover:text-white">1</button>
            </div>
          )}
          {collapsedWindow[collapsedWindow.length - 1] !== totalEpisodes && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => onSelectEpisode(totalEpisodes)} className="px-3 py-1 rounded-md text-xs text-zinc-300 hover:text-white">{totalEpisodes}</button>
              <span className="text-xs text-zinc-400">…</span>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12 gap-2 mb-4">
            {episodes.map((episode) => (
              <button
                key={episode}
                type="button"
                onClick={() => onSelectEpisode(episode)}
                className={`
                  relative aspect-square rounded-lg font-medium text-sm transition-all duration-200 flex items-center justify-center border
                  ${currentEpisode === episode
                    ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-600/30 font-bold scale-105 z-10'
                    : 'bg-zinc-800/50 text-zinc-300 hover:bg-zinc-700 hover:text-white border-white/5'
                  }
                `}
              >
                {episode}
              </button>
            ))}
          </div>

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
              
              <span className="text-xs font-medium text-zinc-400 min-w-[90px] text-center">
                {startEpisode} - {endEpisode} <span className="text-zinc-600">/</span> {totalEpisodes}
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