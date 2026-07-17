"use client"

import React, { useState } from "react"
import { Coins, Star, Clock, Flame, Info } from "lucide-react"
import { Rarity, rarityConfig } from "@/types/gacha"
import { getProxiedSrc } from "../utils"
import { BannerInfoModal } from "./banner-info-modal"

export interface BannerCardItem {
  id: string
  cardPayload: any
  weight: number
  isFeatured: boolean
}

export interface Banner {
  id: string
  name: string
  description: string | null
  imageUrl: string | null
  promoImageUrl: string | null
  featuredAnimeIds: number[]
  boostedRarity: string | null
  price: number | null
  color: string | null
  startDate: string | null
  endDate: string | null
  isActive: boolean
  sortOrder: number
  cards: BannerCardItem[]
  guaranteedCardPayload: any | null
  guaranteedCardPity: number
}

interface BannerCardProps {
  banner: Banner
  onSelect: (banner: Banner) => void
  userCoins: number
  onInfoOpenChange?: (open: boolean) => void
  remainingPity?: number
  pityClaimed?: boolean
  sessionToken?: string
}

function formatCountdown(endDate: string | null): string {
  if (!endDate) return "Бессрочно"
  const end = new Date(endDate).getTime()
  const now = Date.now()
  if (end <= now) return "Завершено"
  const diff = end - now
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
  if (days > 0) return `${days}д ${hours}ч`
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  if (hours > 0) return `${hours}ч ${minutes}м`
  return `${minutes}м`
}

