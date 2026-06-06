"use client"

import { useCallback, useEffect, useState, useRef, useMemo } from "react"
import Image from "next/image"
import { Loader2, ShoppingCart, XCircle, Store, RefreshCcw, ZoomIn, ExternalLink, X, Trash, Crown, Star, Filter, ChevronDown, Search, Swords } from "lucide-react"
import type { Card } from "@/app/gacha/page"
import { rarityConfig, type Rarity } from "@/types/gacha"
import { useAuth } from "@/components/auth/auth-provider"
import { supabase } from "@/lib/supabase"
import { frameNames, coatingNames, FrameOverlay, CoatingOverlay } from "@/components/gacha/card-modifiers"
import { getCardBasePower, getCardProvision } from "@/app/battle/utils"

type MarketListingApi = {
  listingId: string
  price: number
  minPriceAtList: number
  isMine: boolean
  card: Omit<Card, "id" | "orderIndex"> & { uniqueId: string }
}

type MarketFilters = {
  search: string
  rarity: Rarity[]
  minPrice: number
  maxPrice: number
  minScore: number
  minPower: number
  maxWeight: number
  anime: string
  isMainCharacter: boolean | null
}

const isPinterestUrl = (url: string) => url.includes('i.pinimg.com') || url.includes('pinimg.com');
const getProxiedSrc = (url: string) => {
  if (!url) return url;
  if (isPinterestUrl(url)) return `/api/image-proxy?url=${encodeURIComponent(url)}`;
  return url;
};

function getTopStat(stats: { hp: number; atk: number; def: number; spd: number; luck: number }): {
  key: keyof typeof statLabels
  label: string
  value: number
} {
  const entries: Array<[keyof typeof statLabels, number]> = [
    ["hp", stats.hp],
    ["atk", stats.atk],
    ["def", stats.def],
    ["spd", stats.spd],
    ["luck", stats.luck],
  ]
  let best = entries[0]
  for (const e of entries) {
    if (e[1] > best[1]) best = e
  }
  return { key: best[0], label: statLabels[best[0]], value: best[1] }
}

const getOptimizedThumbSrc = (url: string, width: number = 384, quality: number = 60) => {
  if (!url) return url
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`
}

const handleListingImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, card: MarketListingApi["card"]) => {
  const target = e.target as HTMLImageElement
  target.srcset = ""
  if (!target.dataset.triedOriginal && card.originalUrl) {
    target.dataset.triedOriginal = "true"
    target.src = card.originalUrl.split("?")[0]
    return
  }
  if (!target.dataset.triedShiki) {
    target.dataset.triedShiki = "true"
    target.src = `https://shikimori.one/system/characters/original/${card.characterId}.jpg`
  }
}

const StatBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="w-full space-y-1">
    <div className="flex justify-between text-[10px] sm:text-xs font-black uppercase tracking-widest text-white/70">
      <span>{label}</span>
      <span>{value}</span>
    </div>
    <div className="h-2 sm:h-2.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
      <div className={`h-full bg-gradient-to-r ${color} transition-all duration-1000 relative`} style={{ width: `${value}%` }}>
        <div className="absolute inset-0 bg-white/20 w-full h-full" style={{ mixBlendMode: 'overlay' }} />
      </div>
    </div>
  </div>
)

const statLabels = { hp: "Очки Здоровья", atk: "Сила Атаки", def: "Защита", spd: "Скорость", luck: "Удача" } as const

