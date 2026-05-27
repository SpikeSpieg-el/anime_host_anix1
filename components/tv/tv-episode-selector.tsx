"use client"

import { useState, useRef, useEffect } from 'react'

interface TVEpisodeSelectorProps {
  currentEpisode: number
  totalEpisodes: number
  onEpisodeSelect: (episode: number) => void
}

export function TVEpisodeSelector({ currentEpisode, totalEpisodes, onEpisodeSelect }: TVEpisodeSelectorProps) {
  const [focusedEpisode, setFocusedEpisode] = useState(currentEpisode)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setFocusedEpisode(currentEpisode)
  }, [currentEpisode])

  useEffect(() => {
    if (scrollRef.current) {
      const focusedButton = scrollRef.current.querySelector(`[data-episode="${focusedEpisode}"]`)
      if (focusedButton) {
        focusedButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
      }
    }
  }, [focusedEpisode])

  const episodes = Array.from({ length: totalEpisodes }, (_, i) => i + 1)

  return (
    <div className="bg-secondary/40 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-4">Выбрать серию</h2>
      
      <div 
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin scrollbar-thumb-primary scrollbar-track-secondary"
      >
        {episodes.map((ep) => (
          <button
            key={ep}
            data-episode={ep}
            onClick={() => onEpisodeSelect(ep)}
            onFocus={() => setFocusedEpisode(ep)}
            className={`
              flex-shrink-0 w-20 h-20 rounded-lg font-bold text-xl transition-all
              ${ep === currentEpisode 
                ? 'bg-primary text-primary-foreground' 
                : 'bg-secondary hover:bg-secondary/80 text-foreground'
              }
              ${ep === focusedEpisode ? 'ring-4 ring-primary scale-110' : 'scale-100'}
              focus:outline-none
            `}
          >
            {ep}
          </button>
        ))}
      </div>
    </div>
  )
}
