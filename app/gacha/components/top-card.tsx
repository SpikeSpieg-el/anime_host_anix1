import React, { useState } from "react"
import { Loader2 } from "lucide-react"
import { Card } from "../types"
import { rarityConfig } from "@/types/gacha"
import { getOptimizedThumbSrc, handleImageError } from "../utils"

interface TopCardProps {
  card: Card
  onClick: (card: Card) => void
}

export const TopCard = ({ card, onClick }: TopCardProps) => {
  const [isImageLoading, setIsImageLoading] = useState(true)

  return (
    <div
      className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative group bg-slate-900 cursor-pointer transition-all hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/20"
      onClick={() => onClick(card)}
    >
      <img
        src={getOptimizedThumbSrc(card.imageUrl, 384, 60)}
        className="absolute inset-0 w-full h-full object-cover"
        alt={card.name}
        referrerPolicy="no-referrer"
        style={card.artPosition ? { objectPosition: `${card.artPosition.x}% ${card.artPosition.y}%` } : undefined}
        onError={(e) => handleImageError(e, card, true)}
        onLoad={() => setIsImageLoading(false)}
      />
      
      {isImageLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-20">
          <Loader2 className="w-5 h-5 text-white/60 animate-spin" />
        </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
      <div className={`absolute top-2 right-2 w-3 h-3 rounded-full bg-gradient-to-r ${rarityConfig[card.rarity].color} shadow-lg border border-white/20`} />
      <div className="absolute bottom-0 inset-x-0 p-2 sm:p-3">
        <p className="text-[8px] sm:text-[9px] font-bold text-slate-300 uppercase truncate mb-1">{card.anime}</p>
        <p className="text-xs sm:text-sm font-black text-white truncate leading-tight">{card.name}</p>
      </div>
    </div>
  )
}