const InteractiveCard = ({ card, forceFlipped = false }: { card: MarketListingApi["card"], forceFlipped?: boolean }) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const[isTouching, setIsTouching] = useState(false)
  const animationFrameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    setIsFlipped(forceFlipped)
  }, [forceFlipped])

  // Handle page visibility change to reset animation state when tab is switched/minimized
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Tab is hidden - cancel any pending animation frames and reset state
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current)
          animationFrameRef.current = undefined
        }
        setRotation({ x: 0, y: 0 })
        setIsHovered(false)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  // Cleanup animation frame on unmount
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = undefined
      }
    }
  }, [])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)

    animationFrameRef.current = requestAnimationFrame(() => {
      const rect = cardRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      setRotation({
        x: ((y - centerY) / centerY) * -12,
        y: ((x - centerX) / centerX) * 12
      })
      setIsHovered(true)
    })
  },[])

  const handleMouseLeave = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = requestAnimationFrame(() => {
      setRotation({ x: 0, y: 0 })
      setIsHovered(false)
    })
  },[])

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    setIsTouching(true)
  },[])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!cardRef.current || !isTouching) return
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)

    animationFrameRef.current = requestAnimationFrame(() => {
      const rect = cardRef.current?.getBoundingClientRect()
      if (!rect) return
      const touch = e.touches[0]
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      setRotation({
        x: ((y - centerY) / centerY) * -12,
        y: ((x - centerX) / centerX) * 12
      })
      setIsHovered(true)
    })
  }, [isTouching])

  const handleTouchEnd = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = requestAnimationFrame(() => {
      setRotation({ x: 0, y: 0 })
      setIsHovered(false)
      setIsTouching(false)
    })
  },[])

  const highlightX = -rotation.y * 1.2; 
  const highlightY = rotation.x * 1.2;

  return (
    <div 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => setIsFlipped(!isFlipped)}
      className="relative w-64 sm:w-72 md:w-80 h-[400px] sm:h-[440px] md:h-[480px] max-w-[calc(100vw-2rem)] transition-transform duration-500 ease-out cursor-pointer"
      style={{
        transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y + (isFlipped ? 180 : 0)}deg)`,
        transformStyle: "preserve-3d",
        touchAction: isTouching ? 'none' : 'auto'
      }}
    >
      {/* FRONT SIDE */}
      <div 
        className={`absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] overflow-hidden ${rarityConfig[card.rarity].bg} ${rarityConfig[card.rarity].glow} border-2 border-white/10`}
        style={{ backfaceVisibility: "hidden" }}
      >
        <Image 
          src={getProxiedSrc(card.imageUrl)} 
          alt={card.name}
          unoptimized={true}
          className="absolute inset-0 w-full h-full object-cover scale-[1.02]"
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 40vw"
          quality={80}
          priority={true}
          referrerPolicy="no-referrer"
          onError={(e) => handleListingImageError(e, card)}
        />

        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/20 pointer-events-none" />

        {/* Modifier Overlays */}
        <CoatingOverlay coating={card.coatingModifier} />
        <FrameOverlay frame={card.frameModifier} />

        {/* Hover highlight effect */}
        <div 
          className="absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none"
          style={{ 
            background: `radial-gradient(circle at ${50 + highlightX}% ${50 + highlightY}%, rgba(255,255,255,0.15) 0%, transparent 50%)`,
            opacity: isHovered ? 1 : 0 
          }}
        />
        
        {/* UI элементов - FRONT */}
        <div className="absolute top-3 sm:top-4 md:top-5 inset-x-3 sm:inset-x-4 md:inset-x-5 flex justify-between items-start pointer-events-none z-10">
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <div className={`px-2.5 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest backdrop-blur-md bg-black/40 border border-white/20 shadow-xl`}>
              <span className={`bg-gradient-to-r ${rarityConfig[card.rarity].color} bg-clip-text text-transparent`}>
                {rarityConfig[card.rarity].label}
              </span>
            </div>
            {card.isMainCharacter && (
              <div className="w-fit flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-yellow-400 to-amber-500 text-amber-950 shadow-lg border border-yellow-300">
                <Crown className="w-2.5 sm:w-3 h-2.5 sm:h-3" />
                Главный герой
              </div>
            )}
            {card.frameModifier && (
              <div className="w-fit flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-yellow-600 to-yellow-400 text-yellow-950 shadow-lg border border-yellow-300">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-yellow-200"></span>
                {frameNames[card.frameModifier]}
              </div>
            )}
            {card.coatingModifier && (
              <div className="w-fit flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-cyan-600 to-cyan-400 text-cyan-950 shadow-lg border border-cyan-300">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-cyan-200"></span>
                {coatingNames[card.coatingModifier]}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md px-2.5 sm:px-3 py-1 rounded-full border border-white/20 shadow-xl">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-[10px] sm:text-[11px] font-black text-white">{card.score.toFixed(1)}</span>
          </div>
        </div>
        
        <div className="absolute bottom-3 sm:bottom-4 md:bottom-5 inset-x-3 sm:inset-x-4 md:inset-x-5 pointer-events-none z-10">
          <div className="backdrop-blur-xl bg-slate-900/40 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-2xl relative overflow-hidden">
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${rarityConfig[card.rarity].color}`} />
            
            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white uppercase leading-none drop-shadow-lg truncate mb-1">
              {card.name}
            </h3>
            <p className="text-[9px] sm:text-[10px] md:text-xs text-white/70 font-bold uppercase tracking-wider truncate">
              {card.anime}
            </p>
            
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2">
              <span className="text-[8px] sm:text-[9px] font-mono text-white/40 tracking-wider">ID: {card.uniqueId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* BACK SIDE (STATS) */}
      <div
        className={`absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] p-5 sm:p-6 md:p-8 flex flex-col justify-between border-[3px] sm:border-4 ${rarityConfig[card.rarity].bg} ${rarityConfig[card.rarity].glow}`}
        style={{
          backfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          borderColor: `rgba(${rarityConfig[card.rarity].rgb}, 0.5)`
        }}
      >
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 md:top-5 md:right-5 flex items-center gap-1.5 z-20">
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">вес</span>
          <span className="text-sm sm:text-base font-black text-violet-400">{getCardProvision(card)}</span>
        </div>

        <div className={`absolute inset-0 opacity-10 ${rarityConfig[card.rarity].fx}`} />

        <div className="relative z-10 space-y-4 sm:space-y-6">
          <div className="text-center pb-3 sm:pb-4 border-b border-white/10">
            <p className={`text-[9px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-widest bg-gradient-to-r ${rarityConfig[card.rarity].color} bg-clip-text text-transparent mb-1`}>
              Характеристики
            </p>
            <h4 className="text-xl sm:text-2xl md:text-3xl font-black text-white uppercase truncate">{card.name}</h4>
          </div>

          <div className="space-y-3 sm:space-y-4 pt-2">
            <StatBar label={statLabels.hp} value={card.stats.hp} color={rarityConfig[card.rarity].color} />
            <StatBar label={statLabels.atk} value={card.stats.atk} color={rarityConfig[card.rarity].color} />
            <StatBar label={statLabels.def} value={card.stats.def} color={rarityConfig[card.rarity].color} />
            <StatBar label={statLabels.spd} value={card.stats.spd} color={rarityConfig[card.rarity].color} />
            <StatBar label={statLabels.luck} value={card.stats.luck} color={rarityConfig[card.rarity].color} />
          </div>
        </div>

        <div className="relative z-10 text-center space-y-3">
          <div className="flex items-center justify-center gap-2">
            <Swords className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Общая сила</span>
            <span className="text-sm sm:text-base font-black text-amber-300">{getCardBasePower(card)}</span>
          </div>
          <div className="w-12 sm:w-14 h-12 sm:h-14 mx-auto rounded-full border-2 border-white/10 flex items-center justify-center bg-white/5 backdrop-blur-sm shadow-xl">
             <RefreshCcw className="w-5 sm:w-6 h-5 sm:h-6 text-white/40" />
          </div>
          <p className="text-[8px] sm:text-[9px] font-black text-white/40 uppercase tracking-widest leading-tight">Нажмите чтобы перевернуть</p>
        </div>
      </div>
    </div>
  )
}

