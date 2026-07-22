"use client"

import React, { useState, useEffect, useCallback } from "react"
import { X, Star, Coins, Clock, Flame, Shield, TrendingUp, Sparkles, ChevronLeft, ChevronRight, Tv } from "lucide-react"
import { Rarity, rarityConfig } from "@/types/gacha"
import { getProxiedSrc } from "@/lib/image-loader"
import type { Banner, BannerCardItem } from "./banner-card"
import type { Card } from "../types"
import { InteractiveCard } from "./interactive-card"

function payloadToCard(payload: any): Card {
  return {
    id: payload.id ?? 0,
    uniqueId: payload.uniqueId ?? `preview-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    serialId: payload.serialId ?? "",
    name: payload.name || payload.characterName || "???",
    anime: payload.anime || payload.animeName || "",
    rarity: (payload.rarity as Rarity) || "common",
    imageUrl: payload.imageUrl || payload.originalUrl || "",
    originalUrl: payload.originalUrl || payload.imageUrl || "",
    fallbackUrls: payload.fallbackUrls,
    score: payload.score ?? 0,
    shikiId: payload.shikiId ?? 0,
    characterId: payload.characterId ?? 0,
    stats: payload.stats || { hp: 0, atk: 0, def: 0, spd: 0, luck: 0 },
    isMainCharacter: payload.isMainCharacter,
    packId: payload.packId,
    packName: payload.packName,
    frameModifier: payload.frameModifier,
    coatingModifier: payload.coatingModifier,
    isArtBlacklisted: payload.isArtBlacklisted,
    orderIndex: payload.orderIndex,
    imageLayers: payload.imageLayers,
    artPosition: payload.artPosition,
  }
}

const RARITY_ORDER: Rarity[] = [
  "trash", "common", "uncommon", "rare", "super_rare", "epic",
  "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"
]

interface BannerInfoModalProps {
  banner: Banner | null
  onClose: () => void
  remainingPity?: number
  pityClaimed?: boolean
  sessionToken?: string
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—"
  const d = new Date(dateStr)
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
}

function getRarityLabel(rarity: string): string {
  return rarityConfig[rarity as Rarity]?.label || rarity
}

export const BannerInfoModal = ({ banner, onClose, remainingPity: propRemainingPity, pityClaimed: propPityClaimed, sessionToken }: BannerInfoModalProps) => {
  const [cardPage, setCardPage] = useState(0)
  const [viewedCard, setViewedCard] = useState<Card | null>(null)
  const [animePool, setAnimePool] = useState<{ id: number; name: string; russian: string | null; imageUrl: string | null }[]>([])
  const [animePoolLoading, setAnimePoolLoading] = useState(false)
  const [liveRemainingPity, setLiveRemainingPity] = useState<number | undefined>(propRemainingPity)
  const [livePityClaimed, setLivePityClaimed] = useState<boolean | undefined>(propPityClaimed)
  const [collectedGGs, setCollectedGGs] = useState<number[]>([])
  const cardsPerPage = 12

  useEffect(() => {
    setCardPage(0)
  }, [banner?.id])

  useEffect(() => {
    if (!banner?.featuredAnimeIds || banner.featuredAnimeIds.length === 0) {
      setAnimePool([])
      return
    }
    setAnimePoolLoading(true)
    const ids = banner.featuredAnimeIds.join(',')
    fetch(`/api/anime-batch?ids=${ids}`)
      .then(r => r.json())
      .then(data => setAnimePool(data.anime || []))
      .catch(() => setAnimePool([]))
      .finally(() => setAnimePoolLoading(false))
  }, [banner?.id, banner?.featuredAnimeIds])

  useEffect(() => {
    setLiveRemainingPity(propRemainingPity)
    setLivePityClaimed(propPityClaimed)
    setCollectedGGs([])
    if (!banner?.id) return
    const isDyn = banner.bannerType === 'dynamic'
    const effectivePity = (isDyn && banner.guaranteedCardPity === 0) ? 50 : (banner.guaranteedCardPity || 0)
    if (effectivePity <= 0) return
    const headers: Record<string, string> = {}
    if (sessionToken) headers['Authorization'] = `Bearer ${sessionToken}`
    fetch('/api/banners/pulls', { headers })
      .then(r => r.json())
      .then(data => {
        if (data.pulls && data.pulls[banner.id]) {
          const pull = data.pulls[banner.id]
          setLivePityClaimed(pull.guaranteedClaimed)
          if (pull.collectedGuaranteedCards) {
            setCollectedGGs(pull.collectedGuaranteedCards)
          }
          if (!pull.guaranteedClaimed) {
            setLiveRemainingPity(Math.max(0, effectivePity - pull.pullCount))
          }
        }
      })
      .catch(() => {})
  }, [banner?.id, banner?.guaranteedCardPity, banner?.bannerType, propRemainingPity, propPityClaimed, sessionToken])

  const handleEsc = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (viewedCard) { setViewedCard(null); return }
      onClose()
    }
  }, [onClose, viewedCard])

  useEffect(() => {
    if (banner) {
      window.addEventListener("keydown", handleEsc)
      document.body.style.overflow = "hidden"
    }
    return () => {
      window.removeEventListener("keydown", handleEsc)
      document.body.style.overflow = ""
    }
  }, [banner, handleEsc])

  if (!banner) return null

  const isDynamic = banner.bannerType === 'dynamic'
  const dynContent = banner.dynamicContent

  const ggCards: BannerCardItem[] = isDynamic && dynContent
    ? dynContent.guaranteedCharacters.map((c: any) => ({
        id: `dyn-${c.characterId}`,
        cardPayload: {
          ...c,
          rarity: 'legendary',
          name: c.characterName,
          characterName: c.characterName,
          animeName: c.animeName,
          anime: c.animeName,
          isMainCharacter: true,
        },
        weight: 1,
        isFeatured: true,
      }))
    : (banner.guaranteedCardsPool && banner.guaranteedCardsPool.length > 0
      ? banner.guaranteedCardsPool.map((c: any) => ({
          id: `pool-${c.characterId}`,
          cardPayload: {
            ...c,
            rarity: c.rarity || 'legendary',
            name: c.name || c.characterName,
            characterName: c.characterName || c.name,
            animeName: c.animeName || c.anime || '',
            anime: c.anime || c.animeName || '',
            isMainCharacter: c.isMainCharacter ?? true,
          },
          weight: 1,
          isFeatured: true,
        }))
      : [])
  const allCards: BannerCardItem[] = isDynamic ? [] : (banner.cards || [])
  const totalWeight = allCards.reduce((sum, c) => sum + (c.weight || 0), 0)
  const featuredCards = allCards.filter(c => c.isFeatured)
  const regularCards = allCards.filter(c => !c.isFeatured)
  const dynamicPity = (isDynamic && banner.guaranteedCardPity === 0) ? 50 : (banner.guaranteedCardPity || 0)
  const dynamicRemainingPity = liveRemainingPity !== undefined ? liveRemainingPity : dynamicPity

  const rarityDistribution: Record<string, { count: number; weight: number; chance: number }> = {}
  allCards.forEach(c => {
    const rarity = (c.cardPayload?.rarity as string) || "common"
    if (!rarityDistribution[rarity]) {
      rarityDistribution[rarity] = { count: 0, weight: 0, chance: 0 }
    }
    rarityDistribution[rarity].count++
    rarityDistribution[rarity].weight += c.weight || 0
  })
  Object.keys(rarityDistribution).forEach(r => {
    rarityDistribution[r].chance = totalWeight > 0 ? (rarityDistribution[r].weight / totalWeight) * 100 : 0
  })

  const sortedRarities = Object.keys(rarityDistribution).sort(
    (a, b) => RARITY_ORDER.indexOf(b as Rarity) - RARITY_ORDER.indexOf(a as Rarity)
  )

  const totalPages = Math.ceil(allCards.length / cardsPerPage)
  const pagedCards = allCards.slice(cardPage * cardsPerPage, (cardPage + 1) * cardsPerPage)

  const price = banner.price ?? 100
  const colorGradient = banner.color || "from-purple-600 to-pink-700"

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center sm:p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-4xl max-h-[92vh] sm:max-h-[85vh] overflow-y-auto overflow-x-hidden rounded-t-2xl sm:rounded-2xl border border-pink-500/30 bg-gradient-to-b from-slate-900 to-slate-950 shadow-2xl shadow-pink-500/10"
        onClick={e => e.stopPropagation()}
      >
        {/* Promo art with overlaid controls */}
        {banner.promoImageUrl ? (
          <div className="relative w-full overflow-hidden max-h-[40vh] sm:max-h-[45vh]" style={{ aspectRatio: '7 / 5' }}>
            <img
              src={getProxiedSrc(banner.promoImageUrl)}
              alt={banner.name}
              className="w-full h-full object-contain bg-slate-950"
            />
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            {/* Event badge */}
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-pink-500/30 backdrop-blur-md rounded-lg border border-pink-400/40">
              <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-pink-300" />
              <span className="text-[9px] sm:text-[10px] font-black text-pink-100 uppercase tracking-wider">Ивент</span>
            </div>
          </div>
        ) : (
          <div className="relative h-28 sm:h-36 overflow-hidden">
            <div className={`absolute inset-0 bg-gradient-to-br ${colorGradient} opacity-70`} />
            <button
              onClick={onClose}
              className="absolute top-2 right-2 sm:top-3 sm:right-3 z-20 w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center rounded-full bg-black/60 backdrop-blur-md border border-white/20 text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
            <div className="absolute top-2 left-2 sm:top-3 sm:left-3 flex items-center gap-1.5 px-2 sm:px-2.5 py-1 bg-pink-500/30 backdrop-blur-md rounded-lg border border-pink-400/40">
              <Flame className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-pink-300" />
              <span className="text-[9px] sm:text-[10px] font-black text-pink-100 uppercase tracking-wider">Ивент</span>
            </div>
          </div>
        )}

        {/* Content */}
        <div className="p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-5">
          {/* Title + Description */}
          <div>
            <h2 className="text-lg sm:text-2xl md:text-3xl font-black text-white drop-shadow-lg leading-tight mb-2">{banner.name}</h2>
            {banner.description && (
              <div className="bg-slate-800/50 rounded-xl p-3 sm:p-4 border border-white/5">
                <p className="text-xs sm:text-sm text-white/80 leading-relaxed">{banner.description}</p>
              </div>
            )}
          </div>

          {/* Key info grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
            {/* Price */}
            <div className="bg-slate-800/50 rounded-xl p-2.5 sm:p-3 border border-white/5 flex flex-col items-center gap-1">
              <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
              <span className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wide">Цена</span>
              <span className="text-sm sm:text-lg font-black text-white">{price}</span>
            </div>

            {/* Guaranteed rarity */}
            <div className="bg-slate-800/50 rounded-xl p-2.5 sm:p-3 border border-white/5 flex flex-col items-center gap-1">
              <Shield className="w-4 h-4 sm:w-5 sm:h-5 text-pink-300" />
              <span className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wide">Гарант</span>
              <span className="text-[11px] sm:text-sm font-black text-pink-200 text-center leading-tight">
                {isDynamic
                  ? dynamicPity > 0
                    ? `${ggCards.length} ГГ (${dynamicRemainingPity})`
                    : "Нет"
                  : banner.guaranteedCardsPool && banner.guaranteedCardsPool.length > 0 && banner.guaranteedCardPity > 0
                    ? `${banner.guaranteedCardsPool.length} карт (${dynamicRemainingPity})`
                    : banner.boostedRarity
                      ? getRarityLabel(banner.boostedRarity)
                      : banner.guaranteedCardPayload && banner.guaranteedCardPity > 0
                        ? livePityClaimed
                          ? 'Получена'
                          : liveRemainingPity !== undefined
                            ? `Карта (${liveRemainingPity})`
                            : `Карта (${banner.guaranteedCardPity})`
                        : "Нет"}
              </span>
            </div>

            {/* Duration */}
            <div className="bg-slate-800/50 rounded-xl p-2.5 sm:p-3 border border-white/5 flex flex-col items-center gap-1">
              <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-300" />
              <span className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wide">Срок</span>
              <span className="text-[11px] sm:text-sm font-bold text-cyan-200 text-center leading-tight">
                {isDynamic && dynContent
                  ? `Смена через ${Math.ceil((new Date(dynContent.rotationEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}д`
                  : banner.endDate ? formatDate(banner.endDate) : "Бессрочно"}
              </span>
            </div>

            {/* Total cards */}
            <div className="bg-slate-800/50 rounded-xl p-2.5 sm:p-3 border border-white/5 flex flex-col items-center gap-1">
              <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-purple-300" />
              <span className="text-[10px] sm:text-xs text-white/50 uppercase tracking-wide">{isDynamic ? "Онгоингов" : "Карт"}</span>
              <span className="text-sm sm:text-lg font-black text-white">
                {isDynamic && dynContent ? dynContent.ongoingAnimeIds.length : allCards.length}
              </span>
            </div>
          </div>

          {/* Anime pool */}
          {isDynamic && dynContent ? (
            <div>
              <h3 className="text-sm font-black text-cyan-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Tv className="w-4 h-4" />
                Онгоинги в пуле ({dynContent.ongoingAnimeIds.length})
              </h3>
              <p className="text-xs text-white/50 mb-2">Роллы идут по всем онгоингам. Тайтл-фокус меняется каждые 3 дня.</p>
              <div className="flex flex-wrap gap-2">
                {dynContent.ongoingAnimeIds.slice(0, 30).map((id: number) => (
                  <div key={id} className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-white/10">
                    <span className="text-[11px] sm:text-xs font-bold text-white/50">#{id}</span>
                  </div>
                ))}
                {dynContent.ongoingAnimeIds.length > 30 && (
                  <div className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-white/10">
                    <span className="text-[11px] sm:text-xs font-bold text-white/30">+{dynContent.ongoingAnimeIds.length - 30}</span>
                  </div>
                )}
              </div>
            </div>
          ) : banner.featuredAnimeIds && banner.featuredAnimeIds.length > 0 && (
            <div>
              <h3 className="text-sm font-black text-cyan-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Tv className="w-4 h-4" />
                Аниме в пуле ({banner.featuredAnimeIds.length})
              </h3>
              {animePoolLoading ? (
                <div className="flex items-center gap-2 text-xs text-white/40">
                  <div className="w-3 h-3 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
                  Загрузка...
                </div>
              ) : animePool.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {animePool.map(anime => (
                    <div
                      key={anime.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-white/10 max-w-[200px]"
                    >
                      {anime.imageUrl && (
                        <img
                          src={getProxiedSrc(anime.imageUrl)}
                          alt=""
                          className="w-6 h-8 object-cover rounded flex-shrink-0"
                        />
                      )}
                      <span className="text-[11px] sm:text-xs font-bold text-white/80 truncate">
                        {anime.russian || anime.name}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {banner.featuredAnimeIds.map(id => (
                    <div
                      key={id}
                      className="px-2.5 py-1.5 rounded-lg bg-slate-800/60 border border-white/10"
                    >
                      <span className="text-[11px] sm:text-xs font-bold text-white/50">#{id}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Guaranteed GG pool (dynamic or standard with pool) */}
          {ggCards.length > 0 && (
            <div className="bg-amber-500/10 rounded-xl p-3 sm:p-4 border border-amber-500/30">
              <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4" />
                Гарантированные ГГ ({ggCards.length})
              </h3>
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40">
                  <Flame className="w-3 h-3 text-amber-300" />
                  <span className="text-[11px] font-bold text-amber-200">
                    {collectedGGs.length >= ggCards.length
                      ? 'Все ГГ собраны! Цикл сброшен'
                      : `Гарант через ${dynamicRemainingPity} круток`}
                  </span>
                </div>
                {collectedGGs.length > 0 && collectedGGs.length < ggCards.length && (
                  <span className="text-[11px] text-white/50">
                    Собрано: {collectedGGs.length}/{ggCards.length}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-3 gap-2 sm:gap-3">
                {ggCards.map((gg, ggIdx) => {
                  const payload = gg.cardPayload
                  const imgUrl = payload?.imageUrl || payload?.originalUrl || ""
                  const isCollected = collectedGGs.includes(ggIdx)
                  return (
                    <div
                      key={gg.id}
                      className={`relative rounded-lg overflow-hidden border-2 bg-slate-800 shadow-lg cursor-pointer hover:scale-105 transition-transform ${isCollected ? 'border-emerald-500/60' : 'border-amber-500/50'}`}
                      onClick={() => setViewedCard(payloadToCard(payload))}
                    >
                      <div className="aspect-[2/3] relative">
                        {imgUrl ? (
                          <img src={getProxiedSrc(imgUrl)} alt={payload?.characterName || payload?.name || ""} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Star className="w-6 h-6 text-slate-600" />
                          </div>
                        )}
                        {isCollected && (
                          <div className="absolute inset-0 bg-emerald-500/20 flex items-center justify-center">
                            <div className="px-2 py-0.5 rounded-full bg-emerald-500/80 text-[10px] font-black text-white">
                              СОБРАНА
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-1.5 sm:p-2">
                        <p className="text-[10px] sm:text-xs font-bold text-white truncate">{payload?.characterName || payload?.name || "???"}</p>
                        <p className="text-[9px] sm:text-[10px] text-white/50 truncate">{payload?.animeName || payload?.anime || ""}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Featured cards (standard banners only) */}
          {!isDynamic && featuredCards.length > 0 && (
            <div>
              <h3 className="text-sm font-black text-pink-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Star className="w-4 h-4" />
                Рекомендованные карты ({featuredCards.length})
              </h3>
              <div className="flex gap-2 sm:gap-3 overflow-x-auto pb-2 -mx-1 px-1" style={{ WebkitOverflowScrolling: 'touch' }}>
                {featuredCards.map(fc => (
                  <CardMiniCard key={fc.id} item={fc} totalWeight={totalWeight} onClick={() => setViewedCard(payloadToCard(fc.cardPayload))} />
                ))}
              </div>
            </div>
          )}

          {/* Drop chances by rarity (standard banners only) */}
          {!isDynamic && sortedRarities.length > 0 && (
            <div>
              <h3 className="text-sm font-black text-cyan-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Шансы по редкости
              </h3>
              <div className="space-y-2">
                {sortedRarities.map(rarity => {
                  const info = rarityDistribution[rarity]
                  const cfg = rarityConfig[rarity as Rarity]
                  return (
                    <div key={rarity} className="flex items-center gap-2 sm:gap-3">
                      <div className={`w-1.5 sm:w-2 h-6 sm:h-8 rounded-full bg-gradient-to-b ${cfg?.color || "from-slate-500 to-slate-700"} flex-shrink-0`} />
                      <div className="flex-1 flex items-center justify-between min-w-0 gap-2">
                        <span className="text-xs sm:text-sm font-bold text-white/90 truncate">{cfg?.label || rarity}</span>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-[10px] sm:text-xs text-white/40">{info.count} шт.</span>
                          <span className="text-xs sm:text-sm font-black text-white tabular-nums">{info.chance.toFixed(1)}%</span>
                        </div>
                      </div>
                      <div className="hidden sm:block w-24 md:w-32 h-1.5 sm:h-2 rounded-full bg-slate-700/50 overflow-hidden flex-shrink-0">
                        <div
                          className={`h-full bg-gradient-to-r ${cfg?.color || "from-slate-500 to-slate-700"}`}
                          style={{ width: `${Math.min(info.chance, 100)}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Guaranteed card pity (standard banners only) */}
          {!isDynamic && banner.guaranteedCardPayload && banner.guaranteedCardPity > 0 && (
            <div className="bg-amber-500/10 rounded-xl p-3 sm:p-4 border border-amber-500/30">
              <h3 className="text-sm font-black text-amber-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Flame className="w-4 h-4" />
                Гарантированная карта
              </h3>
              <div className="flex items-center gap-3 sm:gap-4">
                <div
                  className="flex-shrink-0 w-16 sm:w-24 rounded-lg overflow-hidden border-2 border-amber-500/50 bg-slate-800 shadow-lg cursor-pointer hover:scale-105 transition-transform"
                  onClick={() => setViewedCard(payloadToCard(banner.guaranteedCardPayload))}
                >
                  <div className="aspect-[2/3] relative">
                    {(() => {
                      const payload = banner.guaranteedCardPayload
                      const imgUrl = payload?.imageUrl || payload?.originalUrl || ""
                      return imgUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={getProxiedSrc(imgUrl)} alt={payload?.characterName || payload?.name || "guaranteed"} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Star className="w-6 h-6 text-slate-600" />
                        </div>
                      )
                    })()}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-white truncate">{banner.guaranteedCardPayload?.characterName || banner.guaranteedCardPayload?.name || "???"}</p>
                  <p className="text-xs text-white/50 mb-2 truncate">{banner.guaranteedCardPayload?.animeName || banner.guaranteedCardPayload?.anime || ""}</p>
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40">
                    <Flame className="w-3 h-3 text-amber-300" />
                    <span className="text-[11px] font-bold text-amber-200">
                      {livePityClaimed
                        ? 'Гарантия получена!'
                        : liveRemainingPity !== undefined
                          ? `Гарантия через ${liveRemainingPity} круток`
                          : `Гарантия через ${banner.guaranteedCardPity} круток`}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* All cards with pagination (standard banners only) */}
          {!isDynamic && allCards.length > 0 && (
            <div>
              <h3 className="text-sm font-black text-purple-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Все карты банера ({allCards.length})
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 sm:gap-3">
                {pagedCards.map(item => (
                  <CardMiniCard key={item.id} item={item} totalWeight={totalWeight} compact onClick={() => setViewedCard(payloadToCard(item.cardPayload))} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-3 mt-4">
                  <button
                    onClick={() => setCardPage(p => Math.max(0, p - 1))}
                    disabled={cardPage === 0}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 border border-white/10 text-white disabled:opacity-30 hover:bg-slate-700 transition-colors"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <span className="text-sm text-white/60 font-bold">
                    {cardPage + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setCardPage(p => Math.min(totalPages - 1, p + 1))}
                    disabled={cardPage >= totalPages - 1}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-800 border border-white/10 text-white disabled:opacity-30 hover:bg-slate-700 transition-colors"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
            </div>
          )}

          {/* No cards fallback (standard banners only) */}
          {!isDynamic && allCards.length === 0 && (
            <div className="text-center py-8 text-white/40">
              <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Карты будут добавлены позже</p>
            </div>
          )}
        </div>
      </div>

      {/* Card Detail View (same as collection) */}
      {viewedCard && (
        <div
          className="fixed inset-0 z-[10000] flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setViewedCard(null)}
        >
          <button
            onClick={() => setViewedCard(null)}
            className="fixed top-4 right-4 sm:top-6 sm:right-6 p-2.5 sm:p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10 z-[10001] shadow-xl backdrop-blur-md"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          <div onClick={(e) => e.stopPropagation()} style={{ touchAction: 'none' }}>
            <InteractiveCard card={viewedCard} />
          </div>
        </div>
      )}
    </div>
  )
}

function CardMiniCard({ item, totalWeight, compact, onClick }: { item: BannerCardItem; totalWeight: number; compact?: boolean; onClick?: () => void }) {
  const payload = item.cardPayload || {}
  const rarity = (payload.rarity as Rarity) || "common"
  const cfg = rarityConfig[rarity]
  const imgUrl = payload.imageUrl || payload.originalUrl || ""
  const dropChance = totalWeight > 0 ? ((item.weight || 0) / totalWeight) * 100 : 0

  if (compact) {
    return (
      <div
        className={`relative rounded-lg overflow-hidden border-2 ${cfg ? `border-${cfg.color.split(" ")[0].replace("from-", "")}/40` : "border-white/20"} bg-slate-800 cursor-pointer hover:scale-105 transition-transform`}
        onClick={onClick}
      >
        <div className="aspect-[2/3] relative">
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={getProxiedSrc(imgUrl)} alt={payload.characterName || payload.name || "card"} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Star className="w-5 h-5 text-slate-600" />
            </div>
          )}
          <div className={`absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r ${cfg?.color || "from-slate-500 to-slate-700"}`} />
          {item.isFeatured && (
            <div className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-pink-500/80 backdrop-blur-sm">
              <Star className="w-3 h-3 text-white fill-white" />
            </div>
          )}
        </div>
        <div className="p-1.5">
          <p className="text-[10px] font-bold text-white/80 truncate">{payload.characterName || payload.name || "???"}</p>
          <p className="text-[9px] text-white/40 truncate">{payload.animeName || payload.anime || ""}</p>
          <p className="text-[10px] font-black text-white tabular-nums mt-0.5">{dropChance.toFixed(1)}%</p>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`flex-shrink-0 w-20 sm:w-32 rounded-xl overflow-hidden border-2 ${cfg ? `border-${cfg.color.split(" ")[0].replace("from-", "")}/50` : "border-white/20"} bg-slate-800 shadow-lg cursor-pointer hover:scale-105 transition-transform`}
      onClick={onClick}
    >
      <div className="aspect-[2/3] relative">
        {imgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={getProxiedSrc(imgUrl)} alt={payload.characterName || payload.name || "card"} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Star className="w-6 h-6 text-slate-600" />
          </div>
        )}
        <div className={`absolute bottom-0 left-0 right-0 h-1.5 bg-gradient-to-r ${cfg?.color || "from-slate-500 to-slate-700"}`} />
        {item.isFeatured && (
          <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-pink-500/80 backdrop-blur-sm flex items-center gap-1">
            <Star className="w-2.5 h-2.5 text-white fill-white" />
            <span className="text-[8px] font-black text-white uppercase">Топ</span>
          </div>
        )}
      </div>
      <div className="p-1.5 sm:p-2">
        <p className="text-[11px] sm:text-xs font-bold text-white/90 truncate">{payload.characterName || payload.name || "???"}</p>
        <p className="text-[9px] sm:text-[10px] text-white/40 truncate">{payload.animeName || payload.anime || ""}</p>
        <div className="flex items-center justify-between mt-1">
          <span className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wide bg-gradient-to-r ${cfg?.color || "from-slate-500 to-slate-700"} bg-clip-text text-transparent`}>
            {cfg?.label || rarity}
          </span>
          <span className="text-[11px] sm:text-xs font-black text-white tabular-nums">{dropChance.toFixed(1)}%</span>
        </div>
      </div>
    </div>
  )
}
