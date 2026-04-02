"use client"

import { useState, useRef, MouseEvent, useCallback, useEffect, useMemo } from "react"
import { flushSync } from "react-dom"
import Image from "next/image"
import { Navbar } from "@/components/navbar"
import { Sparkles, Star, Heart, Loader2, X, ZoomIn, ExternalLink, RefreshCcw, Trash, Trash2, Crown, Package, Coins, Search, Database, Store } from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { rollAnimeCharacter, rollFromAnimePack, searchGachaPacks, createCustomGachaPack, checkPackAvailability, updateUserPityAfterRoll } from "./actions"
import { saveCardToDatabase, loadUserCards, deleteCardFromDatabase, queueCardForSync, syncQueuedCards } from "./client-actions"
import { loadUserPity, updateUserPity, type PityData } from "./pity-actions"
import { ANIME_PACKS, AnimePack, CustomAnimePack, createCustomPack, loadYearBasedPacks } from "@/lib/gacha-packs"
import { useCoins } from "@/hooks/use-coins"
import { useDust } from "@/hooks/use-dust"
import { GachaLoading } from "@/components/gacha-loading"
import { CollectionCardSkeleton } from "@/components/collection-skeleton"
import { PackCardSkeleton } from "@/components/pack-skeleton"
import { GachaErrorPopup } from "@/components/gacha-error-popup"
import { DismantleConfirmPopup } from "@/components/dismantle-confirm-popup"
import { DismantleSuccessPopup } from "@/components/dismantle-success-popup"
import { BulkDismantleFilterPopup } from "@/components/bulk-dismantle-filter-popup"
import { BulkDismantleConfirmPopup } from "@/components/bulk-dismantle-confirm-popup"
import { BulkDismantleSuccessPopup } from "@/components/bulk-dismantle-success-popup"
import { Rarity, rarityConfig, getDismantleValue } from "@/types/gacha"
import { GachaMarketPanel } from "@/components/gacha-market-panel"
import { GachaSellMarketModal } from "@/components/gacha-sell-market-modal"
import { ChangeArtModal } from "@/components/change-art-modal"
import { useAuth } from "@/components/auth-provider"

export interface CardStats {
  hp: number
  atk: number
  def: number
  spd: number
  luck: number
}

export interface Card {
  id: number
  uniqueId: string
  serialId: string
  name: string
  anime: string
  rarity: Rarity
  imageUrl: string
  originalUrl: string
  fallbackUrls?: string[] 
  score: number
  shikiId: number
  characterId: number
  stats: CardStats
  isMainCharacter?: boolean
  packId?: string
  packName?: string
  isArtBlacklisted?: boolean
  orderIndex?: number // Индекс порядка добавления в коллекцию
}

function generateCardUniqueId(characterId: number, packId?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const packPrefix = packId ? `pack-${packId}` : 'random';
  return `${packPrefix}-${characterId}-${timestamp}-${random}`;
}

const RARITY_ORDER =["trash", "common", "uncommon", "rare", "super_rare", "epic", "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"] as const

interface CollectionRating {
  overallScore: number
  grade: string
  gradeColor: string
  totalPower: number
  avgRarity: number
  powerScore: number
  rarityDistribution: Record<Rarity, number>
  topCards: Card[]
  stats: {
    avgHp: number
    avgAtk: number
    avgDef: number
    avgSpd: number
    avgLuck: number
  }
}

function calculateCollectionRating(cards: Card[]): CollectionRating {
  if (cards.length === 0) {
    return {
      overallScore: 0,
      grade: "F",
      gradeColor: "text-stone-400",
      totalPower: 0,
      avgRarity: 0,
      powerScore: 0,
      rarityDistribution: {} as Record<Rarity, number>,
      topCards:[],
      stats: { avgHp: 0, avgAtk: 0, avgDef: 0, avgSpd: 0, avgLuck: 0 }
    }
  }

  const rarityScoreByRarity: Record<Rarity, number> = {
    trash: 0, common: 10, uncommon: 20, rare: 32, super_rare: 45, epic: 60,
    mythic: 72, legendary: 82, ancient: 90, divine: 95, transcendent: 98, omnipotent: 100,
  }

  const rarityDistribution: Record<Rarity, number> = {
    trash: 0, common: 0, uncommon: 0, rare: 0, super_rare: 0, epic: 0,
    mythic: 0, legendary: 0, ancient: 0, divine: 0, transcendent: 0, omnipotent: 0
  }
  
  let totalPower = 0
  let totalStats = { hp: 0, atk: 0, def: 0, spd: 0, luck: 0 }

  cards.forEach(card => {
    rarityDistribution[card.rarity] = (rarityDistribution[card.rarity] || 0) + 1
    const cardPower = card.stats.hp + card.stats.atk + card.stats.def + card.stats.spd + card.stats.luck
    totalPower += cardPower
    totalStats.hp += card.stats.hp
    totalStats.atk += card.stats.atk
    totalStats.def += card.stats.def
    totalStats.spd += card.stats.spd
    totalStats.luck += card.stats.luck
  })

  const numCards = cards.length
  
  const avgStats = {
    avgHp: Math.round(totalStats.hp / numCards),
    avgAtk: Math.round(totalStats.atk / numCards),
    avgDef: Math.round(totalStats.def / numCards),
    avgSpd: Math.round(totalStats.spd / numCards),
    avgLuck: Math.round(totalStats.luck / numCards)
  }
  
  const avgRarity = Math.round(
    cards.reduce((acc, c) => acc + (rarityScoreByRarity[c.rarity] ?? 0), 0) / numCards
  )
  
  const avgPower = totalPower / numCards
  const powerScore = Math.max(0, Math.min(Math.round((avgPower / 500) * 100), 100))
  const overallScore = Math.round((avgRarity * 0.55) + (powerScore * 0.45))
  
  let grade: string, gradeColor: string
  
  if (overallScore >= 90) { grade = "S+"; gradeColor = "from-amber-400 to-orange-500" }
  else if (overallScore >= 80) { grade = "S"; gradeColor = "from-amber-500 to-yellow-500" }
  else if (overallScore >= 70) { grade = "A"; gradeColor = "from-purple-400 to-pink-500" }
  else if (overallScore >= 60) { grade = "B"; gradeColor = "from-blue-400 to-cyan-500" }
  else if (overallScore >= 50) { grade = "C"; gradeColor = "from-emerald-400 to-teal-500" }
  else if (overallScore >= 40) { grade = "D"; gradeColor = "from-slate-400 to-slate-500" }
  else { grade = "F"; gradeColor = "from-stone-500 to-stone-700" }
  
  const topCards = [...cards]
    .sort((a, b) => {
      const aScore = rarityConfig[a.rarity].weight + (a.stats.hp + a.stats.atk + a.stats.def + a.stats.spd + a.stats.luck) * 0.1
      const bScore = rarityConfig[b.rarity].weight + (b.stats.hp + b.stats.atk + b.stats.def + b.stats.spd + b.stats.luck) * 0.1
      return bScore - aScore
    })
    .slice(0, 5)
  
  return { overallScore, grade, gradeColor, totalPower, avgRarity, powerScore, rarityDistribution, topCards, stats: avgStats }
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

const getOptimizedThumbSrc = (url: string, width: number = 384, quality: number = 60) => {
  if (!url) return url;
  return `/_next/image?url=${encodeURIComponent(url)}&w=${width}&q=${quality}`;
}

const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>, card: Card, isCollection: boolean = false) => {
  const target = e.target as HTMLImageElement;
  
  // КРИТИЧЕСКИ ВАЖНО: Очищаем srcset! Иначе Next.js заставляет браузер 
  // бесконечно пытаться загрузить битые ссылки разных размеров из srcset
  target.srcset = "";
  
  if (!target.dataset.triedOriginal && card.originalUrl) {
    target.dataset.triedOriginal = "true";
    const cleanUrl = card.originalUrl.split('?')[0];
    target.src = cleanUrl;
    return;
  }

  if (!target.dataset.triedMirror) {
    target.dataset.triedMirror = "true";
    target.src = `https://shikimori.one/system/characters/original/${card.characterId}.jpg`;
    return;
  }

  if (!target.dataset.triedShikiPng) {
    console.log(`[${card.name}] Попытка Shikimori PNG`);
    target.dataset.triedShikiPng = "true";
    target.src = `https://shikimori.one/system/characters/original/${card.characterId}.png`;
  } else if (!target.dataset.triedShikiWebp) {
    console.log(`[${card.name}] Попытка Shikimori WebP`);
    target.dataset.triedShikiWebp = "true";
    target.src = `https://shikimori.one/system/characters/webp/original/${card.characterId}.webp`;
  } else if (!target.dataset.triedJikan) {
    console.log(`[${card.name}] Попытка Jikan API (MyAnimeList)`);
    target.dataset.triedJikan = "true";
    fetch(`https://api.jikan.moe/v4/characters/${card.characterId}/pictures`)
      .then(res => res.json())
      .then(data => {
        if (data?.data && data.data.length > 0) {
          const pic = data.data.find((p: any) => p.jpg?.image_url) || data.data[0];
          target.src = pic.jpg?.image_url || pic.webp?.image_url;
        } else {
          target.src = 'https://picsum.photos/seed/force-error/1/1';
        }
      })
      .catch(() => {
        target.src = 'https://picsum.photos/seed/force-error/1/1';
      });
  } else if (!target.dataset.triedPlaceholder) {
    console.log(`[${card.name}] Все попытки исчерпаны, используем картинку-заглушку`);
    target.dataset.triedPlaceholder = "true";
    const seed = card.anime.replace(/[^a-z0-9]/gi, '') + card.characterId;
    target.src = `https://picsum.photos/seed/anime-${seed}/${isCollection ? '200/300' : '400/600'}.jpg`;
  } else {
    console.log(`[${card.name}] Картинка-заглушка не загрузилась, показываем UI-заглушку`);
    target.style.display = 'none';
    const containerClass = isCollection ? 'collection-placeholder' : 'image-placeholder';
    const placeholder = target.parentElement?.querySelector(`.${containerClass}`);
    if (!placeholder) {
      const div = document.createElement('div');
      div.className = `${containerClass} absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-white p-2`;
      if (isCollection) {
        div.innerHTML = `
          <div class="text-2xl sm:text-3xl mb-1">🎌</div>
          <div class="text-[10px] sm:text-xs font-bold text-center mt-1 truncate w-full px-2">${card.name}</div>
        `;
      } else {
        div.innerHTML = `
          <div class="text-4xl sm:text-5xl mb-3">🎌</div>
          <div class="text-sm sm:text-base font-bold text-center mb-1 px-4">${card.name}</div>
          <div class="text-xs text-slate-400 text-center px-4">${card.anime}</div>
          <div class="text-[10px] sm:text-xs px-3 py-1 bg-red-500/20 text-red-300 rounded-full mt-3">Арт недоступен</div>
        `;
      }
      target.parentElement?.appendChild(div);
    }
  }
};

