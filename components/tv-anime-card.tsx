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
  onSelect: () => void
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
      
      <div className={`
        absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent
        transition-opacity duration-300
        ${isFocused ? 'opacity-100' : 'opacity-0'}
      `}>
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3 className="font-bold text-lg line-clamp-2 mb-2">{title}</h3>
          <div className="flex items-center gap-3 text-sm text-gray-300">
            {episodesTotal && <span>{episodesTotal} эп.</span>}
            {rating && <span>⭐ {rating.toFixed(1)}</span>}
          </div>
        </div>
        
        {isFocused && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="bg-primary rounded-full p-4">
              <Play className="h-8 w-8" fill="currentColor" />
            </div>
          </div>
        )}
      </div>
    </button>
  )
}