export function GachaMarketPanel({
  onTradeComplete,
  onNotify,
}: {
  onTradeComplete: () => Promise<void>
  onNotify: (title: string, message: string, type?: "error" | "info" | "warning") => void
}) {
  const { user, session } = useAuth()
  const [tab, setTab] = useState<"vitrine" | "mine">("vitrine")
  const [listings, setListings] = useState<MarketListingApi[]>([])
  const [loading, setLoading] = useState(true)
  const [actionId, setActionId] = useState<string | null>(null)
  const [viewedCard, setViewedCard] = useState<MarketListingApi | null>(null)
  const [buyPreview, setBuyPreview] = useState<{ listing: MarketListingApi } | null>(null)
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<MarketFilters>({
    search: "",
    rarity: [],
    minPrice: 0,
    maxPrice: 10000000,
    minScore: 0,
    minPower: 0,
    maxWeight: 15,
    anime: "",
    isMainCharacter: null
  })
  const [animeList, setAnimeList] = useState<string[]>([])

  const authHeader = useCallback(() => {
    if (!session?.access_token) return null
    return { Authorization: `Bearer ${session.access_token}` }
  }, [session])

  const filteredListings = useMemo(() => {
    return listings.filter(listing => {
      const card = listing.card

      // Search filter
      if (filters.search && !card.name.toLowerCase().includes(filters.search.toLowerCase()) &&
          !card.anime.toLowerCase().includes(filters.search.toLowerCase())) {
        return false
      }

      // Rarity filter
      if (filters.rarity.length > 0 && !filters.rarity.includes(card.rarity)) {
        return false
      }

      // Price filter
      if (listing.price < filters.minPrice || listing.price > filters.maxPrice) {
        return false
      }

      // Score filter
      if (card.score < filters.minScore) {
        return false
      }

      // Power filter
      if (getCardBasePower(card) < filters.minPower) {
        return false
      }

      // Weight filter
      if (getCardProvision(card) > filters.maxWeight) {
        return false
      }

      // Anime filter
      if (filters.anime && card.anime !== filters.anime) {
        return false
      }

      // Main character filter
      if (filters.isMainCharacter !== null && card.isMainCharacter !== filters.isMainCharacter) {
        return false
      }

      return true
    })
  }, [listings, filters])

  // Extract unique anime list from listings
  useEffect(() => {
    const uniqueAnime = Array.from(new Set(listings.map(l => l.card.anime))).sort()
    setAnimeList(uniqueAnime)
  }, [listings])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const headers = authHeader()
      const mine = tab === "mine"
      const url = `/api/market/listings?mine=${mine ? "1" : "0"}&limit=80`
      const res = await fetch(url, {
        headers: headers ?? {},
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Ошибка загрузки")
      }
      setListings(data.listings || [])
    } catch (e) {
      console.error(e)
      onNotify("Маркет", e instanceof Error ? e.message : "Не удалось загрузить лоты", "error")
      setListings([])
    } finally {
      setLoading(false)
    }
  }, [authHeader, onNotify, tab])

  useEffect(() => {
    void load()
  }, [load])

  const resetFilters = () => {
    setFilters({
      search: "",
      rarity: [],
      minPrice: 0,
      maxPrice: 10000000,
      minScore: 0,
      minPower: 0,
      maxWeight: 15,
      anime: "",
      isMainCharacter: null
    })
  }

  const toggleRarity = (rarity: Rarity) => {
    setFilters(prev => ({
      ...prev,
      rarity: prev.rarity.includes(rarity) 
        ? prev.rarity.filter(r => r !== rarity)
        : [...prev.rarity, rarity]
    }))
  }

  const hasActiveFilters = filters.search ||
    filters.rarity.length > 0 ||
    filters.minPrice > 0 ||
    filters.maxPrice < 10000000 ||
    filters.minScore > 0 ||
    filters.minPower > 0 ||
    filters.maxWeight < 15 ||
    filters.anime ||
    filters.isMainCharacter !== null

  const buy = async (listingId: string, price: number, name: string) => {
    if (!user) {
      onNotify("Маркет", "Войдите в аккаунт, чтобы покупать карты.", "warning")
      return
    }

    setActionId(listingId)
    try {
      const headers = authHeader()
      if (!headers) {
        onNotify("Маркет", "Сессия недоступна", "error")
        return
      }
      const res = await fetch("/api/market/buy", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error === "insufficient_coins") {
          onNotify(
            "Недостаточно монет",
            `Нужно ${data.need?.toLocaleString?.() ?? "—"}, у вас ${data.have?.toLocaleString?.() ?? "—"}.`,
            "warning"
          )
          return
        }
        throw new Error(data.error || "Покупка не удалась")
      }
      onNotify("Маркет", "Карта добавлена в коллекцию.", "info")
      void onTradeComplete()
      void load()
    } catch (e) {
      onNotify("Маркет", e instanceof Error ? e.message : "Ошибка покупки", "error")
    } finally {
      setActionId(null)
    }
  }

  const buyWithPreview = async (listing: MarketListingApi) => {
    setBuyPreview({ listing })
  }

  const confirmBuy = async () => {
    if (!buyPreview) return
    await buy(buyPreview.listing.listingId, buyPreview.listing.price, buyPreview.listing.card.name)
    setBuyPreview(null)
  }

  const cancel = async (listingId: string, name: string) => {
    if (!confirm(`Снять с продажи «${name}»? Карта вернётся в коллекцию.`)) return
    setActionId(listingId)
    try {
      const headers = authHeader()
      if (!headers) {
        onNotify("Маркет", "Сессия недоступна", "error")
        return
      }
      const res = await fetch("/api/market/cancel", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      })
      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Не удалось снять лот")
      }
      onNotify("Маркет", "Лот снят, карта снова у вас в коллекции.", "info")
      void onTradeComplete()
      void load()
    } catch (e) {
      onNotify("Маркет", e instanceof Error ? e.message : "Ошибка", "error")
    } finally {
      setActionId(null)
    }
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Store className="w-7 h-7 sm:w-8 sm:h-8 text-cyan-400" />
          <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white">
            Маркет карт
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setTab("vitrine")}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
              tab === "vitrine"
                ? "bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-500/20"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Витрина
          </button>
          <button
            type="button"
            onClick={() => setTab("mine")}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all ${
              tab === "mine"
                ? "bg-violet-600 border-violet-500 text-white shadow-lg shadow-violet-500/20"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            Мои лоты
          </button>
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border transition-all flex items-center gap-2 ${
              showFilters || hasActiveFilters
                ? "bg-amber-600 border-amber-500 text-white shadow-lg shadow-amber-500/20"
                : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
            }`}
          >
            <Filter className="w-4 h-4" />
            Фильтры
            {hasActiveFilters && (
              <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
            )}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold bg-slate-800 border border-slate-700 text-slate-200 hover:bg-slate-700 disabled:opacity-50"
          >
            <RefreshCcw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Обновить
          </button>
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-slate-900/50 border border-slate-700 rounded-2xl p-6 space-y-6 animate-in slide-in-from-top duration-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-black text-white uppercase">Фильтры</h3>
            {hasActiveFilters && (
              <button
                onClick={resetFilters}
                className="text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
              >
                Сбросить все
              </button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Search */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Поиск</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Название карты или аниме..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-10 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
            </div>

            {/* Price Range */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Диапазон цен</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Мин"
                  value={filters.minPrice || ""}
                  onChange={(e) => setFilters(prev => ({ ...prev, minPrice: parseInt(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
                <span className="text-slate-400">—</span>
                <input
                  type="number"
                  placeholder="Макс"
                  value={filters.maxPrice < 10000000 ? filters.maxPrice : ""}
                  onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: parseInt(e.target.value) || 10000000 }))}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>
            </div>

            {/* Min Score */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Мин. рейтинг ★</label>
              <input
                type="number"
                placeholder="0"
                min="0"
                max="10"
                step="0.1"
                value={filters.minScore || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, minScore: parseFloat(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>

            {/* Min Power */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Мин. сила</label>
              <input
                type="number"
                placeholder="0"
                min="0"
                value={filters.minPower || ""}
                onChange={(e) => setFilters(prev => ({ ...prev, minPower: parseInt(e.target.value) || 0 }))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>

            {/* Max Weight */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Макс. вес</label>
              <input
                type="number"
                placeholder="15"
                min="0"
                max="15"
                value={filters.maxWeight < 15 ? filters.maxWeight : ""}
                onChange={(e) => setFilters(prev => ({ ...prev, maxWeight: parseInt(e.target.value) || 15 }))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              />
            </div>

            {/* Anime Filter */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Аниме</label>
              <select
                value={filters.anime}
                onChange={(e) => setFilters(prev => ({ ...prev, anime: e.target.value }))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                <option value="">Все аниме</option>
                {animeList.map(anime => (
                  <option key={anime} value={anime}>{anime}</option>
                ))}
              </select>
            </div>

            {/* Main Character Filter */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Главный герой</label>
              <select
                value={filters.isMainCharacter === null ? "" : filters.isMainCharacter.toString()}
                onChange={(e) => setFilters(prev => ({ 
                  ...prev, 
                  isMainCharacter: e.target.value === "" ? null : e.target.value === "true"
                }))}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
              >
                <option value="">Все карты</option>
                <option value="true">Только главные герои</option>
                <option value="false">Без главных героев</option>
              </select>
            </div>
          </div>

          {/* Rarity Filter */}
          <div className="space-y-3">
            <label className="text-xs font-black text-slate-500 uppercase tracking-wider">Редкость</label>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(rarityConfig) as Rarity[]).map(rarity => (
                <button
                  key={rarity}
                  onClick={() => toggleRarity(rarity)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black border transition-all ${
                    filters.rarity.includes(rarity)
                      ? `bg-gradient-to-r ${rarityConfig[rarity].color} text-white border-transparent`
                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                  }`}
                >
                  {rarityConfig[rarity].label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {!user && tab === "vitrine" && (
        <p className="text-sm text-slate-400">
          Войдите в аккаунт, чтобы покупать. Просмотр витрины доступен всем.
        </p>
      )}
      {tab === "mine" && !user && (
        <p className="text-sm text-amber-300/90">Войдите, чтобы видеть свои лоты.</p>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
        </div>
      ) : filteredListings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-slate-800 rounded-3xl bg-slate-900/30">
          <ShoppingCart className="w-10 h-10 text-slate-600 mb-3" />
          <p className="text-slate-400 font-bold mb-2">
            {hasActiveFilters ? "Ничего не найдено по выбранным фильтрам" : 
             (tab === "mine" ? "Нет активных лотов" : "Пока никто ничего не продаёт")}
          </p>
          {hasActiveFilters && (
            <button
              onClick={resetFilters}
              className="text-sm text-amber-400 hover:text-amber-300 font-bold transition-colors"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <>
          {hasActiveFilters && (
            <div className="flex items-center justify-between text-sm text-slate-400 mb-4">
              <span>Найдено: {filteredListings.length} из {listings.length} лотов</span>
              <button
                onClick={resetFilters}
                className="text-amber-400 hover:text-amber-300 font-bold transition-colors"
              >
                Сбросить фильтры
              </button>
            </div>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
            {filteredListings.map((L) => {
            const c = L.card
            const busy = actionId === L.listingId
            const topStat = getTopStat(c.stats)
            return (
              <div
                key={L.listingId}
                className={`group rounded-2xl overflow-hidden border bg-slate-900/90 relative flex flex-col transition-transform duration-200 hover:-translate-y-0.5 ${rarityConfig[c.rarity].glow}`}
                style={{
                  borderColor: `rgba(${rarityConfig[c.rarity].rgb}, 0.35)`,
                  boxShadow: `0 0 0 1px rgba(${rarityConfig[c.rarity].rgb}, 0.12), 0 12px 40px rgba(0,0,0,0.55), 0 0 32px rgba(${rarityConfig[c.rarity].rgb}, 0.18)`,
                }}
              >
                <div className="aspect-[2/3] relative w-full cursor-pointer" onClick={() => setViewedCard(L)}>
                  <Image
                    src={getProxiedSrc(c.imageUrl)}
                    alt={c.name}
                    fill
                    unoptimized={isPinterestUrl(c.imageUrl)}
                    className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                    sizes="(max-width: 640px) 45vw, 18vw"
                    quality={50}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={(e) => handleListingImageError(e, c)}
                  />
                 
                  <div
                    className="absolute inset-x-0 top-0 h-1.5"
                    style={{
                      background: `linear-gradient(90deg, rgba(${rarityConfig[c.rarity].rgb},0.0) 0%, rgba(${rarityConfig[c.rarity].rgb},0.85) 50%, rgba(${rarityConfig[c.rarity].rgb},0.0) 100%)`,
                    }}
                  />
                  <div
                    className={`absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-black/60 border border-white/10 text-white`}
                  >
                    {rarityConfig[c.rarity].label}
                  </div>
                  {(c.frameModifier || c.coatingModifier) && (
                    <div className="absolute bottom-2 left-2 flex flex-col gap-1">
                      {c.frameModifier && (
                        <div className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-yellow-600/90 text-yellow-950 border border-yellow-400">
                          🖼️ {frameNames[c.frameModifier]}
                        </div>
                      )}
                      {c.coatingModifier && (
                        <div className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-cyan-600/90 text-cyan-950 border border-cyan-400">
                          ✨ {coatingNames[c.coatingModifier]}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <p className="text-[10px] sm:text-xs font-bold text-slate-300 uppercase truncate mb-0.5">★{c.score.toFixed(1)} {c.anime}</p>
                  <p className="text-sm font-black text-white truncate leading-tight">{c.name}</p>
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="text-slate-400 font-bold uppercase">Сила:</span>
                    <span className="text-amber-300 font-black">{getCardBasePower(c)}</span>
                    <span className="text-slate-500">|</span>
                    <span className="text-slate-400 font-bold uppercase">Вес:</span>
                    <span className="text-violet-400 font-black">{getCardProvision(c)}</span>
                  </div>
                  <div
                    className="inline-flex items-center gap-2 w-fit px-2.5 py-1 rounded-full text-[11px] font-black border"
                    style={{
                      borderColor: `rgba(${rarityConfig[c.rarity].rgb}, 0.35)`,
                      background: `rgba(${rarityConfig[c.rarity].rgb}, 0.08)`,
                    }}
                    title={`Самый высокий стат: ${topStat.label}`}
                  >
                    <span className="text-slate-200/90">{topStat.key.toUpperCase()}</span>
                    <span
                      className="font-black"
                      style={{
                        color: `rgba(${rarityConfig[c.rarity].rgb}, 0.95)`,
                        textShadow: `0 0 14px rgba(${rarityConfig[c.rarity].rgb}, 0.25)`,
                      }}
                    >
                      {topStat.value}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-yellow-400 font-black text-lg">
                    {L.price.toLocaleString()}
                    <span className="text-[10px] text-yellow-200/80 font-bold">монет</span>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    Защитный минимум: {L.minPriceAtList.toLocaleString()}
                  </p>
                  <div className="mt-auto pt-1 flex flex-col gap-2">
                    {tab === "vitrine" && !L.isMine && user && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void buyWithPreview(L)}
                        className="w-full py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black uppercase disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
                        Купить
                      </button>
                    )}
                    {tab === "vitrine" && L.isMine && (
                      <span className="text-center text-[10px] text-violet-300 font-bold py-2">
                        Ваш лот
                      </span>
                    )}
                    {tab === "mine" && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void cancel(L.listingId, c.name)}
                        className="w-full py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 text-xs font-black uppercase border border-red-500/30 disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                        Снять
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
        </>
      )}

      {/* Viewed Card Modal */}
      {viewedCard && (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setViewedCard(null)}
        >
          <button onClick={() => setViewedCard(null)} className="absolute top-4 sm:top-6 right-4 sm:right-6 p-2.5 sm:p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10 z-50">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          
          <div 
            className="flex flex-col items-center justify-center min-h-full py-12"
            onClick={(e) => e.stopPropagation()}
          >
            <InteractiveCard card={viewedCard.card} />
            
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-8 sm:mt-10 w-full max-w-lg mx-auto">
              {tab === "vitrine" && !viewedCard.isMine && user && (
                <button
                  onClick={() => {
                    setViewedCard(null)
                    buyWithPreview(viewedCard)
                  }}
                  className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" /> <span className="hidden sm:inline">Купить</span><span className="sm:hidden">Купить</span>
                </button>
              )}
              
              {tab === "vitrine" && viewedCard.isMine && (
                <span className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-violet-600/20 text-violet-300 font-bold text-xs sm:text-sm flex items-center gap-2 border border-violet-500/30">
                  <Store className="w-4 h-4" /> <span className="hidden sm:inline">Ваш лот</span><span className="sm:hidden">Ваш</span>
                </span>
              )}
              
              {tab === "mine" && (
                <button
                  onClick={() => {
                    setViewedCard(null)
                    cancel(viewedCard.listingId, viewedCard.card.name)
                  }}
                  className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors border border-red-500/30"
                >
                  <XCircle className="w-4 h-4" /> <span className="hidden sm:inline">Снять с продажи</span><span className="sm:hidden">Снять</span>
                </button>
              )}
              
              <a href={viewedCard.card.originalUrl} target="_blank" rel="noreferrer" className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors border border-slate-700">
                <ZoomIn className="w-4 h-4" /> <span className="hidden sm:inline">Оригинал</span>
              </a>
              
              <a href={`https://shikimori.one/animes/${viewedCard.card.shikiId}`} target="_blank" rel="noreferrer" className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors border border-blue-500/20">
                <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">Шикимори</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Buy Preview Modal */}
      {buyPreview && (
        <div 
          className="fixed inset-0 z-50 flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setBuyPreview(null)}
          onTouchEnd={(e) => {
            // Check if touch ended on the backdrop (not on modal content)
            if (e.target === e.currentTarget) {
              setBuyPreview(null)
            }
          }}
        >
          <button 
            onClick={() => setBuyPreview(null)} 
            className="absolute top-4 sm:top-6 right-4 sm:right-6 p-3 sm:p-4 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10 z-50 touch-manipulation"
            aria-label="Закрыть"
          >
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          
          <div 
            className="flex flex-col items-center justify-center min-h-full py-12"
            onClick={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-6">
              <h3 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tight mb-2">
                Подтверждение покупки
              </h3>
              <p className="text-slate-300 text-sm">
                Вы уверены, что хотите купить эту карту?
              </p>
            </div>

            <InteractiveCard card={buyPreview.listing.card} />
            
            <div className="mt-8 text-center space-y-4">
              <div className="flex items-center justify-center gap-3 text-2xl sm:text-3xl font-black text-yellow-400">
                <ShoppingCart className="w-8 h-8" />
                <span>{buyPreview.listing.price.toLocaleString()}</span>
                <span className="text-sm sm:text-base text-yellow-200/80 font-bold">монет</span>
              </div>
              
              <p className="text-xs sm:text-sm text-slate-400">
                Защитный минимум: {buyPreview.listing.minPriceAtList.toLocaleString()} монет
              </p>
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-8 sm:mt-10 w-full max-w-lg mx-auto">
              <button
                onClick={confirmBuy}
                disabled={actionId === buyPreview.listing.listingId}
                className="px-6 py-3 sm:px-8 sm:py-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-sm sm:text-base flex items-center gap-2 transition-colors disabled:opacity-50"
              >
                {actionId === buyPreview.listing.listingId ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Покупка...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5" />
                    Подтвердить покупку
                  </>
                )}
              </button>
              
              <button
                onClick={() => setBuyPreview(null)}
                className="px-6 py-3 sm:px-8 sm:py-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm sm:text-base flex items-center gap-2 transition-colors border border-slate-700 touch-manipulation min-h-[44px]"
              >
                <X className="w-5 h-5" />
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
