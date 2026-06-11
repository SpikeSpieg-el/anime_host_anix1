import React, { useState } from "react"
import Image from "next/image"
import { Loader2, Crown, RefreshCcw } from "lucide-react"
import { Card } from "../types"
import { rarityConfig } from "@/types/gacha"
import { getProxiedSrc, isPinterestUrl, handleImageError } from "../utils"

interface CollectionCardProps {
  card: Card
  onClick: (card: Card) => void
}

export const CollectionCard = ({ card, onClick }: CollectionCardProps) => {
  const [isImageLoading, setIsImageLoading] = useState(true)

  return (
    <div
      onClick={() => onClick(card)}
      className={`aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 relative group bg-slate-900 cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-indigo-500/20 ${rarityConfig[card.rarity].glow}`}
    >
      <Image
        src={getProxiedSrc(card.imageUrl)}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        alt={card.name}
        fill
        unoptimized={isPinterestUrl(card.imageUrl)}
        sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 15vw"
        quality={50}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(e) => handleImageError(e, card, true)}
        onLoad={() => setIsImageLoading(false)}
      />
      
      {isImageLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-20">
          <Loader2 className="w-6 h-6 text-white/60 animate-spin" />
        </div>
      )}
      
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300" />
      
      <div className={`absolute top-2.5 right-2.5 w-3 h-3 rounded-full bg-gradient-to-r ${rarityConfig[card.rarity].color} shadow-lg border border-white/20`} />
      
      {card.isMainCharacter && (
        <div className="absolute top-2.5 left-2.5 w-6 h-6 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 shadow-lg flex items-center justify-center border border-yellow-200">
          <Crown className="w-3.5 h-3.5 text-amber-950" />
        </div>
      )}
      
      {card.isMainCharacter && card.isArtBlacklisted && (
        <div className="absolute top-10 left-2.5 w-6 h-6 rounded-full bg-red-500/80 border border-red-300 flex items-center justify-center backdrop-blur-sm">
          <RefreshCcw className="w-3 h-3 text-white" />
        </div>
      )}
      
      <div className="absolute bottom-0 inset-x-0 p-3 sm:p-4 transition-transform duration-300 group-hover:translate-y-[-4px]">
        <p className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase truncate mb-0.5">★{card.score.toFixed(1)} {card.anime}</p>
        <p className="text-sm sm:text-base font-black text-white truncate leading-tight drop-shadow-md">{card.name}</p>
      </div>
    </div>
  )
}
