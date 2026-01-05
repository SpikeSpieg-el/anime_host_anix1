"use client"

import { useState } from "react"
import { Play, ChevronLeft, ChevronRight } from "lucide-react"

interface EpisodeSelectorProps {
  totalEpisodes: number
  currentEpisode?: number
  onSelectEpisode: (episode: number) => void
  onStartWatching: () => void
}

export function EpisodeSelector({ 
  totalEpisodes, 
  currentEpisode, 
  onSelectEpisode, 
  onStartWatching 
}: EpisodeSelectorProps) {
  const [selectedEpisode, setSelectedEpisode] = useState<number>(currentEpisode || 1)

  const episodesPerPage = 20
  const [currentPage, setCurrentPage] = useState(0)

  const totalPages = Math.ceil(totalEpisodes / episodesPerPage)
  const startEpisode = currentPage * episodesPerPage + 1
  const endEpisode = Math.min(startEpisode + episodesPerPage - 1, totalEpisodes)

  const handleEpisodeClick = (episode: number) => {
    setSelectedEpisode(episode)
    onSelectEpisode(episode)
  }

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  const episodes = Array.from(
    { length: endEpisode - startEpisode + 1 },
    (_, i) => startEpisode + i
  )

  return (
    <div className="w-full max-w-4xl mx-auto p-6 bg-zinc-900 border border-zinc-800 rounded-xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Выберите серию</h2>
        <p className="text-zinc-400 text-sm">
          Всего {totalEpisodes} серий. Выбрана серия {selectedEpisode}
        </p>
      </div>

      <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 mb-6">
        {episodes.map((episode) => (
          <button
            key={episode}
            type="button"
            onClick={() => handleEpisodeClick(episode)}
            className={`
              aspect-square rounded-lg font-medium text-sm transition-all
              ${selectedEpisode === episode
                ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
              }
            `}
          >
            {episode}
          </button>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 mb-6">
          <button
            type="button"
            onClick={handlePrevPage}
            disabled={currentPage === 0}
            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronLeft size={20} />
          </button>
          
          <span className="text-sm text-zinc-400">
            {currentPage + 1} / {totalPages}
          </span>
          
          <button
            type="button"
            onClick={handleNextPage}
            disabled={currentPage === totalPages - 1}
            className="p-2 rounded-lg bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={onStartWatching}
        className="w-full py-4 bg-orange-600 hover:bg-orange-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-600/20"
      >
        <Play size={20} fill="currentColor" />
        Смотреть серию {selectedEpisode}
      </button>
    </div>
  )
}
