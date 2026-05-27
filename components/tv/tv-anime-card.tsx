"use client"

import { useState } from 'react'
import Image from 'next/image'
import { Play } from 'lucide-react'
import { useDpadNavigation } from '@/hooks/use-dpad-navigation'

interface TVAnimeCardProps {
  id: string
  title: string
  imageUrl: string
  episodesCurrent?: number
  episodesTotal?: number
  rating?: number
  onSelect?: () => void
}

export function TVAnimeCard({ id, title, imageUrl, episodesCurrent, episodesTotal, rating, onSelect }: TVAnimeCardProps) {
  const [isFocused, setIsFocused] = useState(false)

  return (
    <button
      onClick={onSelect}
      onFocus={() => setIsFocused(true)}
      onBlur={() => setIsFocused(false)}
      className={`
        group relative overflow-hidden rounded-lg transition-all duration-300
        ${isFocused ? 'scale-110 ring-4 ring-primary z-10' : 'scale-100'}
        focus:outline-none
      `}
      style={{ aspectRatio: '2/3' }}
    >
      <Image
        src={imageUrl || '/placeholder.png'}
        alt={title}
        fill
        className="object-cover"
        sizes="(max-width: 768px) 50vw, 25vw"
      />
      
      <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent">
        <div className="absolute bottom-0 left-0 right-0 p-3 bg-black/80">
          <h3 className="font-bold text-base line-clamp-2 mb-1">{title}</h3>
          <div className="flex items-center gap-3 text-xs text-gray-300">
            {episodesTotal && <span>{episodesTotal} эп.</span>}
            {rating && <span>⭐ {rating.toFixed(1)}</span>}
          </div>
        </div>
      </div>
      
      {isFocused && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-primary rounded-full p-4">
            <Play className="h-8 w-8" fill="currentColor" />
          </div>
        </div>
      )}
    </button>
  )
}
