"use client"

import React from 'react'
import { Anime } from '@/lib/shikimori'


interface WatchPageOrderProps {
  anime: Anime
}

export function WatchPageOrder({ anime }: WatchPageOrderProps) {
  return (
    <div id="order" className="bg-card/20 border border-border rounded-2xl p-4 md:p-6 backdrop-blur-sm">
      <h2 className="text-lg md:text-xl font-bold text-foreground mb-4">
        Порядок просмотра
      </h2>
      <p className="text-muted-foreground">
        Информация о порядке просмотра будет здесь.
      </p>
    </div>
  )
}