const PackCard = ({ pack, onSelect, userCoins }: { pack: AnimePack; onSelect: (pack: AnimePack) => void; userCoins: number }) => (
  <div 
    onClick={() => onSelect(pack)}
    className={`relative group cursor-pointer rounded-2xl sm:rounded-3xl overflow-hidden border border-white/10 p-5 sm:p-6 transition-all duration-300 hover:scale-[1.03] hover:border-indigo-500/50 hover:shadow-2xl hover:shadow-indigo-500/20 ${userCoins < pack.price ? 'opacity-50 cursor-not-allowed grayscale-[0.5]' : ''}`}
    style={{
      backgroundImage: pack.bgImage ? `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.8)), url(${pack.bgImage})` : undefined,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }}
  >
    {!pack.bgImage && (
      <div className={`absolute inset-0 bg-gradient-to-br ${pack.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
    )}
    <div className="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors duration-300" />
    
    <div className="relative z-10 h-full flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 sm:p-2.5 bg-white/10 backdrop-blur-md rounded-xl border border-white/20">
          <Package className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
        </div>
        <div className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10 shadow-lg">
          <Coins className="w-4 h-4 text-yellow-400" />
          <span className="text-sm font-black text-white">{pack.price}</span>
        </div>
      </div>
      
      <div className="mt-auto">
        <h3 className="text-xl sm:text-2xl font-black text-white mb-2 leading-tight">{pack.name}</h3>
        <p className="text-sm text-white/70 mb-4 line-clamp-2">{pack.description}</p>
        
        {pack.guaranteedRarity && (
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-500/20 backdrop-blur-md border border-indigo-500/30">
            <Star className="w-3.5 h-3.5 text-indigo-300" />
            <span className="text-xs font-bold text-indigo-200 tracking-wide uppercase">
              Гарант: {rarityConfig[pack.guaranteedRarity as Rarity].label} <span className="text-indigo-300/70 font-normal">(1 из 10)</span>
            </span>
          </div>
        )}
        
        {userCoins < pack.price && (
          <div className="mt-4 text-xs bg-red-500/20 text-red-300 px-3 py-1.5 rounded-lg border border-red-500/30 font-bold inline-block">Недостаточно монет</div>
        )}
      </div>
    </div>
  </div>
)

const TopCard = ({ card, onClick }: { card: Card; onClick: (card: Card) => void }) => {
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
        onError={(e) => handleImageError(e, card, true)}
        onLoad={() => setIsImageLoading(false)}
      />
      
      {/* Загрузчик для лучших карт */}
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

const CollectionCard = ({ card, onClick }: { card: Card; onClick: (card: Card) => void }) => {
  const [isImageLoading, setIsImageLoading] = useState(true)

  return (
    <div
      onClick={() => onClick(card)}
      className={`aspect-[2/3] rounded-2xl overflow-hidden border border-white/10 relative group bg-slate-900 cursor-pointer transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-indigo-500/20 ${rarityConfig[card.rarity].glow}`}
    >
      <Image
        src={card.imageUrl}
        className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        alt={card.name}
        fill
        sizes="(max-width: 640px) 33vw, (max-width: 1024px) 20vw, 15vw"
        quality={50}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={(e) => handleImageError(e, card, true)}
        onLoad={() => setIsImageLoading(false)}
      />
      
      {/* Загрузчик для карточки коллекции */}
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

const InteractiveCard = ({ card, forceFlipped = false }: { card: Card, forceFlipped?: boolean }) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const[isTouching, setIsTouching] = useState(false)
  const[isImageLoading, setIsImageLoading] = useState(true)
  const animationFrameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    setIsFlipped(forceFlipped)
  }, [forceFlipped])

  useEffect(() => {
    setIsImageLoading(true)
  }, [card.imageUrl])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
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
  },[])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = undefined
      }
    }
  },[])

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
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
      className="relative w-[260px] sm:w-72 md:w-80 h-[380px] sm:h-[440px] md:h-[480px] max-w-[calc(100vw-2rem)] transition-transform duration-500 ease-out cursor-pointer"
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
          src={card.imageUrl} 
          alt={card.name}
          unoptimized={true}
          className="absolute inset-0 w-full h-full object-cover scale-[1.02]"
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 40vw"
          quality={80}
          priority={true}
          referrerPolicy="no-referrer"
          onError={(e) => handleImageError(e, card, false)}
          onLoad={() => setIsImageLoading(false)}
        />
        
        {/* Загрузчик поверх изображения */}
        {isImageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-white/80 animate-spin" />
              <span className="text-xs sm:text-sm text-white/60 font-medium">Загрузка арта...</span>
            </div>
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/20 pointer-events-none" />
        
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
            <div className={`px-2.5 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest backdrop-blur-md bg-black/40 border border-white/20 shadow-xl w-fit`}>
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
          </div>
          <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md px-2.5 sm:px-3 py-1 rounded-full border border-white/20 shadow-xl shrink-0">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-[10px] sm:text-[11px] font-black text-white">{card.score.toFixed(1)}</span>
          </div>
        </div>

        <div className="absolute bottom-3 sm:bottom-4 md:bottom-5 inset-x-3 sm:inset-x-4 md:inset-x-5 pointer-events-none z-10">
          <div className="backdrop-blur-xl bg-slate-900/40 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-2xl relative overflow-hidden">
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${rarityConfig[card.rarity].color}`} />
            
            {card.isMainCharacter && card.isArtBlacklisted && (
              <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 flex items-center gap-1">
                <RefreshCcw className="w-2.5 h-2.5 text-red-400" />
                <span className="text-[7px] sm:text-[8px] font-bold text-red-400 uppercase tracking-wider">Отклонен</span>
              </div>
            )}
            
            <h3 className="text-base sm:text-xl md:text-2xl font-black text-white uppercase leading-none drop-shadow-lg truncate mb-1">
              {card.name}
            </h3>
            <p className="text-[8px] sm:text-[10px] md:text-xs text-white/70 font-bold uppercase tracking-wider truncate">
              {card.anime}
            </p>
            
            <div className="mt-2.5 sm:mt-3 flex items-center justify-between border-t border-white/10 pt-2">
              <span className="text-[7px] sm:text-[8px] md:text-[9px] font-mono text-white/40 tracking-wider">ID: {card.shikiId}</span>
              {card.packName && (
                <span className="text-[7px] sm:text-[8px] md:text-[9px] font-black text-indigo-300 uppercase tracking-widest truncate max-w-[60%] text-right">{card.packName}</span>
              )}
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
                
        <div className="relative z-10 space-y-3 sm:space-y-6">
          <div className="text-center pb-2.5 sm:pb-4 border-b border-white/10">
            <p className={`text-[8px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-widest bg-gradient-to-r ${rarityConfig[card.rarity].color} bg-clip-text text-transparent mb-1`}>
              Характеристики
            </p>
            <h4 className="text-lg sm:text-2xl md:text-3xl font-black text-white uppercase truncate">{card.name}</h4>
          </div>

          <div className="space-y-2.5 sm:space-y-4 pt-1 sm:pt-2">
            <StatBar label={statLabels.hp} value={card.stats.hp} color={rarityConfig[card.rarity].color} />
            <StatBar label={statLabels.atk} value={card.stats.atk} color={rarityConfig[card.rarity].color} />
            <StatBar label={statLabels.def} value={card.stats.def} color={rarityConfig[card.rarity].color} />
            <StatBar label={statLabels.spd} value={card.stats.spd} color={rarityConfig[card.rarity].color} />
            <StatBar label={statLabels.luck} value={card.stats.luck} color={rarityConfig[card.rarity].color} />
          </div>
        </div>

        <div className="relative z-10 text-center space-y-2 sm:space-y-3">
           <div className="w-10 sm:w-14 h-10 sm:h-14 mx-auto rounded-full border-2 border-white/10 flex items-center justify-center bg-white/5 backdrop-blur-sm shadow-xl">
              <RefreshCcw className="w-4 sm:w-6 h-4 sm:h-6 text-white/40" />
           </div>
           <p className="text-[7px] sm:text-[9px] font-black text-white/40 uppercase tracking-widest leading-tight">Нажмите чтобы перевернуть</p>
        </div>
      </div>
    </div>
  )
}

export default function GachaPage() {
  const[isRolling, setIsRolling] = useState(false)
  const[isPackLoading, setIsPackLoading] = useState(true)
  const[isCustomPackLoading, setIsCustomPackLoading] = useState(false)
  const[revealedCard, setRevealedCard] = useState<Card | null>(null)
  const[collectedCards, setCollectedCards] = useState<Card[]>([])
  const[showCard, setShowCard] = useState(false)
  const[viewedCard, setViewedCard] = useState<Card | null>(null)

  const usedCharacterIds = useMemo(() => new Set(collectedCards.map(c => c.characterId)), [collectedCards])
  
  const { user: authUser, sessionLoading } = useAuth()
  const { coins: userCoins, loading: coinsLoading, spendCoins, addCoins, forceSync, fixOverflow, refresh: refreshCoins } = useCoins()
  const { dust, loading: dustLoading, addDust } = useDust()
  const[selectedPack, setSelectedPack] = useState<AnimePack | CustomAnimePack | null>(null)
  const[showPacks, setShowPacks] = useState(false)
  const[packSearchQuery, setPackSearchQuery] = useState("")
  const[searchResults, setSearchResults] = useState<AnimePack[]>([])
  const[isSearching, setIsSearching] = useState(false)
  const[showCustomPackCreator, setShowCustomPackCreator] = useState(false)
  const[customPackQuery, setCustomPackQuery] = useState("")
  const[isCreatingCustomPack, setIsCreatingCustomPack] = useState(false)
  const[createdCustomPack, setCreatedCustomPack] = useState<CustomAnimePack | null>(null)
  const[customPackSearchResults, setCustomPackSearchResults] = useState<Array<{
    id: number
    name: string
    russian: string | null
    score: number | null
    imageUrl: string
  }>>([])
  const[selectedAnimeIds, setSelectedAnimeIds] = useState<Set<number>>(new Set())
  const[blacklistedUrls, setBlacklistedUrls] = useState<string[]>([])
  const[expandPoolForCharacters, setExpandPoolForCharacters] = useState<Set<number>>(new Set())
  const[showArtWarning, setShowArtWarning] = useState(false)
  const[showArtLimitWarning, setShowArtLimitWarning] = useState(false)
  const[cardForArtLimitWarning, setCardForArtLimitWarning] = useState<Card | null>(null)
  const[isFixingCoins, setIsFixingCoins] = useState(false)
  const[isSavingCard, setIsSavingCard] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const[displayedCardsCount, setDisplayedCardsCount] = useState(60)
  const[isSyncingCards, setIsSyncingCards] = useState(false)
  const[pendingSyncCount, setPendingSyncCount] = useState(0)
  const[prioritizeMainCharacters, setPrioritizeMainCharacters] = useState(false)
  const[pityData, setPityData] = useState<PityData | null>(null)

  // Ref for tracking operation start time
  const operationStartTime = useRef<number | null>(null);

  const ART_BAN_LIMIT = 10

  const bannedArtsByCharacter = useMemo(() => {
    const acc: Record<number, number> = {};
    blacklistedUrls.forEach(url => {
      const card = collectedCards.find(c => c.imageUrl === url || c.originalUrl === url);
      if (card) {
        acc[card.characterId] = (acc[card.characterId] || 0) + 1;
      }
    });
    if (revealedCard && blacklistedUrls.includes(revealedCard.imageUrl)) {
      acc[revealedCard.characterId] = (acc[revealedCard.characterId] || 0) + 1;
    }
    return acc;
  }, [blacklistedUrls, collectedCards, revealedCard]);
  
  const[searchQuery, setSearchQuery] = useState("")
  const[selectedRarity, setSelectedRarity] = useState<Rarity | "all">("all")
  const[sortBy, setSortBy] = useState<"date" | "rarity" | "score" | "name" | "anime">("date")
  const[sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const[selectedPackFilter, setSelectedPackFilter] = useState<string | "all">("all")
  const[selectedMainCharacterFilter, setSelectedMainCharacterFilter] = useState<"all" | "main" | "supporting">("all")
  const [showFilters, setShowFilters] = useState(false)
  const[showRatingModal, setShowRatingModal] = useState(false)
  const[showErrorPopup, setShowErrorPopup] = useState(false)
  const[errorPopupConfig, setErrorPopupConfig] = useState<{
    title: string;
    message: string;
    type?: "error" | "warning" | "info";
    packName?: string;
    collectedCount?: number;
    availableCount?: number;
    totalCharacters?: number;
  } | null>(null)
  const[showDismantleConfirm, setShowDismantleConfirm] = useState(false)
  const[showDismantleSuccess, setShowDismantleSuccess] = useState(false)
  const[dismantleCardData, setDismantleCardData] = useState<Card | null>(null)
  const[isDismantling, setIsDismantling] = useState(false)
  const[dismantleReward, setDismantleReward] = useState(0)
  
  // Bulk dismantle states
  const[showBulkDismantleFilter, setShowBulkDismantleFilter] = useState(false)
  const[showBulkDismantleConfirm, setShowBulkDismantleConfirm] = useState(false)
  const[showBulkDismantleSuccess, setShowBulkDismantleSuccess] = useState(false)
  const[selectedBulkRarity, setSelectedBulkRarity] = useState<Rarity | "all">("all")
  const[excludeMainCharacters, setExcludeMainCharacters] = useState(false)
  const[isBulkDismantling, setIsBulkDismantling] = useState(false)
  const[bulkDismantleReward, setBulkDismantleReward] = useState(0)
  const[bulkDismantleProgress, setBulkDismantleProgress] = useState({ processed: 0, total: 0 })

  const [gachaMainTab, setGachaMainTab] = useState<"gacha" | "market">("gacha")
  const [cardToSell, setCardToSell] = useState<Card | null>(null)
  const [listedCardIds, setListedCardIds] = useState<Set<string>>(new Set())
  const [cardToChangeArt, setCardToChangeArt] = useState<Card | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const collectionRating = calculateCollectionRating(collectedCards)

  const loadListedCards = useCallback(async () => {
    const { supabase } = await import("@/lib/supabase")
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return

    try {
      const { data, error } = await supabase
        .from("market_listings")
        .select("unique_id")
        .eq("seller_id", session.user.id)

      if (error) throw error
      setListedCardIds(new Set(data?.map((item: { unique_id: string }) => item.unique_id) || []))
    } catch (error: any) {
      // Игнорируем AbortError
      if (error.name === 'AbortError') {
        console.log('[loadListedCards] Request aborted (expected behavior)');
        return;
      }
      console.error("Error loading listed cards:", error)
    }
  }, [])

  const refreshCollectionMerge = useCallback(async () => {
    const { supabase } = await import("@/lib/supabase")
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) return

    try {
      const dbCards = await loadUserCards()
      let localCollection: Card[] = []
      try {
        const raw = localStorage.getItem("gacha-collection")
        if (raw) localCollection = JSON.parse(raw)
      } catch {
        /* ignore */
      }

      const dbIds = new Set(dbCards.map((c) => c.uniqueId))
      const dbCardsWithOrder = dbCards.map((card, idx) => ({
        ...card,
        orderIndex: localCollection.length + idx,
      }))

      const merged: Card[] = [
        ...dbCardsWithOrder,
        ...localCollection
          .filter((c) => !dbIds.has(c.uniqueId))
          .map((card, i) => ({
            ...card,
            orderIndex: i,
          })),
      ]

      setCollectedCards(merged)
    } catch (error: any) {
      // Игнорируем AbortError
      if (error.name === 'AbortError') {
        console.log('[refreshCollectionMerge] Request aborted (expected behavior)');
        return;
      }
      console.error("Error refreshing collection:", error)
    }
  }, [])

  const handleListedOnMarket = useCallback(async () => {
    setViewedCard(null)
    setCardToSell(null)
    await refreshCollectionMerge()
    await refreshCoins()
    await loadListedCards()
  }, [refreshCollectionMerge, refreshCoins, loadListedCards])

  const handleTradeComplete = useCallback(async () => {
    await refreshCollectionMerge()
    await refreshCoins()
    await loadListedCards()
  }, [refreshCollectionMerge, refreshCoins, loadListedCards])

  const handleMarketNotify = useCallback((title: string, message: string, type: "error" | "warning" | "info" = "error") => {
    setErrorPopupConfig({ title, message, type })
    setShowErrorPopup(true)
  }, [])

  const handleArtChanged = useCallback((newImageUrl: string, newOriginalUrl: string) => {
    setCollectedCards(prev => prev.map(card => 
      card.uniqueId === cardToChangeArt?.uniqueId 
        ? { ...card, imageUrl: newImageUrl, originalUrl: newOriginalUrl }
        : card
    ))
  }, [cardToChangeArt?.uniqueId])

  useEffect(() => {
    const handleVisibilityChange = () => {
    if (!document.hidden) {
      // Если вкладка стала видимой, проверяем, не застряла ли операция
      if ((isRolling || isSavingCard) && operationStartTime.current) {
        const elapsed = Date.now() - operationStartTime.current;
        
        // Если крутилка крутится дольше 15 секунд — скорее всего, запрос в фоне отвалился
        if (elapsed > 15000) {
          console.warn('[Gacha] Операция затянулась в фоне. Сброс состояния.');
          setIsRolling(false);
          setIsSavingCard(false);
          operationStartTime.current = null;
        }
      }
    }
  };

  document.addEventListener('visibilitychange', handleVisibilityChange);
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
}, [isRolling, isSavingCard]);

useEffect(() => {
    let isMounted = true;

    console.log('[loadSavedCards useEffect] authUser:', authUser?.id, 'sessionLoading:', sessionLoading, 'isLoaded:', isLoaded);

    const loadSavedCards = async () => {
      // КРИТИЧНО: Здесь НЕ ДОЛЖНО БЫТЬ "if (isLoaded) return;"
      console.log('[loadSavedCards] Starting load...');

      try {
        let finalCollection: Card[] =[];
        let localCards: Card[] = [];

        // 1. Сначала загружаем настройки из localStorage
        try {
          const savedPriority = localStorage.getItem('gacha-prioritize-main-characters');
          if (savedPriority) {
            setPrioritizeMainCharacters(JSON.parse(savedPriority));
          }
        } catch (e) { console.error(e); }

        // 2. Загружаем локальные карты для поиска потерянных
        try {
          const localData = localStorage.getItem('gacha-collection');
          console.log('[loadSavedCards] LocalStorage cards:', localData ? JSON.parse(localData).length : 0);
          if (localData) {
            localCards = JSON.parse(localData);
            localCards = localCards.map((card: Card, index: number) => ({
              ...card,
              orderIndex: localCards.length - 1 - index
            }));
          }
        } catch (e) { console.error(e); }

        // 3. Загрузка из базы данных (ПРИОРИТЕТ)
        // Ждём пока сессия загрузится перед тем как продолжать
        if (sessionLoading) {
          console.log('[loadSavedCards] Session still loading, waiting...');
          return; // Просто выходим, НЕ устанавливая isLoaded
        }

        console.log('[loadSavedCards] authUser check:', !!authUser);
        if (authUser) {
          try {
            console.log('[loadSavedCards] Calling loadUserCards...');
            
            // Добавляем таймаут для всего процесса загрузки БД
            const dbCards = await Promise.race([
              loadUserCards(),
              new Promise<Card[]>((_, reject) => 
                setTimeout(() => reject(new Error('DB load timeout')), 20000)
              )
            ]);
            
            console.log('[loadSavedCards] DB cards loaded:', dbCards.length);

            // Проверка на пустой ответ от БД
            if (!Array.isArray(dbCards)) {
              console.error('[loadSavedCards] Invalid DB response, using local data');
              if (isMounted) {
                setCollectedCards(localCards);
                setIsLoaded(true);
              }
              return;
            }

            const dbCardsWithOrder = dbCards.map((card: Card, index: number) => ({
              ...card,
              orderIndex: index
            }));

            // 4. Ищем потерянные карты в localStorage, которых нет в БД
            const dbIds = new Set(dbCardsWithOrder.map(c => c.uniqueId));
            const lostCards = localCards.filter(c => !dbIds.has(c.uniqueId));
            
            console.log('[loadSavedCards] Found lost cards:', lostCards.length);

            // 5. Синхронизируем потерянные карты в БД
            if (lostCards.length > 0) {
              console.log('[loadSavedCards] Syncing lost cards to DB...');
              for (const card of lostCards) {
                try {
                  const result = await saveCardToDatabase(card);
                  if (!result.success && !result.isAbort) {
                    queueCardForSync(card);
                  }
                } catch (error) {
                  console.error('[loadSavedCards] Failed to sync lost card:', card.uniqueId, error);
                  queueCardForSync(card);
                }
              }
            }

            // 6. Объединяем: БД карты + потерянные локальные карты
            finalCollection = [
              ...dbCardsWithOrder,
              ...lostCards.map((card, index) => ({
                ...card,
                orderIndex: dbCardsWithOrder.length + index
              }))
            ];

            console.log('[loadSavedCards] Final collection size:', finalCollection.length);

            if (isMounted) {
              setCollectedCards(finalCollection);
              console.log('[loadSavedCards] Collection set, calling loadListedCards...');
              await loadListedCards(); // Подтягиваем рынок
              setIsLoaded(true); // Разблокируем UI после успешной загрузки
            }

            // 7. Фоновая досинхронизация очереди (если она упадет, карты все равно уже на экране)
            const queue = JSON.parse(localStorage.getItem('gacha-sync-queue') || '[]');
            if (queue.length > 0) {
              if (isMounted) setIsSyncingCards(true);
              const syncResult = await syncQueuedCards();
              if (isMounted) {
                setIsSyncingCards(false);
                setPendingSyncCount(syncResult.remaining);
              }
            }
          } catch (dbError: any) {
            if (dbError.name !== 'AbortError') {
              console.error('[loadSavedCards] DB error:', dbError);
              
              // Если БД недоступна, используем локальные данные
              console.log('[loadSavedCards] DB unavailable, using local data');
              if (isMounted) {
                setCollectedCards(localCards);
                setIsLoaded(true);
              }
            }
          }
        } else {
          // Если юзер пока гость (или сессия еще грузится) - показываем локальные данные
          // НО НЕ разблокируем UI, если сессия ещё загружается
          console.log('[loadSavedCards] No authUser, using local data only');
          if (isMounted) {
            setCollectedCards(localCards);
          }
          // НЕ устанавливаем isLoaded здесь, если authUser ещё не загружен
          // Это предотвратит преждевременную разблокировку UI
          return;
        }

      } catch (error: any) {
        if (error.name === 'AbortError') return;
        console.error('[loadSavedCards] Critical Error:', error);
      } finally {
        // УБРАЛИ установку isLoaded из finally блока!
        // Теперь isLoaded устанавливается только при успешной загрузке
      }
    }

    loadSavedCards();

    return () => {
      isMounted = false;
    };
  }, [authUser?.id, sessionLoading]); // Добавили sessionLoading в зависимости

  useEffect(() => {
    const loadPacks = async () => {
      try {
        setIsPackLoading(true)
        await loadYearBasedPacks()
      } catch (error) {
        console.error('[GachaPage] Error loading year-based packs:', error)
      } finally {
        setIsPackLoading(false)
      }
    }

    loadPacks()
  },[])



  useEffect(() => {
    try {
      localStorage.setItem('gacha-prioritize-main-characters', JSON.stringify(prioritizeMainCharacters));
    } catch (e) { console.error(e); }
  }, [prioritizeMainCharacters]);

  useEffect(() => {
    if (packSearchQuery.trim().length < 1) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const debounce = setTimeout(async () => {
      try {
        const results = await searchGachaPacks(packSearchQuery.trim());
        setSearchResults(results);
      } catch (error) {
        console.error("Pack search error:", error);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(debounce);
  }, [packSearchQuery]);

  useEffect(() => {
    const loadPityData = async () => {
      try {
        const data = await loadUserPity();
        setPityData(data);
      } catch (error) {
        console.error('[loadPityData] Error:', error);
      }
    };

    loadPityData();
  }, []);

  useEffect(() => {
    setRevealedCard(null);
    setShowCard(false);
    setIsRolling(false);
    setViewedCard(null);
    
    // Сбрасываем состояние сохранения при смене пакета
    setIsSavingCard(false);
    operationStartTime.current = null;
    setSearchQuery(""); 
    setShowPacks(false); 
  }, [selectedPack]);

  const handleRoll = async () => {
    if (isRolling) return;

    try {
      setIsRolling(true);
      operationStartTime.current = Date.now();
      setRevealedCard(null);
      setShowCard(false);
      
      // Сбрасываем состояние сохранения при новой крутке
      setIsSavingCard(false);

      // Get current bad luck streak
      const currentBadLuckStreak = pityData?.bad_luck_streak || 0;

      // 1. Вызываем серверный экшен с pity data
      const rollPromise = selectedPack
        ? rollFromAnimePack(selectedPack, Array.from(usedCharacterIds), blacklistedUrls, Array.from(expandPoolForCharacters), currentBadLuckStreak)
        : rollAnimeCharacter(Array.from(usedCharacterIds), blacklistedUrls, Array.from(expandPoolForCharacters), currentBadLuckStreak);

      // Добавляем жесткий тайм-аут на сетевой запрос
      const result = await Promise.race([
        rollPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 15000))
      ]) as any;

      // СРАЗУ ВЫКЛЮЧАЕМ КРУТИЛКУ
      setIsRolling(false); 
      operationStartTime.current = null;

      if (result) {
        // Update pity system after roll
        try {
          const { supabase } = await import('@/lib/supabase');
          const { data: { session } } = await supabase.auth.getSession();
          
          if (session) {
            const pityUpdate = await updateUserPityAfterRoll(session.user.id, result);
            
            // Update local pity state
            setPityData(prev => prev ? {
              ...prev,
              bad_luck_streak: pityUpdate.newStreak
            } : {
              bad_luck_streak: pityUpdate.newStreak
            });

            // Show pity notification if bonus was applied
            if (result.pityData?.pity_bonus_applied) {
              console.log(`[Pity System] Pity bonus applied! New streak: ${pityUpdate.newStreak}`);
            }
          }
        } catch (error) {
          console.error('[handleRoll] Pity update error:', error);
        }

        // Запускаем списание монет "вдогонку", не дожидаясь ответа (без await)
        spendCoins(selectedPack ? selectedPack.price : 50).catch(console.error);

        if (result.allFanArtBanned) {
          // Если все арты забанены, просто сбрасываем и просим нажать еще раз
          setErrorPopupConfig({
            title: "Персонаж найден, но...",
            message: "Все доступные арты для этого героя вами отклонены. Попробуйте другой пакет!",
            type: "info"
          });
          setShowErrorPopup(true);
          return; 
        }

        // Проверяем, что у результата есть imageUrl
        if (!result.imageUrl) {
          console.error('[handleRoll] No imageUrl in result:', result);
          setErrorPopupConfig({
            title: "Ошибка загрузки арта",
            message: "Не удалось загрузить изображение персонажа. Попробуйте еще раз!",
            type: "error"
          });
          setShowErrorPopup(true);
          return;
        }

        // Создаем карту
        const newCard: Card = {
          id: Date.now(),
          uniqueId: generateCardUniqueId(result.characterId, result.packId),
          serialId: result.shikiId.toString(),
          name: result.characterName,
          anime: result.animeName,
          rarity: result.rarity as Rarity,
          imageUrl: result.imageUrl || '',
          originalUrl: result.originalUrl || '',
          score: result.score,
          shikiId: result.shikiId,
          characterId: result.characterId,
          stats: result.stats,
          isMainCharacter: result.isMainCharacter || false,
          packId: result.packId,
          packName: result.packName,
          isArtBlacklisted: result.isMainCharacter && blacklistedUrls.includes(result.imageUrl || '')
        };
        
        // Показываем карту пользователю
        setRevealedCard(newCard);
        setShowCard(true);
        console.log('[handleRoll] Card revealed successfully:', newCard.name);
      } else {
        // Если результат пустой (пак закончился)
        handleEmptyResult(); 
      }

    } catch (error: any) {
      console.error("Gacha error:", error);
      setIsRolling(false); // На всякий случай дублируем здесь
      setErrorPopupConfig({
        title: "Ошибка",
        message: error.message === "TIMEOUT" ? "Сервер не ответил вовремя. Попробуйте еще раз!" : "Не удалось призвать персонажа.",
        type: "error"
      });
      setShowErrorPopup(true);
    } finally {
      setIsRolling(false);
      operationStartTime.current = null;
    }
  };

  // Вынесите логику проверки доступности в отдельную функцию, чтобы не загромождать handleRoll
  const handleEmptyResult = async () => {
    if (!selectedPack) return;
    
    // Показываем общую ошибку сразу
    setErrorPopupConfig({
      title: "Пак пуст или персонаж не найден",
      message: "Похоже, вы собрали всех доступных героев из этого набора.",
      type: "info"
    });
    setShowErrorPopup(true);

    // Фоново проверяем детали, не блокируя крутилку
    try {
      const packAvailability = await checkPackAvailability(selectedPack as AnimePack, Array.from(usedCharacterIds));
      if (packAvailability.isEmpty) {
         // Можно обновить попап более точными данными
      }
    } catch (e) {}
  };

  const saveCard = async (card: Card) => {
    if (isSavingCard) return;
    
    // Проверяем, не сохранена ли карта уже
    const isAlreadyIn = collectedCards.some(c => c.uniqueId === card.uniqueId);
    if (isAlreadyIn) {
      setShowCard(false);
      return;
    }
    
    let cardWithOrder = card;
    
    // Добавляем orderIndex - текущая длина массива (новые карты получают меньший индекс)
    cardWithOrder = { ...card, orderIndex: collectedCards.length };
    setCollectedCards(prev => [cardWithOrder, ...prev]);

    // 2. СТРАХОВКА: Сохраняем в localStorage ПРЯМО СЕЙЧАС, даже если юзер залогинен.
    // Это гарантирует, что при обновлении страницы карта не исчезнет, 
    // даже если запрос в БД упадет.
    try {
      const localSaved = JSON.parse(localStorage.getItem('gacha-collection') || '[]');
      if (!localSaved.some((c: Card) => c.uniqueId === card.uniqueId)) {
        localStorage.setItem('gacha-collection', JSON.stringify([cardWithOrder, ...localSaved]));
      }
    } catch (e) {
      console.error("Local storage backup failed", e);
    }

    setShowCard(false);
    setIsSavingCard(true);
    operationStartTime.current = Date.now();

    try {
      const { supabase } = await import('@/lib/supabase');
      const { data: { session } } = await supabase.auth.getSession();

      if (session) {
        const result = await saveCardToDatabase(card);
        if (!result.success) {
          // Если база недоступна, кладем в очередь на синхронизацию
          queueCardForSync(card);
        } else {
          // Если сохранение в БД прошло успешно, можно (опционально) удалить из локалки, 
          // но лучше оставить — при загрузке мы просто объединим массивы без дублей.
          console.log("Card persisted to DB");
        }
      }
      // Если сессии нет, карта уже лежит в localStorage благодаря шагу 2.
    } catch (e) {
      console.error("Critical save error:", e);
      queueCardForSync(card);
    } finally {
      setIsSavingCard(false);
      operationStartTime.current = null;
    }
  }

  const handlePackSelect = async (pack: AnimePack) => {
    if (userCoins >= pack.price) {
      setIsPackLoading(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      setSelectedPack(pack);
      setShowPacks(false);
      setIsPackLoading(false);
    }
  }

  const handleRandomRoll = () => {
    setSelectedPack(null);
    setShowPacks(false);
  }

  const handleCreateCustomPack = async () => {
    if (!customPackQuery.trim() || isCreatingCustomPack) return;
    
    setIsCreatingCustomPack(true);
    setCreatedCustomPack(null);
    setSelectedAnimeIds(new Set()); 
    
    try {
      const result = await createCustomGachaPack(customPackQuery.trim());
      
      if (result) {
        setCustomPackSearchResults(result.foundAnime);
      } else {
        alert("Аниме по запросу не найдено. Попробуйте другое название.");
      }
    } catch (error) {
      console.error("Custom pack creation error:", error);
      alert("Ошибка при создании пака. Попробуйте снова.");
    } finally {
      setIsCreatingCustomPack(false);
    }
  }

  const toggleAnimeSelection = (animeId: number) => {
    setSelectedAnimeIds(prev => {
      const newSet = new Set(prev)
      if (newSet.has(animeId)) {
        newSet.delete(animeId)
      } else {
        newSet.add(animeId)
      }
      return newSet
    })
  }

  const selectAllAnime = () => {
    setSelectedAnimeIds(new Set(customPackSearchResults.map(anime => anime.id)))
  }

  const deselectAllAnime = () => {
    setSelectedAnimeIds(new Set())
  }

  const handleCreateCustomPackFromSelected = async () => {
    if (selectedAnimeIds.size === 0) {
      alert("Выберите хотя бы одно аниме для создания пака")
      return
    }

    setIsCreatingCustomPack(true)
    setCreatedCustomPack(null)
    
    try {
      const selectedAnime = customPackSearchResults.filter(anime => selectedAnimeIds.has(anime.id))
      
      const animeResults = selectedAnime.map(anime => ({
        id: anime.id,
        name: anime.name,
        russian: anime.russian,
        score: anime.score,
        kind: 'tv', 
        episodes: 0, 
        status: 'released', 
        image: { original: anime.imageUrl }
      }))
      
      const customPack = createCustomPack(customPackQuery.trim(), animeResults)
      
      setCreatedCustomPack(customPack)
      setCustomPackSearchResults(selectedAnime) 
    } catch (error) {
      console.error("Custom pack creation error:", error)
      alert("Ошибка при создании пака. Попробуйте снова.")
    } finally {
      setIsCreatingCustomPack(false)
    }
  }

  const handleSelectCustomPack = async (pack: CustomAnimePack) => {
    if (userCoins >= pack.price) {
      setIsCustomPackLoading(true);
      await new Promise(resolve => setTimeout(resolve, 300));
      setSelectedPack(pack);
      setShowCustomPackCreator(false);
      setCreatedCustomPack(null);
      setCustomPackQuery("");
      setIsCustomPackLoading(false);
    }
  }

  const unblacklistArt = (card: Card) => {
    setBlacklistedUrls(prev => prev.filter(url => url !== card.imageUrl));
    setCollectedCards(prev => prev.map(c => 
      c.uniqueId === card.uniqueId ? { ...c, isArtBlacklisted: false } : c
    ));
  }

  const removeCard = async (cardToRemove: Card, clearViewedCard: boolean = true) => {
    try {
      console.log('[removeCard] Starting removal for card:', cardToRemove.uniqueId)
      
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        console.log('[removeCard] User authenticated, attempting database delete')
        const result = await deleteCardFromDatabase(cardToRemove.uniqueId)
        if (!result.success) {
          console.error('[removeCard] Database delete failed:', result.error)
        } else {
          console.log('[removeCard] Database delete successful')
        }
      } else {
        console.log('[removeCard] No session, only local removal')
      }
      
      try {
        const collectionData = localStorage.getItem('gacha-collection')
        if (collectionData) {
          const collection = JSON.parse(collectionData)
          const updatedCollection = collection.filter((card: Card) => card.uniqueId !== cardToRemove.uniqueId)
          localStorage.setItem('gacha-collection', JSON.stringify(updatedCollection))
          console.log('[removeCard] Removed from localStorage collection, new count:', updatedCollection.length)
        }
      } catch (e) { 
        console.error('[removeCard] Error updating localStorage collection:', e)
      }
      
      console.log('[removeCard] Removing from local state, current count:', collectedCards.length)
      setCollectedCards(prev => {
        const newCards = prev.filter(card => card.uniqueId !== cardToRemove.uniqueId)
        console.log('[removeCard] New cards count:', newCards.length)
        return newCards
      })
      
      // Only clear viewed card if explicitly requested (not during bulk operations)
      if (clearViewedCard) {
        setViewedCard(null)
      }
      
      // usedCharacterIds автоматически обновится через useMemo
      
      console.log('[removeCard] Card removal completed')
    } catch (error) {
      console.error('[removeCard] Error:', error)
      alert('Ошибка при удалении карты')
    }
  }

  const dismantleCard = async (card: Card) => {
    // Show confirmation popup
    setDismantleCardData(card);
    setDismantleReward(getDismantleValue(card.rarity));
    setShowDismantleConfirm(true);
  };

  const confirmDismantle = async () => {
    if (!dismantleCardData) return;
    
    // Используем flushSync для немедленного обновления состояния
    flushSync(() => {
      setIsDismantling(true);
    });
    
    // НЕ закрываем окно подтверждения - используем его для показа прогресса

    try {
      // Добавляем небольшую задержку чтобы прогресс был виден
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 1. Начисляем пыль через безопасную серверную операцию
      const reward = getDismantleValue(dismantleCardData.rarity);
      const success = await addDust(reward);
      
      if (!success) {
        setErrorPopupConfig({
          title: 'Ошибка распыления',
          message: 'Не удалось начислить пыль. Попробуйте еще раз.',
          type: 'error'
        });
        setShowErrorPopup(true);
        // Закрываем окно подтверждения при ошибке
        setShowDismantleConfirm(false);
        return;
      }

      // 2. Удаляем карту из БД и локального списка
      await removeCard(dismantleCardData); 
      
      setViewedCard(null);
      
      // Показываем успешное уведомление
      setDismantleReward(reward);
      
      // Закрываем окно подтверждения и открываем окно успеха
      setShowDismantleConfirm(false);
      setShowDismantleSuccess(true);
      
      // Сбрасываем состояние загрузки после показа успеха
      setIsDismantling(false);
    } catch (e) {
      console.error("Dismantle failed", e);
      setErrorPopupConfig({
        title: 'Ошибка распыления',
        message: 'Произошла ошибка при распылении карты. Попробуйте еще раз.',
        type: 'error'
      });
      setShowErrorPopup(true);
      // Закрываем окно подтверждения при ошибке
      setShowDismantleConfirm(false);
      // Сбрасываем состояние загрузки при ошибке
      setIsDismantling(false);
    } finally {
      setDismantleCardData(null);
    }
  };

  const cancelDismantle = () => {
    setShowDismantleConfirm(false);
    setDismantleCardData(null);
    setDismantleReward(0);
  };

  // Bulk dismantle functions
  const openBulkDismantleFilter = () => {
    setShowBulkDismantleFilter(true);
  };

  const selectBulkRarity = (rarity: Rarity | "all", excludeMain: boolean) => {
    setSelectedBulkRarity(rarity);
    setExcludeMainCharacters(excludeMain);
    setShowBulkDismantleFilter(false);
    
    // Calculate cards to dismantle
    let cardsToDismantle = rarity === "all" 
      ? [...collectedCards] 
      : collectedCards.filter(card => card.rarity === rarity);
    
    // Exclude main characters if requested
    if (excludeMain) {
      cardsToDismantle = cardsToDismantle.filter(card => !card.isMainCharacter);
    }
    
    // Calculate total dust and show confirmation
    const totalDust = cardsToDismantle.reduce((total, card) => total + getDismantleValue(card.rarity), 0);
    setBulkDismantleReward(totalDust);
    setShowBulkDismantleConfirm(true);
  };

  const confirmBulkDismantle = async () => {
    console.log('[confirmBulkDismantle] Starting bulk dismantle');
    
    // Force a small delay to ensure the loading state is set before starting the operation
    await new Promise(resolve => setTimeout(resolve, 10));
    
    setIsBulkDismantling(true);
    // НЕ закрываем окно подтверждения - используем его для показа прогресса
    console.log('[confirmBulkDismantle] Set isBulkDismantling to true');
    
    // Another small delay to ensure the modal has time to update
    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      // Get cards to dismantle
      let cardsToDismantle = selectedBulkRarity === "all" 
        ? [...collectedCards] 
        : collectedCards.filter(card => card.rarity === selectedBulkRarity);
      
      // Exclude main characters if requested
      if (excludeMainCharacters) {
        cardsToDismantle = cardsToDismantle.filter(card => !card.isMainCharacter);
      }
      
      if (cardsToDismantle.length === 0) {
        throw new Error("Нет карт для распыления");
      }

      // Initialize progress
      console.log('[confirmBulkDismantle] Initializing progress for', cardsToDismantle.length, 'cards');
      setBulkDismantleProgress({ processed: 0, total: cardsToDismantle.length });

      // Calculate total dust
      const totalDust = cardsToDismantle.reduce((total, card) => total + getDismantleValue(card.rarity), 0);
      console.log('[confirmBulkDismantle] Total dust to add:', totalDust);
      
      // Add dust to user balance (один раз для всех карт)
      const success = await addDust(totalDust);
      console.log('[confirmBulkDismantle] Dust addition success:', success);
      
      if (!success) {
        throw new Error("Не удалось начислить пыль");
      }

      // Remove cards in batches to avoid overwhelming the system
      const batchSize = 5; // Уменьшаем размер партии для стабильности
      let processedCount = 0;
      
      for (let i = 0; i < cardsToDismantle.length; i += batchSize) {
        const batch = cardsToDismantle.slice(i, i + batchSize);
        console.log(`[confirmBulkDismantle] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(cardsToDismantle.length/batchSize)} with ${batch.length} cards`);
        
        // Process batch in parallel
        await Promise.all(
          batch.map(async (card) => {
            await removeCard(card, false); // Don't clear viewed card during bulk operations
            processedCount++;
            console.log(`[confirmBulkDismantle] Processed ${processedCount}/${cardsToDismantle.length} cards`);
            setBulkDismantleProgress(prev => ({ ...prev, processed: processedCount }));
          })
        );
        
        // Small delay between batches to prevent overwhelming
        if (i + batchSize < cardsToDismantle.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      console.log('[confirmBulkDismantle] All cards processed successfully');
      
      // Close any viewed card if it was dismantled
      if (viewedCard && cardsToDismantle.some(c => c.uniqueId === viewedCard.uniqueId)) {
        setViewedCard(null);
      }
      
      // Reset progress and show success notification
      setBulkDismantleProgress({ processed: 0, total: 0 });
      setBulkDismantleReward(totalDust);
      
      // Закрываем окно подтверждения и открываем окно успеха
      console.log('[confirmBulkDismantle] Closing confirmation modal and opening success modal');
      setShowBulkDismantleConfirm(false);
      setShowBulkDismantleSuccess(true);
    } catch (e) {
      console.error('[confirmBulkDismantle] Bulk dismantle failed', e);
      setErrorPopupConfig({
        title: 'Ошибка массового распыления',
        message: 'Произошла ошибка при массовом распылении карт. Попробуйте еще раз.',
        type: 'error'
      });
      setShowErrorPopup(true);
      // Reset progress on error
      setBulkDismantleProgress({ processed: 0, total: 0 });
      // Закрываем окно подтверждения при ошибке
      setShowBulkDismantleConfirm(false);
    } finally {
      console.log('[confirmBulkDismantle] Finally block - setting isBulkDismantling to false');
      setIsBulkDismantling(false);
      setSelectedBulkRarity("all");
      setExcludeMainCharacters(false);
    }
  };

  const cancelBulkDismantle = () => {
    setShowBulkDismantleConfirm(false);
    setSelectedBulkRarity("all");
    setExcludeMainCharacters(false);
    setBulkDismantleReward(0);
  };

  const handleFixCoins = async () => {
    setIsFixingCoins(true)
    try {
      await fixOverflow(70000)
      const currentCoins = userCoins 
      alert(`Монеты исправлены! Теперь у вас ${currentCoins.toLocaleString()} монет`)
    } catch (error) {
      console.error('Fix coins error:', error)
      alert('Ошибка при исправлении монет')
    } finally {
      setIsFixingCoins(false)
    }
  }

  const resetFilters = () => {
    setSearchQuery("")
    setSelectedRarity("all")
    setSortBy("date")
    setSortOrder("desc")
    setSelectedPackFilter("all")
    setSelectedMainCharacterFilter("all")
  }

  const getUniquePacks = () => {
    const packs = new Set<string>()
    collectedCards.forEach(card => {
      if (card.packName) packs.add(card.packName)
    })
    return Array.from(packs).sort()
  }


  const filteredAndSortedCards = useMemo(() => {
    let result = [...collectedCards]

    result = result.filter(card => !listedCardIds.has(card.uniqueId))

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(card =>
        card.name.toLowerCase().includes(query) ||
        card.anime.toLowerCase().includes(query)
      )
    }

    if (selectedRarity !== "all") {
      result = result.filter(card => card.rarity === selectedRarity)
    }

    if (selectedPackFilter !== "all") {
      result = result.filter(card => card.packName === selectedPackFilter)
    }

    if (selectedMainCharacterFilter !== "all") {
      result = result.filter(card => {
        if (selectedMainCharacterFilter === "main") return card.isMainCharacter === true
        else if (selectedMainCharacterFilter === "supporting") return card.isMainCharacter !== true
        return true
      })
    }

    result.sort((a, b) => {
      if (sortBy === "date") {
        if (prioritizeMainCharacters) {
          const aIsMain = a.isMainCharacter ? 1 : 0;
          const bIsMain = b.isMainCharacter ? 1 : 0;
          if (aIsMain !== bIsMain) return bIsMain - aIsMain;
        }
        const aOrder = a.orderIndex ?? Infinity;
        const bOrder = b.orderIndex ?? Infinity;
        return sortOrder === "desc" ? aOrder - bOrder : bOrder - aOrder;
      } else {
        let comparison = 0
        switch (sortBy) {
          case "rarity":
            const rarityOrder =["trash", "common", "uncommon", "rare", "super_rare", "epic", "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"]
            comparison = rarityOrder.indexOf(a.rarity) - rarityOrder.indexOf(b.rarity)
            break
          case "score":
            comparison = a.score - b.score
            break
          case "name":
            comparison = a.name.localeCompare(b.name)
            break
          case "anime":
            comparison = a.anime.localeCompare(b.anime)
            break
          default:
            comparison = a.id - b.id
            break
        }
        
        if (prioritizeMainCharacters && comparison === 0) {
          const aIsMain = a.isMainCharacter ? 1 : 0;
          const bIsMain = b.isMainCharacter ? 1 : 0;
          if (aIsMain !== bIsMain) return bIsMain - aIsMain;
        }
        return sortOrder === "desc" ? -comparison : comparison
      }
    })

    return result
  },[collectedCards, listedCardIds, searchQuery, selectedRarity, selectedPackFilter, selectedMainCharacterFilter, sortBy, sortOrder, prioritizeMainCharacters])

  return (
    <div className="min-h-screen bg-[#020617] relative text-slate-100 selection:bg-indigo-500/30 font-sans pb-24 overflow-x-hidden">
      {/* Background decorations */}
      <div className="fixed top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-900/20 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-900/10 blur-[120px] pointer-events-none" />
      
      <Navbar />

      {/* Pack Selection Modal */}
      {showPacks && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setShowPacks(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-700/50 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 max-w-5xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Выбрать Набор</h2>
              <button
                onClick={() => setShowPacks(false)}
                className="p-2 sm:p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="relative group mb-6 sm:mb-8">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
              <input
                type="text"
                placeholder="Поиск набора по названию..."
                value={packSearchQuery}
                onChange={(e) => setPackSearchQuery(e.target.value)}
                className="w-full h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-950/50 border border-slate-700/50 pl-12 pr-12 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500"
              />
              {packSearchQuery && (
                <button
                  onClick={() => setPackSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6 mb-6 sm:mb-8">
              {isPackLoading && (
                <PackCardSkeleton count={6} />
              )}

              {isSearching && !isPackLoading && (
                <div className="col-span-full flex items-center justify-center py-16">
                  <GachaLoading message="Поиск наборов..." />
                </div>
              )}

              {!isPackLoading && !isSearching && packSearchQuery.trim() && searchResults.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-16 text-center">
                  <Package className="w-12 h-12 text-slate-600 mb-4" />
                  <p className="text-slate-300 font-bold text-lg mb-1">Наборы не найдены</p>
                  <p className="text-slate-500 text-sm">Попробуйте изменить поисковый запрос</p>
                </div>
              )}

              {!isPackLoading && (!packSearchQuery.trim() ? ANIME_PACKS : searchResults).map(pack => (
                <PackCard
                  key={pack.id}
                  pack={pack}
                  onSelect={handlePackSelect}
                  userCoins={userCoins}
                />
              ))}
            </div>

            <button
              onClick={handleRandomRoll}
              className="w-full flex items-center justify-center gap-2 py-3.5 sm:py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl sm:rounded-2xl transition-all shadow-lg border border-white/5 text-sm sm:text-base"
            >
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Случайный призыв (50 монет)
            </button>
          </div>
        </div>
      )}

      {/* Custom Pack Creator Modal */}
      {showCustomPackCreator && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setShowCustomPackCreator(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-700/50 rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 max-w-6xl w-full max-h-[95vh] sm:max-h-[90vh] overflow-y-auto shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-start gap-3 mb-5 sm:mb-8">
              <div className="pr-8 sm:pr-0">
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight mb-3">Создать Кастомный Пак</h2>
                {selectedAnimeIds.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
                    <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 px-2.5 sm:px-3 py-1.5 rounded-full">
                      <Coins className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-bold text-xs sm:text-sm">
                        {2000 + Math.max(0, Math.min(1000, Math.floor((customPackSearchResults.filter(a => selectedAnimeIds.has(a.id)).reduce((sum, a) => sum + (a.score || 0), 0) / selectedAnimeIds.size) * 100)))} монет
                      </span>
                    </div>
                    {(() => {
                      const avgScore = customPackSearchResults.filter(a => selectedAnimeIds.has(a.id)).reduce((sum, a) => sum + (a.score || 0), 0) / selectedAnimeIds.size;
                      let guaranteedRarity = '';
                      if (avgScore >= 8.5) guaranteedRarity = 'Эпическая';
                      else if (avgScore >= 7.5) guaranteedRarity = 'Супер Редкая';
                      else if (avgScore >= 6.5) guaranteedRarity = 'Редкая';

                      return guaranteedRarity && (
                        <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-2.5 sm:px-3 py-1.5 rounded-full">
                          <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400" />
                          <span className="text-indigo-300 font-bold text-xs sm:text-sm">
                            Гарант: {guaranteedRarity} <span className="text-indigo-400/70 font-normal hidden xs:inline">(1 из 10)</span>
                          </span>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  setShowCustomPackCreator(false);
                  setCreatedCustomPack(null);
                  setCustomPackQuery("");
                  setCustomPackSearchResults([]);
                  setSelectedAnimeIds(new Set());
                }}
                className="absolute top-4 right-4 sm:static sm:top-auto sm:right-auto p-2 sm:p-2.5 rounded-full bg-slate-800 sm:bg-white/5 hover:bg-slate-700 sm:hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-slate-700 sm:border-white/5 z-10"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="mb-5 sm:mb-8">
              <label className="block text-xs sm:text-sm font-bold text-slate-300 mb-2">
                Введите название аниме (например, "Титан", "Наруто", "Блич")
              </label>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <input
                  type="text"
                  placeholder="Например: Атака титанов..."
                  value={customPackQuery}
                  onChange={(e) => setCustomPackQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCustomPack()}
                  className="w-full sm:flex-1 h-11 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-950/50 border border-slate-700/50 px-3 sm:px-5 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                />
                <button
                  onClick={handleCreateCustomPack}
                  disabled={isCreatingCustomPack || !customPackQuery.trim()}
                  className="w-full sm:w-auto h-11 sm:h-14 px-6 sm:px-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 border border-indigo-500 disabled:cursor-not-allowed text-white font-bold rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center min-w-[120px]"
                >
                  {isCreatingCustomPack ? (
                    <GachaLoading message="" />
                  ) : (
                    "Найти"
                  )}
                </button>
              </div>
            </div>

            {!isCreatingCustomPack && !createdCustomPack && customPackSearchResults.length > 0 && (
              <div className="space-y-4 sm:space-y-6">
                <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-3 sm:gap-4 p-3 sm:p-4 bg-slate-800/30 rounded-xl sm:rounded-2xl border border-white/5">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <span className="text-xs sm:text-base font-bold text-white">
                      Выбрано: <span className="text-indigo-400">{selectedAnimeIds.size}</span> из {customPackSearchResults.length}
                    </span>
                    {selectedAnimeIds.size > 0 && (
                      <span className="text-[10px] sm:text-xs font-bold bg-green-500/10 border border-green-500/20 text-green-400 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md uppercase tracking-wider">
                        Готово
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap xs:flex-nowrap gap-2 w-full xs:w-auto">
                    <button
                      onClick={selectAllAnime}
                      className="flex-1 xs:flex-none px-3 sm:px-4 py-2 text-[10px] sm:text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-lg sm:rounded-xl transition-colors text-center"
                    >
                      Выбрать все
                    </button>
                    <button
                      onClick={deselectAllAnime}
                      className="flex-1 xs:flex-none px-3 sm:px-4 py-2 text-[10px] sm:text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-lg sm:rounded-xl transition-colors text-center"
                    >
                      Снять все
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-[10px] sm:text-xs font-black text-slate-400 mb-3 sm:mb-4 uppercase tracking-widest pl-1">
                    Найденные аниме
                  </h4>
                  <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-2.5 sm:gap-4 max-h-[350px] sm:max-h-[400px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {customPackSearchResults.map(anime => (
                      <div 
                        key={anime.id} 
                        className={`relative rounded-xl overflow-hidden bg-slate-800/30 border transition-all duration-200 cursor-pointer hover:shadow-lg flex flex-col ${
                          selectedAnimeIds.has(anime.id) 
                            ? 'border-indigo-500 ring-2 ring-indigo-500/40 transform scale-[0.98]' 
                            : 'border-white/5 hover:border-white/20 hover:scale-[1.02]'
                        }`}
                        onClick={() => toggleAnimeSelection(anime.id)}
                      >
                        <div className="relative aspect-[2/3] w-full shrink-0">
                          <img 
                            src={getOptimizedThumbSrc(anime.imageUrl, 256, 60)} 
                            alt={anime.russian || anime.name} 
                            className="absolute inset-0 w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-transparent opacity-90" />
                          <div className="absolute top-2 right-2 z-10">
                            <div className={`w-5 h-5 sm:w-6 sm:h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              selectedAnimeIds.has(anime.id)
                                ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/50'
                                : 'bg-slate-900/50 border-white/30 text-transparent backdrop-blur-sm'
                            }`}>
                              <svg className="w-3 h-3 sm:w-3.5 sm:h-3.5 fill-current" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 p-2 sm:p-2.5 flex flex-col justify-end pointer-events-none">
                          <p className="text-[9px] sm:text-xs font-bold text-white leading-tight line-clamp-2 drop-shadow-md">{anime.russian || anime.name}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-yellow-400 fill-yellow-400 drop-shadow-md" />
                            <span className="text-[9px] sm:text-xs font-bold text-white/90 drop-shadow-md">{typeof anime.score === 'number' ? anime.score.toFixed(1) : 'N/A'}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedAnimeIds.size > 0 && (
                  <button
                    onClick={handleCreateCustomPackFromSelected}
                    disabled={isCreatingCustomPack}
                    className="w-full py-3.5 sm:py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black uppercase tracking-wider rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-2 sm:gap-3 text-sm sm:text-base mt-2"
                  >
                    {isCreatingCustomPack ? (
                      <GachaLoading message="Открытие набора..." />
                    ) : (
                      <>
                        <Package className="w-4 h-4 sm:w-5 sm:h-5" />
                        Создать пак ({selectedAnimeIds.size} аниме)
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {isCreatingCustomPack && (
              <div className="flex items-center justify-center py-12 sm:py-16">
                <GachaLoading message="Поиск и сборка аниме..." />
              </div>
            )}

            {createdCustomPack && customPackSearchResults.length > 0 && (
              <div className="space-y-4 sm:space-y-6 mt-4">
                <div className="p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/30 animate-in fade-in slide-in-from-top-4 duration-300 shadow-xl">
                  <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-white mb-2 leading-tight">{createdCustomPack.name}</h3>
                  <p className="text-xs sm:text-sm md:text-base text-indigo-200/80 mb-4 sm:mb-5 line-clamp-3 sm:line-clamp-none">{createdCustomPack.description}</p>
                  
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    <div className="flex items-center gap-1.5 sm:gap-2 bg-slate-950/50 border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl shadow-inner">
                      <Coins className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
                      <span className="text-xs sm:text-sm md:text-base font-black text-white">{createdCustomPack.price} монет</span>
                    </div>
                    {createdCustomPack.guaranteedRarity && (
                      <div className="flex items-center gap-1.5 sm:gap-2 bg-indigo-500/20 border border-indigo-500/30 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl">
                        <Star className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400" />
                        <span className="text-xs sm:text-sm md:text-base font-bold text-indigo-100">
                          Гарант: <span className="hidden xs:inline">{rarityConfig[createdCustomPack.guaranteedRarity as Rarity].label}</span>
                          <span className="xs:hidden">{rarityConfig[createdCustomPack.guaranteedRarity as Rarity].label.split(' ')[0]}</span>
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleSelectCustomPack(createdCustomPack)}
                  disabled={userCoins < createdCustomPack.price}
                  className="w-full py-3.5 sm:py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black uppercase tracking-wider rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center text-sm sm:text-base"
                >
                  {userCoins < createdCustomPack.price ? "Недостаточно монет" : "Выбрать этот пак"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Art Warning Modal */}
      {showArtWarning && revealedCard && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setShowArtWarning(false)}
        >
          <div 
            className="bg-slate-900 rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-sm sm:max-w-md w-full border border-slate-700/50 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-6">
              <div className="w-16 h-16 sm:w-20 sm:h-20 mx-auto rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <RefreshCcw className="w-8 h-8 sm:w-10 sm:h-10 text-red-400" />
              </div>
              
              <div>
                <h3 className="text-2xl sm:text-3xl font-black text-white mb-3">Отбросить арт?</h3>
                <p className="text-slate-400 text-sm sm:text-base leading-relaxed">
                  Этот арт будет добавлен в черный список и не появится при следующих призывах этого персонажа.
                </p>
              </div>
              
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    const bannedCount = bannedArtsByCharacter[revealedCard.characterId] || 0;

                    if (bannedCount >= ART_BAN_LIMIT) {
                      setCardForArtLimitWarning(revealedCard);
                      setShowArtLimitWarning(true);
                      setShowArtWarning(false);
                      return;
                    }

                    setBlacklistedUrls(prev =>[...prev, revealedCard.imageUrl]);
                    setExpandPoolForCharacters(prev => new Set(prev).add(revealedCard.characterId));
                    setShowCard(false);
                    setShowArtWarning(false);
                  }}
                  className="w-full py-3.5 sm:py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 font-bold rounded-xl transition-all border border-red-500/30"
                >
                  Да, отбросить
                </button>
                <button
                  onClick={() => setShowArtWarning(false)}
                  className="w-full py-3.5 sm:py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Art Limit Warning Modal */}
      {showArtLimitWarning && cardForArtLimitWarning && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setShowArtLimitWarning(false)}
        >
          <div
            className="bg-slate-900 rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-md w-full border border-amber-500/30 shadow-2xl shadow-amber-500/10"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center space-y-6">
              <div className="w-20 h-20 mx-auto rounded-full bg-amber-500/10 border-2 border-amber-500/30 flex items-center justify-center">
                <RefreshCcw className="w-10 h-10 text-amber-400" />
              </div>

              <div>
                <h3 className="text-xl sm:text-2xl font-black text-white mb-2">
                  Много отклонённых артов!
                </h3>
                <p className="text-slate-400 text-sm sm:text-base leading-relaxed mb-4">
                  Вы отклонили уже <span className="text-amber-400 font-bold">{bannedArtsByCharacter[cardForArtLimitWarning.characterId] || 0}</span> артов для этого персонажа.
                </p>
                <div className="bg-slate-800/50 rounded-xl p-4 text-left space-y-3">
                  <p className="text-slate-300 text-sm font-bold uppercase tracking-wide mb-2">
                    {cardForArtLimitWarning.name}
                  </p>
                  <p className="text-slate-400 text-xs">
                    Возможно, фан-арты не соответствуют персонажу или их качество низкое.
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setBlacklistedUrls(prev =>[...prev, cardForArtLimitWarning.imageUrl]);
                    const officialCard: Card = {
                      ...cardForArtLimitWarning,
                      imageUrl: cardForArtLimitWarning.originalUrl,
                      isArtBlacklisted: true
                    };
                    setRevealedCard(officialCard);
                    setShowArtLimitWarning(false);
                    setShowCard(true);
                  }}
                  className="w-full py-3.5 sm:py-4 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold rounded-xl transition-all border border-emerald-500/30 flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  Взять официальный арт с Shikimori
                </button>
                
                <button
                  onClick={() => {
                    setBlacklistedUrls(prev =>[...prev, cardForArtLimitWarning.imageUrl]);
                    setShowCard(false);
                    setShowArtLimitWarning(false);
                  }}
                  className="w-full py-3.5 sm:py-4 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl transition-all border border-slate-600"
                >
                  Продолжить поиск артов
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Collection Rating Modal */}
      {showRatingModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setShowRatingModal(false)}
        >
          <div
            className="bg-slate-900 border border-slate-700/50 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Рейтинг Коллекции</h2>
              <button
                onClick={() => setShowRatingModal(false)}
                className="p-2 sm:p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            {/* Overall Grade */}
            <div className="flex flex-col sm:flex-row items-center gap-6 sm:gap-8 mb-8 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-slate-800/50 to-slate-900/50 border border-slate-700/50">
              <div className={`w-24 h-24 sm:w-32 sm:h-32 rounded-2xl bg-gradient-to-br ${collectionRating.gradeColor} flex items-center justify-center shadow-2xl`}>
                <span className="text-5xl sm:text-6xl font-black text-white">{collectionRating.grade}</span>
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-2">Общий счёт</div>
                <div className="text-4xl sm:text-5xl font-black text-white mb-3">{collectionRating.overallScore}<span className="text-lg sm:text-xl text-slate-400">/100</span></div>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                    <Star className="w-4 h-4 text-indigo-400" />
                    <span className="text-sm font-bold text-indigo-200">Редкость: {collectionRating.avgRarity}%</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
                    <Heart className="w-4 h-4 text-purple-400" />
                    <span className="text-sm font-bold text-purple-200">Сила: {collectionRating.powerScore}%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
              {/* Stats Overview */}
              <div className="space-y-4 sm:space-y-5">
                <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-400" />
                  Характеристики
                </h3>
                <div className="space-y-3 sm:space-y-4 p-4 sm:p-5 rounded-xl bg-slate-800/30 border border-slate-700/50">
                  <StatBar label={statLabels.hp} value={collectionRating.stats.avgHp} color="from-red-400 to-rose-500" />
                  <StatBar label={statLabels.atk} value={collectionRating.stats.avgAtk} color="from-orange-400 to-amber-500" />
                  <StatBar label={statLabels.def} value={collectionRating.stats.avgDef} color="from-blue-400 to-cyan-500" />
                  <StatBar label={statLabels.spd} value={collectionRating.stats.avgSpd} color="from-emerald-400 to-teal-500" />
                  <StatBar label={statLabels.luck} value={collectionRating.stats.avgLuck} color="from-purple-400 to-pink-500" />
                </div>
                <div className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/50">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Общая сила</div>
                  <div className="text-2xl sm:text-3xl font-black text-white">{collectionRating.totalPower.toLocaleString()}</div>
                </div>
              </div>

              {/* Rarity Distribution */}
              <div className="space-y-4 sm:space-y-5">
                <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  Распределение редкости
                </h3>
                <div className="p-4 sm:p-5 rounded-xl bg-slate-800/30 border border-slate-700/50 space-y-2">
                  {RARITY_ORDER.map((rarity) => {
                    const count = collectionRating.rarityDistribution[rarity] || 0
                    const percentage = collectedCards.length > 0 ? Math.round((count / collectedCards.length) * 100) : 0
                    return (
                      <div key={rarity} className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${rarityConfig[rarity].color}`} />
                        <span className="text-xs sm:text-sm font-bold text-slate-300 min-w-[100px]">{rarityConfig[rarity].label}</span>
                        <div className="flex-1 h-2 bg-slate-700/50 rounded-full overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${rarityConfig[rarity].color}`} style={{ width: `${percentage}%` }} />
                        </div>
                        <span className="text-xs sm:text-sm font-black text-white w-8 text-right">{count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Top Cards */}
            <div className="mt-6 sm:mt-8 space-y-4 sm:space-y-5">
              <h3 className="text-lg sm:text-xl font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                Лучшие карты
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
                {collectionRating.topCards.map((card) => (
                  <TopCard 
                    key={card.uniqueId}
                    card={card}
                    onClick={(clickedCard) => {
                      setViewedCard(clickedCard)
                      setShowRatingModal(false)
                    }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Viewed Card Modal */}
      {viewedCard && (
        <div 
          className="fixed inset-0 z-[120] flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto"
          onClick={() => setViewedCard(null)}
        >
          <button onClick={() => setViewedCard(null)} className="fixed top-4 right-4 sm:top-6 sm:right-6 p-2.5 sm:p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10 z-[130] shadow-xl backdrop-blur-md">
            <X className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
          
          <div 
            className="flex flex-col items-center justify-center min-h-full py-12 w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <InteractiveCard card={viewedCard} />
            
            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-center gap-2.5 sm:gap-4 mt-6 sm:mt-10 w-full max-w-[260px] sm:max-w-3xl mx-auto">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-3 sm:px-5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2 transition-colors border border-red-500/20 w-full sm:w-auto"
              >
                <Trash className="w-4 h-4 shrink-0" /> 
                <span className="truncate">Удалить из коллекции</span>
              </button>
              
              <button
                onClick={() => dismantleCard(viewedCard)}
                className="px-4 py-3 sm:px-5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2 transition-colors border border-amber-500/20 w-full sm:w-auto"
              >
                <RefreshCcw className="w-4 h-4 shrink-0" />
                <span className="truncate">Распылить (+{getDismantleValue(viewedCard.rarity)} пыли)</span>
              </button>

              {authUser && (
                <button
                  type="button"
                  onClick={() => {
                    setCardToSell(viewedCard)
                  }}
                  className="px-4 py-3 sm:px-5 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2 transition-colors border border-cyan-500/30 w-full sm:w-auto"
                >
                  <Store className="w-4 h-4 shrink-0" />
                  <span className="truncate">Продать на маркете</span>
                </button>
              )}

              {authUser && (
                <button
                  type="button"
                  onClick={() => {
                    setCardToChangeArt(viewedCard)
                    setViewedCard(null)
                  }}
                  className="px-4 py-3 sm:px-5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-bold text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2 transition-colors border border-purple-500/30 w-full sm:w-auto"
                >
                  <Sparkles className="w-4 h-4 shrink-0" />
                  <span className="truncate">Сменить арт</span>
                </button>
              )}
              
              {viewedCard.isMainCharacter && viewedCard.isArtBlacklisted && (
                <button 
                  onClick={() => unblacklistArt(viewedCard)}
                  className="px-4 py-3 sm:px-5 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 font-bold text-xs sm:text-sm flex items-center justify-center sm:justify-start gap-2 transition-colors border border-green-500/20 w-full sm:w-auto"
                >
                  <RefreshCcw className="w-4 h-4 shrink-0" /> 
                  <span className="truncate">Разблокировать арт</span>
                </button>
              )}
              
              <div className="grid grid-cols-2 gap-2 w-full sm:w-auto sm:flex sm:gap-4">
                <a href={viewedCard.originalUrl} target="_blank" rel="noreferrer" className="px-3 py-3 sm:px-5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors border border-slate-700 w-full">
                  <ZoomIn className="w-4 h-4 shrink-0" /> 
                  <span className="truncate">Оригинал</span>
                </a>
                
                <a href={`https://shikimori.one/animes/${viewedCard.shikiId}`} target="_blank" rel="noreferrer" className="px-3 py-3 sm:px-5 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors border border-blue-500/20 w-full">
                  <ExternalLink className="w-4 h-4 shrink-0" /> 
                  <span className="truncate">Шикимори</span>
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16 max-w-7xl relative z-10">
        
       {/* Header Section */}
        <div className="text-center mb-8 sm:mb-16">
          <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-3 sm:mb-4 text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 uppercase drop-shadow-sm px-2">
            WEEB.<span className="text-indigo-500">X</span> ГАЧА
          </h1>
          <p className="text-slate-400 text-xs sm:text-base md:text-lg font-medium max-w-2xl mx-auto px-4">
            Призывай любимых персонажей и собирай уникальную коллекцию. Нажми на карту, чтобы увидеть характеристики.
          </p>
          
          <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4 mt-6 sm:mt-8 px-2 sm:px-0">
            <div className="flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-xl shadow-yellow-500/5">
              <Coins className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-400" />
              {coinsLoading ? (
                <Loader2 className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-400 animate-spin" />
              ) : (
                <span className="text-lg sm:text-2xl font-black text-yellow-400 tracking-tight">{userCoins.toLocaleString()}</span>
              )}
            </div>

            <div className="flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-xl shadow-amber-500/5">
              <Sparkles className="w-4 h-4 sm:w-6 sm:h-6 text-amber-400" />
              {dustLoading ? (
                <Loader2 className="w-4 h-4 sm:w-6 sm:h-6 text-amber-400 animate-spin" />
              ) : (
                <span className="text-lg sm:text-2xl font-black text-amber-400 tracking-tight">{dust.toLocaleString()}</span>
              )}
            </div>

            {/* Sync indicator and manual sync button */}
            {(pendingSyncCount > 0 || isSyncingCards) && (
              <button
                onClick={async () => {
                  setIsSyncingCards(true);
                  const result = await syncQueuedCards();
                  setIsSyncingCards(false);
                  setPendingSyncCount(result.remaining);
                  alert(`Синхронизация завершена: ${result.success} успешно, ${result.failed} ошибок`);
                }}
                disabled={isSyncingCards}
                className="flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-green-500/10 hover:bg-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-green-400 text-xs sm:text-sm font-bold transition-all border border-green-500/20 relative w-full sm:w-auto mt-2 sm:mt-0"
                title={pendingSyncCount > 0 ? `Карт в очереди: ${pendingSyncCount}. Нажмите для синхронизации` : 'Синхронизация...'}
              >
                <RefreshCcw className={`w-4 h-4 ${isSyncingCards ? 'animate-spin' : ''}`} />
                <span>
                  {isSyncingCards ? 'Синхронизация...' : `Ожидает синхронизации: ${pendingSyncCount}`}
                </span>
                {pendingSyncCount > 0 && !isSyncingCards && (
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-green-500 text-white text-[10px] font-bold flex items-center justify-center">
                    {pendingSyncCount}
                  </span>
                )}
              </button>
            )}

            {userCoins > 1000000 && (
              <button
                onClick={handleFixCoins}
                disabled={isFixingCoins}
                className="flex items-center justify-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-red-400 text-xs sm:text-sm font-bold transition-all border border-red-500/20 w-full sm:w-auto mt-2 sm:mt-0"
                title="Исправить монеты"
              >
                <RefreshCcw className={`w-4 h-4 ${isFixingCoins ? 'animate-spin' : ''}`} />
                <span>{isFixingCoins ? 'Исправление...' : 'Испр. монеты'}</span>
              </button>
            )}
          </div>
        </div>


        {gachaMainTab === "market" ? (
          <GachaMarketPanel
            onTradeComplete={handleTradeComplete}
            onNotify={handleMarketNotify}
          />
        ) : (
          <>
        {/* Selected Pack Indicator */}
        {selectedPack && (
          <div className="mb-8 sm:mb-12 text-center animate-in fade-in slide-in-from-top-4">
            <div className="inline-flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-5 py-3 rounded-2xl border border-indigo-500/30 shadow-lg shadow-indigo-500/10">
              <Package className="w-5 h-5 text-indigo-400" />
              <span className="text-white font-bold text-sm sm:text-base">Набор: <span className="text-indigo-300">{selectedPack.name}</span></span>
              <div className="w-px h-5 bg-white/10 mx-2" />
              <button 
                onClick={() => setSelectedPack(null)}
                className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Action Area */}
        <div className="flex flex-col items-center justify-center min-h-[420px] sm:min-h-[500px] mb-12 sm:mb-24 relative px-2">
          
          {/* Initial Loading State */}
          {!isLoaded && (
            <div className="flex flex-col items-center w-full max-w-md mx-auto">
              <div className="w-[260px] sm:w-72 md:w-80 h-[380px] sm:h-[420px] md:h-[480px] rounded-[2rem] sm:rounded-[2.5rem] bg-slate-900/40 border border-slate-700/50 animate-pulse flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950/40 opacity-50" />
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-slate-400 font-medium text-xs sm:text-sm">Загрузка гачи...</p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-4 sm:mt-8 w-full max-w-[260px] sm:max-w-full">
                <div className="flex-1 h-12 sm:h-14 bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/50" />
                <div className="flex-1 h-12 sm:h-14 bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/50" />
              </div>
            </div>
          )}
          
          {/* Default Empty State */}
          {isLoaded && !showCard && !isRolling && (
            <div className="flex flex-col items-center w-full max-w-md mx-auto">
              <button 
                onClick={handleRoll} 
                className="group relative w-[260px] sm:w-72 md:w-80 h-[380px] sm:h-[420px] md:h-[480px] rounded-[2rem] sm:rounded-[2.5rem] border-2 border-dashed border-slate-700/50 bg-slate-900/40 hover:bg-slate-800/60 backdrop-blur-md flex flex-col items-center justify-center hover:border-indigo-500/50 transition-all duration-300 overflow-hidden shadow-2xl"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-indigo-500/5 group-hover:to-indigo-500/10 transition-colors" />
                <Sparkles className="w-8 h-8 sm:w-12 sm:h-12 text-indigo-500/70 group-hover:text-indigo-400 mb-4 sm:mb-5 animate-pulse" />
                <span className="font-black text-slate-400 group-hover:text-indigo-300 uppercase tracking-widest text-xs sm:text-base text-center px-4 relative z-10">
                  {selectedPack ? `Призвать (${selectedPack.price})` : "Призвать (50)"}
                </span>
              </button>
              
              {/* Pity System Indicator */}
              {pityData && pityData.bad_luck_streak > 0 && (
                <div className="mt-4 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl max-w-[260px] sm:max-w-full text-center">
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                    <Star className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400" />
                    <span className="text-amber-300 font-semibold text-xs sm:text-sm truncate">
                      Серия неудач: {pityData.bad_luck_streak}
                    </span>
                    <Star className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400" />
                  </div>
                  {pityData.bad_luck_streak >= 5 && (
                    <div className="text-center mt-1 text-[10px] sm:text-xs text-amber-200">
                      +{Math.floor(pityData.bad_luck_streak / 5)}% шанс на редкую карту
                    </div>
                  )}
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-4 sm:mt-8 w-full max-w-[260px] sm:max-w-full">
                <button
                  onClick={() => setShowPacks(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl transition-all shadow-lg text-xs sm:text-base w-full"
                >
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 shrink-0" />
                  Выбрать набор
                </button>

                <button
                  onClick={() => setShowCustomPackCreator(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl transition-all shadow-lg text-xs sm:text-base w-full"
                >
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 shrink-0" />
                  Создать пак
                </button>
              </div>
            </div>
          )}

          {/* Rolling State */}
          {isRolling && (
            <div className="w-[260px] sm:w-72 md:w-80 h-[380px] sm:h-[420px] md:h-[480px] rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/30 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl shadow-indigo-500/20">
              <div className="absolute inset-0">
                {[...Array(15)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-1 h-1 bg-indigo-400 rounded-full animate-pulse"
                    style={{
                      top: `${Math.random() * 100}%`,
                      left: `${Math.random() * 100}%`,
                      animationDelay: `${Math.random() * 2}s`,
                      animationDuration: `${1 + Math.random() * 2}s`
                    }}
                  />
                ))}
              </div>

              <div className="relative z-10 scale-100 sm:scale-125">
                <GachaLoading message="Загрузка карт..." />
              </div>
            </div>
          )}

          {/* Revealed Card State */}
          {showCard && revealedCard && (
            <div className="flex flex-col items-center animate-in zoom-in-95 duration-500 w-full">
              <InteractiveCard card={revealedCard} />

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8 sm:mt-10 w-full max-w-xs sm:max-w-md mx-auto">
                <button
                  onClick={() => {
                    // If save is stuck (running for more than 5 seconds), allow user to force reset
                    if (isSavingCard && operationStartTime.current && Date.now() - operationStartTime.current > 5000) {
                      console.warn('[User] Force reset save state');
                      setIsSavingCard(false);
                      operationStartTime.current = null;
                      return;
                    }
                    saveCard(revealedCard);
                  }}
                  disabled={isSavingCard && (!operationStartTime.current || Date.now() - operationStartTime.current <= 5000)}
                  className="flex-1 px-4 sm:px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-wider rounded-xl sm:rounded-2xl transition-all text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 border border-indigo-400/50 relative group"
                  title={isSavingCard && operationStartTime.current && Date.now() - operationStartTime.current > 5000 ? "Нажмите ещё раз для сброса" : undefined}
                >
                  {isSavingCard && operationStartTime.current && Date.now() - operationStartTime.current > 5000 && (
                    <div className="absolute inset-0 bg-red-600/50 rounded-xl sm:rounded-2xl animate-pulse" />
                  )}
                  {isSavingCard ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                      <span className="relative z-10">
                        {isSavingCard && operationStartTime.current && Date.now() - operationStartTime.current > 5000 
                          ? "Нажмите для сброса" 
                          : "Сохранение..."}
                      </span>
                    </>
                  ) : (
                    <>
                      <Database className="w-5 h-5" />
                      Сохранить
                    </>
                  )}
                </button>
                <button
                  onClick={() => {
                    if (revealedCard.isMainCharacter) {
                      setShowArtWarning(true);
                    } else {
                      setShowCard(false);
                    }
                  }}
                  className="flex-1 px-4 sm:px-6 py-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold uppercase tracking-wider rounded-xl sm:rounded-2xl transition-all text-sm sm:text-base border border-slate-600 shadow-lg"
                >
                  Отбросить
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Collection Section */}
        {!isLoaded ? (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-5">
              {/* Collection Header Skeleton */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-lg animate-pulse" />
                  <div className="h-8 w-32 bg-slate-700 rounded-lg animate-pulse" />
                  <div className="h-6 w-12 bg-slate-800 rounded-lg animate-pulse" />
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-10 bg-slate-700 rounded-lg animate-pulse" />
                  <div className="w-24 h-10 bg-slate-800 rounded-lg animate-pulse" />
                </div>
              </div>
              
              {/* Collection Grid Skeleton */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                <CollectionCardSkeleton count={12} />
              </div>
            </div>
          </div>
        ) : (  // Убрали проверку на > 0, теперь коллекция рендерится всегда
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-5">
              
              {/* Collection Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight flex items-center gap-3">
                    <Star className="w-6 sm:w-8 h-6 sm:h-8 text-yellow-400" />
                    Коллекция <span className="text-slate-500 text-xl sm:text-2xl">({collectedCards.length})</span>
                  </h2>
                </div>

                <div className="flex items-center gap-3">
                  {/* Collection Rating Badge */}
                  <button
                    onClick={() => setShowRatingModal(true)}
                    className="flex items-center gap-2 sm:gap-3 px-4 sm:px-5 py-2.5 sm:py-3 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 hover:border-slate-600 transition-all shadow-lg hover:shadow-xl group"
                  >
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br ${collectionRating.gradeColor} flex items-center justify-center shadow-lg`}>
                      <span className="text-lg sm:text-xl font-black text-white">{collectionRating.grade}</span>
                    </div>
                    <div className="text-left hidden sm:block">
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Рейтинг</div>
                      <div className="text-sm font-black text-white">{collectionRating.overallScore}/100</div>
                    </div>
                  </button>

                  {!isLoaded ? (
                    <div className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 border border-slate-800 text-slate-500 font-bold rounded-xl text-sm w-fit cursor-not-allowed">
                      <Search className="w-4 h-4" />
                      Загрузка...
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowFilters(!showFilters)}
                      className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${showFilters ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white'}`}
                    >
                      <Search className="w-4 h-4" />
                      Фильтры
                      {showFilters ? <X className="w-4 h-4 ml-1" /> : null}
                    </button>
                  )}
                </div>
              </div>

              {/* Filter Panel */}
              {isLoaded && showFilters && (
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xl">
                  
                  {/* Search Input */}
                  <div className="relative group">
                    <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 w-4 sm:w-5 h-4 sm:h-5 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
                    <input
                      type="text"
                      placeholder="Поиск по имени или аниме..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-11 sm:h-12 rounded-xl bg-slate-950/50 border border-slate-700/50 pl-10 sm:pl-12 pr-10 sm:pr-12 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 sm:right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Dropdowns Grid */}
                  <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Редкость</label>
                      <select
                        value={selectedRarity}
                        onChange={(e) => setSelectedRarity(e.target.value as Rarity | "all")}
                        className="w-full h-10 sm:h-11 rounded-xl bg-slate-950/50 border border-slate-700/50 px-3 sm:px-4 text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      >
                        <option value="all">Все редкости</option>
                        {Object.entries(rarityConfig).map(([key, config]) => (
                          <option key={key} value={key}>{config.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Набор</label>
                      <select
                        value={selectedPackFilter}
                        onChange={(e) => setSelectedPackFilter(e.target.value)}
                        className="w-full h-10 sm:h-11 rounded-xl bg-slate-950/50 border border-slate-700/50 px-3 sm:px-4 text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      >
                        <option value="all">Все наборы</option>
                        {getUniquePacks().map(packName => (
                          <option key={packName} value={packName}>{packName}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2 col-span-2 lg:col-span-1">
                      <label className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Тип героя</label>
                      <select
                        value={selectedMainCharacterFilter}
                        onChange={(e) => setSelectedMainCharacterFilter(e.target.value as typeof selectedMainCharacterFilter)}
                        className="w-full h-10 sm:h-11 rounded-xl bg-slate-950/50 border border-slate-700/50 px-3 sm:px-4 text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      >
                        <option value="all">Все типы</option>
                        <option value="main">Главные герои</option>
                        <option value="supporting">Второстепенные</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Сортировка</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        className="w-full h-10 sm:h-11 rounded-xl bg-slate-950/50 border border-slate-700/50 px-3 sm:px-4 text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      >
                        <option value="date">По дате</option>
                        <option value="rarity">По редкости</option>
                        <option value="score">По рейтингу</option>
                        <option value="name">По имени</option>
                        <option value="anime">По аниме</option>
                      </select>
                    </div>

                    <div className="space-y-1.5 sm:space-y-2">
                      <label className="text-[10px] sm:text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Порядок</label>
                      <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                        className="w-full h-10 sm:h-11 rounded-xl bg-slate-950/50 border border-slate-700/50 px-3 sm:px-4 text-xs sm:text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      >
                        <option value="desc">По убыванию</option>
                        <option value="asc">По возрастанию</option>
                      </select>
                    </div>
                  </div>

                  {/* GG Priority Checkbox */}
                  <div className="flex items-center gap-3 p-3 sm:p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                    <input
                      type="checkbox"
                      id="gg-priority"
                      checked={prioritizeMainCharacters}
                      onChange={(e) => setPrioritizeMainCharacters(e.target.checked)}
                      className="w-4 h-4 sm:w-5 sm:h-5 rounded border-2 border-slate-600 bg-slate-900 text-indigo-500 focus:ring-2 focus:ring-indigo-500/50 focus:ring-offset-0 focus:ring-offset-slate-900 cursor-pointer"
                    />
                    <label htmlFor="gg-priority" className="flex items-center gap-2 cursor-pointer flex-wrap">
                      <span className="text-xs sm:text-sm font-bold text-white">GG Priority</span>
                      <span className="text-[10px] sm:text-xs text-slate-400">(главные герои всегда первыми)</span>
                    </label>
                  </div>

                  {/* Actions & Active Filters */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-slate-700/50">
                    <div className="flex flex-wrap items-center gap-2">
                      {(searchQuery || selectedRarity !== "all" || selectedPackFilter !== "all" || selectedMainCharacterFilter !== "all") && (
                        <span className="text-[10px] sm:text-xs font-bold text-slate-500 uppercase mr-1 sm:mr-2 w-full sm:w-auto mb-1 sm:mb-0">Активные:</span>
                      )}
                      
                      {searchQuery && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[10px] sm:text-xs font-bold">
                          {searchQuery}
                          <button onClick={() => setSearchQuery("")} className="hover:text-white p-0.5"><X size={12} /></button>
                        </span>
                      )}
                      {selectedRarity !== "all" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-[10px] sm:text-xs font-bold">
                          {rarityConfig[selectedRarity].label}
                          <button onClick={() => setSelectedRarity("all")} className="hover:text-white p-0.5"><X size={12} /></button>
                        </span>
                      )}
                      {selectedPackFilter !== "all" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-300 text-[10px] sm:text-xs font-bold truncate max-w-[120px] sm:max-w-xs">
                          {selectedPackFilter}
                          <button onClick={() => setSelectedPackFilter("all")} className="hover:text-white p-0.5"><X size={12} /></button>
                        </span>
                      )}
                      {selectedMainCharacterFilter !== "all" && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-[10px] sm:text-xs font-bold">
                          {selectedMainCharacterFilter === "main" ? "Главные герои" : "Второстепенные"}
                          <button onClick={() => setSelectedMainCharacterFilter("all")} className="hover:text-white p-0.5"><X size={12} /></button>
                        </span>
                      )}
                    </div>
                    
                    <div className="flex flex-col xs:flex-row gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                      <button
                        onClick={openBulkDismantleFilter}
                        disabled={collectedCards.length === 0 || isBulkDismantling}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-amber-600/10 hover:bg-amber-600/20 disabled:opacity-50 disabled:cursor-not-allowed border border-amber-500/20 text-amber-400 font-bold rounded-xl transition-all text-xs sm:text-sm"
                        title={collectedCards.length === 0 ? "Нет карт для распыления" : "Массовое распыление карт"}
                      >
                        <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span>Масс. распыление</span>
                      </button>
                      
                      <button
                        onClick={resetFilters}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl transition-all text-xs sm:text-sm"
                      >
                        <RefreshCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Сбросить
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Results Info */}
            {!isLoaded ? (
              <div className="text-sm font-bold text-slate-500 animate-pulse">Синхронизация базы данных...</div>
            ) : filteredAndSortedCards.length !== collectedCards.length && (
              <div className="text-sm font-bold text-slate-400">
                Показано <span className="text-white">{filteredAndSortedCards.length}</span> из {collectedCards.length} карт
              </div>
            )}

            {/* Grid */}
            {!isLoaded ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                <CollectionCardSkeleton count={12} />
              </div>
            ) : filteredAndSortedCards.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 sm:py-24 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
                <Database className="w-12 h-12 text-slate-700 mb-4" />
                <p className="text-slate-300 font-bold text-lg mb-2">Ничего не найдено</p>
                <p className="text-slate-500 text-sm mb-6 max-w-sm">По вашему запросу нет карт. Попробуйте изменить фильтры.</p>
                <button
                  onClick={resetFilters}
                  className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl transition-all shadow-lg"
                >
                  Сбросить фильтры
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                  {filteredAndSortedCards.slice(0, displayedCardsCount).map((card) => (
                    <CollectionCard 
                      key={card.uniqueId}
                      card={card}
                      onClick={setViewedCard}
                    />
                  ))}
                </div>
              {/* Show More Button */}
              {filteredAndSortedCards.length > displayedCardsCount && (
                <div className="flex justify-center mt-8">
                  <button
                    onClick={() => setDisplayedCardsCount(prev => prev + 60)}
                    className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg border border-white/10 flex items-center gap-2"
                  >
                    <Sparkles className="w-5 h-5" />
                    Показать ещё
                  </button>
                </div>
              )}
              </>
            )}
          </div>
        )}
          </>
        )}
      </div>

      {cardToSell && (
        <GachaSellMarketModal
          card={cardToSell}
          collectedCards={collectedCards}
          onClose={() => setCardToSell(null)}
          onListed={handleListedOnMarket}
          onNotify={handleMarketNotify}
        />
      )}

      {cardToChangeArt && (
        <ChangeArtModal
          card={cardToChangeArt}
          onClose={() => setCardToChangeArt(null)}
          onArtChanged={handleArtChanged}
        />
      )}
      
      {/* Error Popup */}
      {errorPopupConfig && (
        <GachaErrorPopup
          isOpen={showErrorPopup}
          onClose={() => setShowErrorPopup(false)}
          title={errorPopupConfig.title}
          message={errorPopupConfig.message}
          type={errorPopupConfig.type}
          packName={errorPopupConfig.packName}
          collectedCount={errorPopupConfig.collectedCount}
          availableCount={errorPopupConfig.availableCount}
          totalCharacters={errorPopupConfig.totalCharacters}
        />
      )}

      {/* Dismantle Confirmation Popup */}
      {dismantleCardData && (
        <DismantleConfirmPopup
          isOpen={showDismantleConfirm}
          onClose={cancelDismantle}
          onConfirm={confirmDismantle}
          cardName={dismantleCardData.name}
          cardRarity={rarityConfig[dismantleCardData.rarity].label}
          dustAmount={dismantleReward}
          isLoading={isDismantling}
        />
      )}

      {/* Dismantle Success Popup */}
      <DismantleSuccessPopup
        isOpen={showDismantleSuccess}
        onClose={() => setShowDismantleSuccess(false)}
        cardName={dismantleCardData?.name || ''}
        dustAmount={dismantleReward}
        newDustBalance={dust}
      />

      {/* Bulk Dismantle Filter Popup */}
      <BulkDismantleFilterPopup
        isOpen={showBulkDismantleFilter}
        onClose={() => setShowBulkDismantleFilter(false)}
        onConfirm={selectBulkRarity}
        collectedCards={collectedCards}
        isLoading={isBulkDismantling}
      />

      {/* Bulk Dismantle Confirmation Popup */}
      <BulkDismantleConfirmPopup
        isOpen={showBulkDismantleConfirm}
        onClose={cancelBulkDismantle}
        onConfirm={confirmBulkDismantle}
        selectedRarity={selectedBulkRarity}
        cardsCount={(() => {
          let cards = selectedBulkRarity === "all" ? collectedCards : collectedCards.filter(card => card.rarity === selectedBulkRarity);
          if (excludeMainCharacters) {
            cards = cards.filter(card => !card.isMainCharacter);
          }
          return cards.length;
        })()}
        totalDustAmount={bulkDismantleReward}
        isLoading={isBulkDismantling}
        progress={bulkDismantleProgress}
      />

      {/* Bulk Dismantle Success Popup */}
      <BulkDismantleSuccessPopup
        isOpen={showBulkDismantleSuccess}
        onClose={() => setShowBulkDismantleSuccess(false)}
        cardsCount={(() => {
          let cards = selectedBulkRarity === "all" ? collectedCards : collectedCards.filter(card => card.rarity === selectedBulkRarity);
          if (excludeMainCharacters) {
            cards = cards.filter(card => !card.isMainCharacter);
          }
          return cards.length;
        })()}
        selectedRarity={selectedBulkRarity === "all" ? "Все редкости" : rarityConfig[selectedBulkRarity].label}
        totalDustAmount={bulkDismantleReward}
        newDustBalance={dust}
        excludeMainCharacters={excludeMainCharacters}
      />
{/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-slate-900 border-slate-700/50 w-[95vw] max-w-md rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl">
          <AlertDialogHeader className="space-y-3">
            <AlertDialogTitle className="text-xl sm:text-2xl font-black text-white">Удалить карту?</AlertDialogTitle>
            <AlertDialogDescription className="text-slate-400 text-sm sm:text-base leading-relaxed">
              Вы уверены, что хотите удалить карту <span className="font-bold text-white">"{viewedCard?.name}"</span> из вашей коллекции? Это действие нельзя отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 mt-6 sm:mt-8">
            <AlertDialogCancel className="mt-0 sm:mt-0 w-full sm:w-auto h-12 sm:h-11 rounded-xl bg-slate-800 border-slate-700 text-white hover:bg-slate-700 hover:text-white font-bold transition-colors">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => {
                if (viewedCard) {
                  removeCard(viewedCard);
                  setShowDeleteConfirm(false);
                  setShowCard(false);
                }
              }}
              className="w-full sm:w-auto h-12 sm:h-11 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 font-bold transition-colors"
            >
              Удалить навсегда
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Bottom Navigation for Gacha (Mobile Only) */}
      <div className="fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-[400px] md:hidden pb-[env(safe-area-inset-bottom)]">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/40 flex items-center justify-between p-1.5 h-[64px] sm:h-[72px]">
          <button
            type="button"
            onClick={() => setGachaMainTab("gacha")}
            className={`flex flex-col items-center justify-center gap-1 w-1/2 h-full rounded-xl transition-all duration-300 ${
              gachaMainTab === "gacha"
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-inner"
                : "text-slate-400 hover:text-slate-300 hover:bg-white/5 active:scale-95"
            }`}
          >
            <Sparkles className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] sm:text-xs font-bold tracking-wide">Призыв</span>
          </button>
          <button
            type="button"
            onClick={() => setGachaMainTab("market")}
            className={`flex flex-col items-center justify-center gap-1 w-1/2 h-full rounded-xl transition-all duration-300 ${
              gachaMainTab === "market"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-inner"
                : "text-slate-400 hover:text-slate-300 hover:bg-white/5 active:scale-95"
            }`}
          >
            <Store className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] sm:text-xs font-bold tracking-wide">Маркет</span>
          </button>
        </div>
      </div>
      
      {/* Desktop Tab Buttons (Fixed at bottom) */}
      <div className="hidden md:flex fixed bottom-6 lg:bottom-8 left-1/2 -translate-x-1/2 z-40">
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/40 flex items-center justify-center p-1.5 gap-2">
          <button
            type="button"
            onClick={() => setGachaMainTab("gacha")}
            className={`flex items-center gap-2.5 px-8 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 ${
              gachaMainTab === "gacha"
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 shadow-lg shadow-indigo-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
            }`}
          >
            <Sparkles className="w-5 h-5" />
            Призыв и коллекция
          </button>
          <button
            type="button"
            onClick={() => setGachaMainTab("market")}
            className={`flex items-center gap-2.5 px-8 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 ${
              gachaMainTab === "market"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
            }`}
          >
            <Store className="w-5 h-5" />
            Маркет
          </button>
        </div>
      </div>
    </div>
  )
}