export const BannerCard = ({ banner, onSelect, userCoins, onInfoOpenChange, remainingPity, pityClaimed, sessionToken }: BannerCardProps) => {
  const [showInfo, setShowInfo] = useState(false)
  const [imgError, setImgError] = useState(false)
  const handleSetShowInfo = (v: boolean) => {
    setShowInfo(v)
    onInfoOpenChange?.(v)
  }
  const price = banner.price ?? 100
  const canAfford = userCoins >= price
  const featuredCards = (banner.cards || []).filter(c => c.isFeatured).slice(0, 3)
  const colorGradient = banner.color || "from-purple-600 to-pink-700"
  const promoArt = banner.promoImageUrl

  return (
    <>
    <div
      onClick={() => canAfford && onSelect(banner)}
      className={`relative group rounded-2xl sm:rounded-3xl overflow-hidden border border-pink-500/20 transition-all duration-300 hover:scale-[1.03] hover:border-pink-500/60 hover:shadow-2xl hover:shadow-pink-500/20 ${canAfford ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed grayscale-[0.4]'}`}
    >
      {/* Background image (card background) */}
      {banner.imageUrl && (
        <div className="absolute inset-0">
          <img
            src={getProxiedSrc(banner.imageUrl)}
            alt=""
            className="w-full h-full object-cover"
            onError={() => {}}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-black/60 to-black/90" />
        </div>
      )}
      {!banner.imageUrl && (
        <div className={`absolute inset-0 bg-gradient-to-br ${colorGradient} opacity-80`} />
      )}

      {/* Promo art — clean image, no overlays */}
      {promoArt && !imgError && (
        <div className="relative w-full" style={{ aspectRatio: '7 / 5' }}>
          <img
            src={getProxiedSrc(promoArt)}
            alt={banner.name}
            className="w-full h-full object-contain"
            onError={() => setImgError(true)}
          />
        </div>
      )}

      {/* Fallback header when no promo art — show badges inline */}
      {!promoArt || imgError ? (
        <div className="relative z-10 p-5 sm:p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-pink-500/30 backdrop-blur-md rounded-xl border border-pink-400/40 shadow-lg">
              <Flame className="w-4 h-4 text-pink-300" />
              <span className="text-xs font-black text-pink-100 uppercase tracking-wider">Ивент</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleSetShowInfo(true) }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-lg text-white/70 hover:text-white hover:bg-slate-800 transition-colors"
                title="Информация о банере"
              >
                <Info className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-black text-white">{price}</span>
              </div>
            </div>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-white mb-2 leading-tight drop-shadow-lg">{banner.name}</h3>
          {banner.description && (
            <p className="text-sm text-white/70 mb-3 line-clamp-2">{banner.description}</p>
          )}
        </div>
      ) : null}

      {/* Body section — badges + name + description + featured cards + badges */}
      <div className="relative z-10 p-5 sm:p-6 pt-4">
        {/* Top row: event badge + price + info (in body, not on promo art) */}
        {promoArt && !imgError && (
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-pink-500/30 backdrop-blur-md rounded-xl border border-pink-400/40 shadow-lg">
              <Flame className="w-4 h-4 text-pink-300" />
              <span className="text-xs font-black text-pink-100 uppercase tracking-wider">Ивент</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={(e) => { e.stopPropagation(); handleSetShowInfo(true) }}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-900/80 backdrop-blur-md border border-white/10 shadow-lg text-white/70 hover:text-white hover:bg-slate-800 transition-colors"
                title="Информация о банере"
              >
                <Info className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
                <Coins className="w-4 h-4 text-yellow-400" />
                <span className="text-sm font-black text-white">{price}</span>
              </div>
            </div>
          </div>
        )}

        {/* Banner name + description (below promo art, on background) */}
        <h3 className="text-xl sm:text-2xl font-black text-white leading-tight drop-shadow-lg mb-1">{banner.name}</h3>
        {banner.description && (
          <p className="text-sm text-white/70 line-clamp-2 mb-3">{banner.description}</p>
        )}

        {/* Featured cards preview */}
        <div className="flex gap-2 mb-4">
          {featuredCards.map((fc) => {
              const payload = fc.cardPayload || {}
              const rarity = (payload.rarity as Rarity) || "common"
              const imgUrl = payload.imageUrl || payload.originalUrl || ""
              return (
                <div
                  key={fc.id}
                  className={`relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg overflow-hidden border-2 ${rarityConfig[rarity] ? `border-${rarityConfig[rarity].color.split(' ')[0].replace('from-', '')}/50` : 'border-white/20'} shadow-lg`}
                >
                  {imgUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getProxiedSrc(imgUrl)}
                      alt={payload.characterName || payload.name || 'card'}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                      <Star className="w-5 h-5 text-slate-600" />
                    </div>
                  )}
                  <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r ${rarityConfig[rarity]?.color || 'from-slate-500 to-slate-700'}`} />
                </div>
              )
            })}
          {/* Guaranteed card preview */}
          {banner.guaranteedCardPayload && (
            <div className="flex flex-col items-center gap-1">
              <div className="relative w-16 h-24 sm:w-20 sm:h-28 rounded-lg overflow-hidden border-2 border-amber-400/70 shadow-lg shadow-amber-500/20">
                {banner.guaranteedCardPayload.imageUrl || banner.guaranteedCardPayload.originalUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={getProxiedSrc(banner.guaranteedCardPayload.imageUrl || banner.guaranteedCardPayload.originalUrl)}
                    alt={banner.guaranteedCardPayload.name || 'guaranteed'}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-amber-900/40 flex items-center justify-center">
                    <Flame className="w-5 h-5 text-amber-400" />
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-400 to-yellow-500" />
              </div>
              <span className="text-[9px] font-black text-amber-300 uppercase tracking-wide">Гарант</span>
            </div>
          )}
        </div>

        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Countdown */}
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900/70 backdrop-blur-md border border-white/10">
            <Clock className="w-3.5 h-3.5 text-pink-300" />
            <span className="text-xs font-bold text-pink-200">{formatCountdown(banner.endDate)}</span>
          </div>

          {/* Boosted rarity */}
          {banner.boostedRarity && rarityConfig[banner.boostedRarity as Rarity] && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-pink-500/20 backdrop-blur-md border border-pink-500/30">
              <Star className="w-3.5 h-3.5 text-pink-300" />
              <span className="text-xs font-bold text-pink-200 tracking-wide uppercase">
                Гарант: {rarityConfig[banner.boostedRarity as Rarity].label}
              </span>
            </div>
          )}

          {/* Guaranteed custom card pity */}
          {banner.guaranteedCardPayload && banner.guaranteedCardPity > 0 && (
            <div className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-amber-500/20 backdrop-blur-md border border-amber-500/30">
              <Flame className="w-3.5 h-3.5 text-amber-300" />
              <span className="text-xs font-bold text-amber-200 tracking-wide uppercase">
                {pityClaimed
                  ? 'Гарант получен'
                  : remainingPity !== undefined
                    ? `Гарант-карта через ${remainingPity} круток`
                    : `Гарант-карта через ${banner.guaranteedCardPity} круток`}
              </span>
            </div>
          )}
        </div>

        {!canAfford && (
          <div className="mt-3 text-xs bg-red-500/20 text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 font-bold inline-block">
            Недостаточно монет
          </div>
        )}
      </div>
    </div>
    {showInfo && <BannerInfoModal banner={banner} onClose={() => handleSetShowInfo(false)} remainingPity={remainingPity} pityClaimed={pityClaimed} sessionToken={sessionToken} />}
    </>
  )
}
