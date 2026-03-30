"use client"

import { useState, useRef, MouseEvent, useCallback, useEffect, useMemo } from "react"
import Image from "next/image"
import { Navbar } from "@/components/navbar"
import { Sparkles, Star, Heart, Loader2, X, ZoomIn, ExternalLink, RefreshCcw, Trash, Crown, Package, Coins, Search, Database } from "lucide-react"
import { rollAnimeCharacter, rollFromAnimePack, searchGachaPacks, createCustomGachaPack } from "./actions"
import { saveCardToDatabase, loadUserCards, deleteCardFromDatabase } from "./client-actions"
import { ANIME_PACKS, AnimePack, CustomAnimePack, createCustomPack, loadYearBasedPacks } from "@/lib/gacha-packs"
import { useCoins } from "@/hooks/use-coins"
import { GachaLoading } from "@/components/gacha-loading"
import { CollectionCardSkeleton } from "@/components/collection-skeleton"
import { PackCardSkeleton } from "@/components/pack-skeleton" 

export type Rarity = 
  | "trash" | "common" | "uncommon" | "rare" | "super_rare" | "epic" 
  | "mythic" | "legendary" | "ancient" | "divine" | "transcendent" | "omnipotent"

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
}

function generateCardUniqueId(characterId: number, packId?: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  const packPrefix = packId ? `pack-${packId}` : 'random';
  return `${packPrefix}-${characterId}-${timestamp}-${random}`;
}

const rarityConfig: Record<Rarity, { color: string; bg: string; label: string; glow: string; fx: string; rgb: string; weight: number }> = {
  trash: { color: "from-stone-500 to-stone-700", bg: "bg-stone-950", label: "Мусор", glow: "shadow-stone-500/10", fx: "bg-gradient-to-br from-stone-400/10 to-transparent", rgb: "120, 113, 108", weight: 1 },
  common: { color: "from-slate-400 to-slate-500", bg: "bg-slate-900", label: "Обычная", glow: "shadow-slate-400/20", fx: "bg-gradient-to-br from-white/10 to-transparent", rgb: "148, 163, 184", weight: 2 },
  uncommon: { color: "from-emerald-400 to-teal-500", bg: "bg-emerald-950", label: "Необычная", glow: "shadow-emerald-500/20", fx: "bg-gradient-to-br from-emerald-400/20 to-transparent", rgb: "52, 211, 153", weight: 3 },
  rare: { color: "from-blue-400 to-cyan-500", bg: "bg-cyan-950", label: "Редкая", glow: "shadow-blue-500/30", fx: "bg-gradient-to-br from-blue-400/20 to-transparent", rgb: "34, 211, 238", weight: 5 },
  super_rare: { color: "from-indigo-400 to-blue-600", bg: "bg-indigo-950", label: "Супер Редкая", glow: "shadow-indigo-500/40", fx: "bg-gradient-to-br from-indigo-400/30 to-transparent", rgb: "129, 140, 248", weight: 8 },
  epic: { color: "from-purple-500 to-pink-500", bg: "bg-purple-950", label: "Эпическая", glow: "shadow-purple-500/50", fx: "bg-gradient-to-br from-purple-400/30 to-transparent", rgb: "192, 132, 252", weight: 12 },
  mythic: { color: "from-fuchsia-400 to-rose-500", bg: "bg-fuchsia-950", label: "Мифическая", glow: "shadow-fuchsia-500/50", fx: "bg-gradient-to-br from-fuchsia-400/40 to-transparent", rgb: "232, 121, 249", weight: 18 },
  legendary: { color: "from-pink-400 to-rose-600", bg: "bg-pink-950", label: "Легендарная", glow: "shadow-pink-500/60", fx: "bg-gradient-to-tr from-pink-300/40 via-transparent to-rose-300/40", rgb: "244, 114, 182", weight: 25 },
  ancient: { color: "from-amber-400 to-orange-500", bg: "bg-amber-950", label: "Древняя", glow: "shadow-amber-500/70", fx: "bg-gradient-to-tr from-amber-300/50 via-transparent to-yellow-300/40", rgb: "251, 191, 36", weight: 35 },
  divine: { color: "from-orange-400 to-red-500", bg: "bg-orange-950", label: "Божественная", glow: "shadow-orange-500/80", fx: "bg-gradient-to-tr from-orange-400/50 via-transparent to-red-400/40", rgb: "251, 146, 60", weight: 50 },
  transcendent: { color: "from-red-500 to-rose-700", bg: "bg-red-950", label: "Трансцендентная", glow: "shadow-red-500/90", fx: "bg-gradient-to-tr from-red-400/60 via-transparent to-rose-400/50", rgb: "248, 113, 113", weight: 75 },
  omnipotent: { color: "from-white via-yellow-200 to-amber-500", bg: "bg-zinc-900", label: "Всемогущая", glow: "shadow-white/100", fx: "bg-gradient-to-tr from-white/60 via-yellow-200/40 to-white/60", rgb: "255, 255, 255", weight: 100 },
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

const InteractiveCard = ({ card, forceFlipped = false }: { card: Card, forceFlipped?: boolean }) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const[isTouching, setIsTouching] = useState(false)
  const animationFrameRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    setIsFlipped(forceFlipped)
  }, [forceFlipped])

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
          src={card.imageUrl} 
          alt={card.name}
          className="absolute inset-0 w-full h-full object-cover scale-[1.02]"
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 40vw"
          quality={80}
          priority={true}
          referrerPolicy="no-referrer"
          onError={(e) => handleImageError(e, card, false)}
        />
        
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/20 pointer-events-none" />
        
        <div className={`absolute inset-0 mix-blend-overlay opacity-50 pointer-events-none ${rarityConfig[card.rarity].fx}`} />

        <div 
          className="absolute inset-0 pointer-events-none rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem]"
          style={{
            opacity: (isHovered || isTouching) ? 1 : 0,
            transition: 'opacity 0.2s ease-out',
            boxShadow: `
              inset ${highlightX}px ${highlightY}px 20px rgba(${rarityConfig[card.rarity].rgb}, 0.4), 
              inset ${highlightX * 0.3}px ${highlightY * 0.3}px 4px rgba(${rarityConfig[card.rarity].rgb}, 0.8)
            `
          }}
        />

        {/* UI элементов - FRONT */}
        <div className="absolute top-3 sm:top-4 md:top-5 inset-x-3 sm:inset-x-4 md:inset-x-5 flex justify-between items-start pointer-events-none z-10">
          <div className="flex flex-col gap-2">
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
          </div>
          <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md px-2.5 sm:px-3 py-1 rounded-full border border-white/20 shadow-xl">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-[10px] sm:text-[11px] font-black text-white">{card.score.toFixed(1)}</span>
          </div>
        </div>

        <div className="absolute bottom-3 sm:bottom-4 md:bottom-5 inset-x-3 sm:inset-x-4 md:inset-x-5 pointer-events-none z-10">
          <div className="backdrop-blur-xl bg-slate-900/40 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-2xl relative overflow-hidden">
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${rarityConfig[card.rarity].color}`} />
            
            {card.isMainCharacter && card.isArtBlacklisted && (
              <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 flex items-center gap-1">
                <RefreshCcw className="w-2.5 h-2.5 text-red-400" />
                <span className="text-[8px] font-bold text-red-400 uppercase tracking-wider">Арт отклонен</span>
              </div>
            )}
            
            <h3 className="text-lg sm:text-xl md:text-2xl font-black text-white uppercase leading-none drop-shadow-lg truncate mb-1">
              {card.name}
            </h3>
            <p className="text-[9px] sm:text-[10px] md:text-xs text-white/70 font-bold uppercase tracking-wider truncate">
              {card.anime}
            </p>
            
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2">
              <span className="text-[8px] sm:text-[9px] font-mono text-white/40 tracking-wider">ID: {card.shikiId}</span>
              {card.packName && (
                <span className="text-[8px] sm:text-[9px] font-black text-indigo-300 uppercase tracking-widest">{card.packName}</span>
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
           <div className="w-12 sm:w-14 h-12 sm:h-14 mx-auto rounded-full border-2 border-white/10 flex items-center justify-center bg-white/5 backdrop-blur-sm shadow-xl">
              <RefreshCcw className="w-5 sm:w-6 h-5 sm:h-6 text-white/40" />
           </div>
           <p className="text-[8px] sm:text-[9px] font-black text-white/40 uppercase tracking-widest leading-tight">Нажмите чтобы перевернуть</p>
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
  const[usedCharacterIds, setUsedCharacterIds] = useState<Set<number>>(new Set())
  const { coins: userCoins, loading: coinsLoading, spendCoins, forceSync, fixOverflow } = useCoins()
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
  const[selectedCardForArtChange, setSelectedCardForArtChange] = useState<Card | null>(null)
  const[isChangingArt, setIsChangingArt] = useState(false)
  const [artChangeError, setArtChangeError] = useState<string | null>(null)
  const[isSyncingCoins, setIsSyncingCoins] = useState(false)
  const[isFixingCoins, setIsFixingCoins] = useState(false)
  const[isSavingCard, setIsSavingCard] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const[displayedCardsCount, setDisplayedCardsCount] = useState(60)

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
  
  const collectionRating = calculateCollectionRating(collectedCards)

  useEffect(() => {
    const loadSavedCards = async () => {
      if (isLoaded) return 
      
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        const savedCards = await loadUserCards()
        if (savedCards.length > 0) {
          setCollectedCards(savedCards)
          const ids = new Set(savedCards.map(card => card.characterId))
          setUsedCharacterIds(ids)
        }
      } else {
        try {
          const saved = localStorage.getItem('gacha-collection')
          if (saved) {
            const parsed = JSON.parse(saved)
            if (Array.isArray(parsed)) {
              setCollectedCards(parsed)
              const ids = new Set(parsed.map((c: Card) => c.characterId))
              setUsedCharacterIds(ids)
            }
          }
        } catch (e) {
          console.error('Error loading collection from localStorage:', e)
        }
      }
      setIsLoaded(true)
    }

    loadSavedCards()
  },[])

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
    const ids = new Set(collectedCards.map(card => card.characterId));
    setUsedCharacterIds(ids);
  }, [collectedCards]);

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
    setRevealedCard(null);
    setShowCard(false);
    setIsRolling(false);
    setViewedCard(null);
    setSearchQuery(""); 
    setShowPacks(false); 
  }, [selectedPack]);

  const handleRoll = async () => {
    if (isRolling) return
    setIsRolling(true)
    setRevealedCard(null)
    setShowCard(false)

    try {
      let result: Awaited<ReturnType<typeof rollAnimeCharacter>> | undefined;
      const ignored = blacklistedUrls;
      const expandChars = Array.from(expandPoolForCharacters);

      if (selectedPack) {
        if (userCoins < selectedPack.price) {
          alert("Недостаточно монет!");
          setIsRolling(false);
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 1500));
        result = await rollFromAnimePack(selectedPack, Array.from(usedCharacterIds), ignored, expandChars);

        if (result) {
          await spendCoins(selectedPack.price);
          forceSync().catch(error => console.warn('Background sync failed:', error));
          if (expandPoolForCharacters.has(result.characterId)) {
            setExpandPoolForCharacters(prev => {
              const next = new Set(prev);
              next.delete(result!.characterId);
              return next;
            });
          }
        }
      } else {
        if (userCoins < 50) {
          alert("Недостаточно монет! Обычная крутка стоит 50 монет.");
          setIsRolling(false);
          return;
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
        result = await rollAnimeCharacter(Array.from(usedCharacterIds), ignored, expandChars);

        if (result) {
          await spendCoins(50);
          forceSync().catch(error => console.warn('Background sync failed:', error));
          if (expandPoolForCharacters.has(result.characterId)) {
            setExpandPoolForCharacters(prev => {
              const next = new Set(prev);
              next.delete(result!.characterId);
              return next;
            });
          }
        }
      }
      
      if (!result) {
        let errorMessage = "Не удалось получить персонажа. Попробуйте снова!";
        if (selectedPack && usedCharacterIds.size >= 50) {
          const packCollectionRate = usedCharacterIds.size / (selectedPack.animeIds?.length * 5 || 50);
          if (packCollectionRate > 0.8) {
            errorMessage = `Вы собрали почти всех персонажей из пака "${selectedPack.name}"! Попробуйте выбрать другой пак или начните новую коллекцию.`;
          } else {
            errorMessage = "Многие персонажи уже собраны. Рекомендуется выбрать тематический пак для лучших результатов.";
          }
        } else if (usedCharacterIds.size > 500) {
          errorMessage = "Вы собрали слишком много персонажей! Попробуйте очистить коллекцию или выберите другой пак.";
        } else if (usedCharacterIds.size > 100) {
          errorMessage = "Многие персонажи уже собраны. Рекомендуется выбрать тематический пак для лучших результатов.";
        } else {
          errorMessage = "Не удалось получить персонажа. Возможно, проблемы с API Shikimori. Попробуйте снова через несколько секунд!";
        }
        throw new Error(errorMessage);
      }

      const newCard: Card = {
        id: Date.now(),
        uniqueId: generateCardUniqueId(result.characterId, (result as any).packId),
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
        packId: (result as any).packId,
        packName: (result as any).packName,
        isArtBlacklisted: result.isMainCharacter && blacklistedUrls.includes(result.imageUrl || '')
      }

      setRevealedCard(newCard)
      setShowCard(true)
    } catch (error) {
      console.error("Gacha error:", error)
      alert(`Ошибка: ${error instanceof Error ? error.message : "Неизвестная ошибка"}. Попробуйте снова!`)
    } finally {
      setIsRolling(false)
    }
  }

  const saveCard = async (card: Card) => {
    setIsSavingCard(true)
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()

      if (session) {
        const result = await saveCardToDatabase(card)
        if (result.success) {
          const isAlreadyCollected = collectedCards.some(c => c.uniqueId === card.uniqueId)
          if (!isAlreadyCollected) {
            setCollectedCards(prev =>[card, ...prev])
            setUsedCharacterIds(prev => new Set(prev).add(card.characterId))
          }
          setShowCard(false)
        } else {
          const savedCards = JSON.parse(localStorage.getItem('gacha-collection') || '[]')
          savedCards.unshift(card)
          localStorage.setItem('gacha-collection', JSON.stringify(savedCards))
          setCollectedCards(prev => [card, ...prev])
          setUsedCharacterIds(prev => new Set(prev).add(card.characterId))
          setShowCard(false)
        }
      } else {
        const savedCards = JSON.parse(localStorage.getItem('gacha-collection') || '[]')
        savedCards.unshift(card)
        localStorage.setItem('gacha-collection', JSON.stringify(savedCards))
        setCollectedCards(prev => [card, ...prev])
        setUsedCharacterIds(prev => new Set(prev).add(card.characterId))
        setShowCard(false)
      }
    } catch (error) {
      console.error('[saveCard] Error:', error)
      alert('Ошибка при сохранении карты')
    } finally {
      setIsSavingCard(false)
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

  const removeCard = async (cardToRemove: Card) => {
    try {
      const { supabase } = await import('@/lib/supabase')
      const { data: { session } } = await supabase.auth.getSession()
      
      if (session) {
        const result = await deleteCardFromDatabase(cardToRemove.uniqueId)
        if (!result.success) console.warn('[removeCard] Database delete failed')
      }
      
      try {
        const savedCards = JSON.parse(localStorage.getItem('gacha-collection') || '[]')
        const filteredCards = savedCards.filter((c: Card) => c.uniqueId !== cardToRemove.uniqueId)
        if (savedCards.length !== filteredCards.length) {
          localStorage.setItem('gacha-collection', JSON.stringify(filteredCards))
        }
      } catch (e) {
        console.error('Error removing card from localStorage:', e)
      }
      
      setCollectedCards(prev => prev.filter(card => card.uniqueId !== cardToRemove.uniqueId))
      setViewedCard(null)

      const isCardStillInCollection = collectedCards.some(card => 
        card.uniqueId !== cardToRemove.uniqueId && 
        card.characterId === cardToRemove.characterId
      )
      if (!isCardStillInCollection) {
        setUsedCharacterIds(prev => {
          const newSet = new Set(prev)
          newSet.delete(cardToRemove.characterId)
          return newSet
        })
      }
    } catch (error) {
      console.error('[removeCard] Error:', error)
      alert('Ошибка при удалении карты')
    }
  }

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

  const filteredAndSortedCards = (() => {
    let result = [...collectedCards]

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
        const aIsMain = a.isMainCharacter ? 1 : 0;
        const bIsMain = b.isMainCharacter ? 1 : 0;
        if (aIsMain !== bIsMain) return bIsMain - aIsMain; 
        const comparison = a.id - b.id;
        return sortOrder === "desc" ? -comparison : comparison;
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
        return sortOrder === "desc" ? -comparison : comparison
      }
    })

    return result
  })()

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
          className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setShowCustomPackCreator(false)}
        >
          <div 
            className="bg-slate-900 border border-slate-700/50 rounded-2xl sm:rounded-3xl p-5 sm:p-6 md:p-8 max-w-6xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6 sm:mb-8">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight mb-3">Создать Кастомный Пак</h2>
                {selectedAnimeIds.size > 0 && (
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-sm">
                    <div className="flex items-center gap-1.5 bg-yellow-500/10 border border-yellow-500/20 px-3 py-1.5 rounded-full">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span className="text-yellow-400 font-bold text-sm sm:text-base">
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
                        <div className="flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1.5 rounded-full">
                          <Star className="w-4 h-4 text-indigo-400" />
                          <span className="text-indigo-300 font-bold text-sm sm:text-base">
                            Гарант: {guaranteedRarity} <span className="text-indigo-400/70 font-normal">(1 из 10)</span>
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
                className="p-2 sm:p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/5 self-end sm:self-start shrink-0"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="mb-6 sm:mb-8">
              <label className="block text-sm font-bold text-slate-300 mb-2">
                Введите название аниме (например, "Титан", "Наруто", "Блич")
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Например: Атака титанов..."
                  value={customPackQuery}
                  onChange={(e) => setCustomPackQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateCustomPack()}
                  className="flex-1 h-12 sm:h-14 rounded-xl sm:rounded-2xl bg-slate-950/50 border border-slate-700/50 px-4 sm:px-5 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                />
                <button
                  onClick={handleCreateCustomPack}
                  disabled={isCreatingCustomPack || !customPackQuery.trim()}
                  className="h-12 sm:h-14 px-6 sm:px-8 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 disabled:border-slate-700 border border-indigo-500 disabled:cursor-not-allowed text-white font-bold rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center min-w-[120px]"
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
              <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-800/30 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm sm:text-base font-bold text-white">
                      Выбрано: <span className="text-indigo-400">{selectedAnimeIds.size}</span> из {customPackSearchResults.length}
                    </span>
                    {selectedAnimeIds.size > 0 && (
                      <span className="text-xs font-bold bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-1 rounded-md uppercase tracking-wider">
                        Готово
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={selectAllAnime}
                      className="px-4 py-2 text-xs sm:text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                    >
                      Выбрать все
                    </button>
                    <button
                      onClick={deselectAllAnime}
                      className="px-4 py-2 text-xs sm:text-sm font-bold bg-slate-700 hover:bg-slate-600 text-white rounded-xl transition-colors"
                    >
                      Снять все
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs sm:text-sm font-black text-slate-400 mb-4 uppercase tracking-widest">
                    Найденные аниме
                  </h4>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4 max-h-[400px] overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {customPackSearchResults.map(anime => (
                      <div 
                        key={anime.id} 
                        className={`relative rounded-xl overflow-hidden bg-slate-800/30 border transition-all duration-200 cursor-pointer hover:shadow-lg ${
                          selectedAnimeIds.has(anime.id) 
                            ? 'border-indigo-500 ring-2 ring-indigo-500/40 transform scale-[0.98]' 
                            : 'border-white/5 hover:border-white/20 hover:scale-[1.02]'
                        }`}
                        onClick={() => toggleAnimeSelection(anime.id)}
                      >
                        <div className="relative aspect-[2/3]">
                          <img 
                            src={getOptimizedThumbSrc(anime.imageUrl, 256, 60)} 
                            alt={anime.russian || anime.name} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer" 
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-80" />
                          <div className="absolute top-2 right-2">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                              selectedAnimeIds.has(anime.id)
                                ? 'bg-indigo-500 border-indigo-500 text-white shadow-lg shadow-indigo-500/50'
                                : 'bg-slate-900/50 border-white/30 text-transparent backdrop-blur-sm'
                            }`}>
                              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          </div>
                        </div>
                        <div className="absolute bottom-0 inset-x-0 p-2 sm:p-2.5">
                          <p className="text-[10px] sm:text-xs font-bold text-white leading-tight line-clamp-2">{anime.russian || anime.name}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                            <span className="text-[10px] sm:text-xs font-bold text-white/80">{typeof anime.score === 'number' ? anime.score.toFixed(1) : 'N/A'}</span>
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
                    className="w-full py-4 sm:py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black uppercase tracking-wider rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center gap-3"
                  >
                    {isCreatingCustomPack ? (
                      <GachaLoading message="Открытие набора..." />
                    ) : (
                      <>
                        <Package className="w-5 h-5" />
                        Создать пак ({selectedAnimeIds.size} аниме)
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {isCreatingCustomPack && (
              <div className="flex items-center justify-center py-16">
                <GachaLoading message="Поиск и сборка аниме..." />
              </div>
            )}

            {createdCustomPack && customPackSearchResults.length > 0 && (
              <div className="space-y-6">
                <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-indigo-900/40 to-slate-900 border border-indigo-500/30 animate-in fade-in slide-in-from-top-4 duration-300 shadow-xl">
                  <h3 className="text-2xl sm:text-3xl font-black text-white mb-2">{createdCustomPack.name}</h3>
                  <p className="text-sm sm:text-base text-indigo-200/80 mb-5">{createdCustomPack.description}</p>
                  
                  <div className="flex flex-wrap gap-3">
                    <div className="flex items-center gap-2 bg-slate-950/50 border border-white/10 px-4 py-2 rounded-xl shadow-inner">
                      <Coins className="w-5 h-5 text-yellow-400" />
                      <span className="text-sm sm:text-base font-black text-white">{createdCustomPack.price} монет</span>
                    </div>
                    {createdCustomPack.guaranteedRarity && (
                      <div className="flex items-center gap-2 bg-indigo-500/20 border border-indigo-500/30 px-4 py-2 rounded-xl">
                        <Star className="w-5 h-5 text-indigo-400" />
                        <span className="text-sm sm:text-base font-bold text-indigo-100">
                          Гарант: {rarityConfig[createdCustomPack.guaranteedRarity as Rarity].label}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleSelectCustomPack(createdCustomPack)}
                  disabled={userCoins < createdCustomPack.price}
                  className="w-full py-4 sm:py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-black uppercase tracking-wider rounded-xl sm:rounded-2xl transition-all shadow-lg shadow-indigo-500/25 flex items-center justify-center"
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
                    if (count === 0) return null
                    const percentage = Math.round((count / collectedCards.length) * 100)
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
                  <div
                    key={card.uniqueId}
                    className="aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative group bg-slate-900 cursor-pointer transition-all hover:scale-105 hover:shadow-xl hover:shadow-indigo-500/20"
                    onClick={() => {
                      setViewedCard(card)
                      setShowRatingModal(false)
                    }}
                  >
                    <img
                      src={getOptimizedThumbSrc(card.imageUrl, 384, 60)}
                      className="absolute inset-0 w-full h-full object-cover"
                      alt={card.name}
                      referrerPolicy="no-referrer"
                      onError={(e) => handleImageError(e, card, true)}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/30 to-transparent" />
                    <div className={`absolute top-2 right-2 w-3 h-3 rounded-full bg-gradient-to-r ${rarityConfig[card.rarity].color} shadow-lg border border-white/20`} />
                    <div className="absolute bottom-0 inset-x-0 p-2 sm:p-3">
                      <p className="text-[9px] sm:text-xs font-bold text-slate-300 truncate">{card.name}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" />
                        <span className="text-[9px] sm:text-xs font-bold text-white">{card.score.toFixed(1)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
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
            <InteractiveCard card={viewedCard} />
            
            <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 mt-8 sm:mt-10 w-full max-w-lg mx-auto">
              <button
                onClick={() => removeCard(viewedCard)}
                className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors border border-red-500/20"
              >
                <Trash className="w-4 h-4" /> <span className="hidden sm:inline">Удалить из коллекции</span><span className="sm:hidden">Удалить</span>
              </button>
              
              {viewedCard.isMainCharacter && viewedCard.isArtBlacklisted && (
                <button 
                  onClick={() => unblacklistArt(viewedCard)}
                  className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors border border-green-500/20"
                >
                  <RefreshCcw className="w-4 h-4" /> <span className="hidden sm:inline">Разблокировать арт</span><span className="sm:hidden">Разблокировать</span>
                </button>
              )}
              
              <a href={viewedCard.originalUrl} target="_blank" rel="noreferrer" className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors border border-slate-700">
                <ZoomIn className="w-4 h-4" /> <span className="hidden sm:inline">Оригинал</span>
              </a>
              
              <a href={`https://shikimori.one/animes/${viewedCard.shikiId}`} target="_blank" rel="noreferrer" className="px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 font-bold text-xs sm:text-sm flex items-center gap-2 transition-colors border border-blue-500/20">
                <ExternalLink className="w-4 h-4" /> <span className="hidden sm:inline">Шикимори</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16 max-w-7xl relative z-10">
        
        {/* Header Section */}
        <div className="text-center mb-10 sm:mb-16">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 uppercase drop-shadow-sm">
            WEEB.<span className="text-indigo-500">X</span> ГАЧА
          </h1>
          <p className="text-slate-400 text-sm sm:text-base md:text-lg font-medium max-w-2xl mx-auto">
            Призывай любимых персонажей и собирай уникальную коллекцию. Нажми на карту, чтобы увидеть характеристики.
          </p>
          
          <div className="flex justify-center items-center gap-3 sm:gap-4 mt-8">
            <div className="flex items-center gap-2.5 px-5 py-2.5 rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-xl shadow-yellow-500/5">
              <Coins className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400" />
              {coinsLoading ? (
                <Loader2 className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-400 animate-spin" />
              ) : (
                <span className="text-xl sm:text-2xl font-black text-yellow-400 tracking-tight">{userCoins.toLocaleString()}</span>
              )}
            </div>
            
            {userCoins > 1000000 && (
              <button
                onClick={handleFixCoins}
                disabled={isFixingCoins}
                className="flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed text-red-400 text-xs sm:text-sm font-bold transition-all border border-red-500/20"
                title="Исправить монеты"
              >
                <RefreshCcw className={`w-4 h-4 ${isFixingCoins ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{isFixingCoins ? 'Исправление...' : 'Испр. монеты'}</span>
              </button>
            )}
          </div>
        </div>

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
        <div className="flex flex-col items-center justify-center min-h-[400px] sm:min-h-[500px] mb-16 sm:mb-24 relative">
          
          {/* Initial Loading State */}
          {!isLoaded && (
            <div className="flex flex-col items-center w-full max-w-md mx-auto">
              <div className="w-64 sm:w-72 md:w-80 h-[380px] sm:h-[420px] md:h-[480px] rounded-[2rem] sm:rounded-[2.5rem] bg-slate-900/40 border border-slate-700/50 animate-pulse flex flex-col items-center justify-center relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950/40 opacity-50" />
                <div className="relative z-10 flex flex-col items-center gap-4">
                  <div className="w-16 h-16 border-3 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
                  <p className="text-slate-400 font-medium text-sm">Загрузка гачи...</p>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 w-full">
                <div className="flex-1 h-12 bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/50" />
                <div className="flex-1 h-12 bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/50" />
              </div>
            </div>
          )}
          
          {/* Default Empty State */}
          {isLoaded && !showCard && !isRolling && (
            <div className="flex flex-col items-center w-full max-w-md mx-auto">
              <button 
                onClick={handleRoll} 
                className="group relative w-64 sm:w-72 md:w-80 h-[380px] sm:h-[420px] md:h-[480px] rounded-[2rem] sm:rounded-[2.5rem] border-2 border-dashed border-slate-700/50 bg-slate-900/40 hover:bg-slate-800/60 backdrop-blur-md flex flex-col items-center justify-center hover:border-indigo-500/50 transition-all duration-300 overflow-hidden shadow-2xl"
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-indigo-500/5 group-hover:to-indigo-500/10 transition-colors" />
                <Sparkles className="w-10 sm:w-12 h-10 sm:h-12 text-indigo-500/70 group-hover:text-indigo-400 mb-5 animate-pulse" />
                <span className="font-black text-slate-400 group-hover:text-indigo-300 uppercase tracking-widest text-sm sm:text-base text-center px-4 relative z-10">
                  {selectedPack ? `Призвать (${selectedPack.price})` : "Призвать (50)"}
                </span>
              </button>
              
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6 sm:mt-8 w-full">
                <button
                  onClick={() => setShowPacks(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl transition-all shadow-lg text-sm sm:text-base"
                >
                  <Package className="w-5 h-5 text-indigo-400" />
                  Выбрать набор
                </button>

                <button
                  onClick={() => setShowCustomPackCreator(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl transition-all shadow-lg text-sm sm:text-base"
                >
                  <Search className="w-5 h-5 text-purple-400" />
                  Создать пак
                </button>
              </div>
            </div>
          )}

          {/* Rolling State */}
          {isRolling && (
            <div className="w-64 sm:w-72 md:w-80 h-[380px] sm:h-[420px] md:h-[480px] rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/30 flex flex-col items-center justify-center relative overflow-hidden shadow-2xl shadow-indigo-500/20">
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
              
              <div className="relative z-10 scale-125">
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
                  onClick={() => saveCard(revealedCard)}
                  disabled={isSavingCard}
                  className="flex-1 px-4 sm:px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-wider rounded-xl sm:rounded-2xl transition-all text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 border border-indigo-400/50"
                >
                  {isSavingCard ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Сохранение...
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
        ) : collectedCards.length > 0 ? (
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
                <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-5 sm:p-6 space-y-5 animate-in fade-in slide-in-from-top-2 duration-200 shadow-2xl">
                  
                  {/* Search Input */}
                  <div className="relative group">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-400 transition-colors" />
                    <input
                      type="text"
                      placeholder="Поиск по имени или аниме..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-12 rounded-xl bg-slate-950/50 border border-slate-700/50 pl-12 pr-12 text-sm sm:text-base text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all placeholder:text-slate-500"
                    />
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery("")}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors p-1 rounded-full hover:bg-white/10"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>

                  {/* Dropdowns Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Редкость</label>
                      <select
                        value={selectedRarity}
                        onChange={(e) => setSelectedRarity(e.target.value as Rarity | "all")}
                        className="w-full h-11 rounded-xl bg-slate-950/50 border border-slate-700/50 px-4 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      >
                        <option value="all">Все редкости</option>
                        {Object.entries(rarityConfig).map(([key, config]) => (
                          <option key={key} value={key}>{config.label}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Набор</label>
                      <select
                        value={selectedPackFilter}
                        onChange={(e) => setSelectedPackFilter(e.target.value)}
                        className="w-full h-11 rounded-xl bg-slate-950/50 border border-slate-700/50 px-4 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      >
                        <option value="all">Все наборы</option>
                        {getUniquePacks().map(packName => (
                          <option key={packName} value={packName}>{packName}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Тип героя</label>
                      <select
                        value={selectedMainCharacterFilter}
                        onChange={(e) => setSelectedMainCharacterFilter(e.target.value as typeof selectedMainCharacterFilter)}
                        className="w-full h-11 rounded-xl bg-slate-950/50 border border-slate-700/50 px-4 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      >
                        <option value="all">Все типы</option>
                        <option value="main">Главные герои</option>
                        <option value="supporting">Второстепенные</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Сортировка</label>
                      <select
                        value={sortBy}
                        onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                        className="w-full h-11 rounded-xl bg-slate-950/50 border border-slate-700/50 px-4 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      >
                        <option value="date">По дате получения</option>
                        <option value="rarity">По редкости</option>
                        <option value="score">По рейтингу</option>
                        <option value="name">По имени</option>
                        <option value="anime">По аниме</option>
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">Порядок</label>
                      <select
                        value={sortOrder}
                        onChange={(e) => setSortOrder(e.target.value as typeof sortOrder)}
                        className="w-full h-11 rounded-xl bg-slate-950/50 border border-slate-700/50 px-4 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                      >
                        <option value="desc">По убыванию</option>
                        <option value="asc">По возрастанию</option>
                      </select>
                    </div>
                  </div>

                  {/* Actions & Active Filters */}
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-4 border-t border-slate-700/50">
                    <div className="flex flex-wrap items-center gap-2">
                      {(searchQuery || selectedRarity !== "all" || selectedPackFilter !== "all" || selectedMainCharacterFilter !== "all") && (
                        <span className="text-xs font-bold text-slate-500 uppercase mr-2">Активные:</span>
                      )}
                      
                      {searchQuery && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs font-bold">
                          {searchQuery}
                          <button onClick={() => setSearchQuery("")} className="hover:text-white p-0.5"><X size={12} /></button>
                        </span>
                      )}
                      {selectedRarity !== "all" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-300 text-xs font-bold">
                          {rarityConfig[selectedRarity].label}
                          <button onClick={() => setSelectedRarity("all")} className="hover:text-white p-0.5"><X size={12} /></button>
                        </span>
                      )}
                      {selectedPackFilter !== "all" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500/10 border border-pink-500/20 text-pink-300 text-xs font-bold">
                          {selectedPackFilter}
                          <button onClick={() => setSelectedPackFilter("all")} className="hover:text-white p-0.5"><X size={12} /></button>
                        </span>
                      )}
                      {selectedMainCharacterFilter !== "all" && (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-xs font-bold">
                          {selectedMainCharacterFilter === "main" ? "Главные герои" : "Второстепенные"}
                          <button onClick={() => setSelectedMainCharacterFilter("all")} className="hover:text-white p-0.5"><X size={12} /></button>
                        </span>
                      )}
                    </div>
                    
                    <button
                      onClick={resetFilters}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl transition-all text-sm shrink-0 w-full sm:w-auto justify-center"
                    >
                      <RefreshCcw className="w-4 h-4" />
                      Сбросить
                    </button>
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
                  <div
                    key={card.uniqueId}
                    onClick={() => setViewedCard(card)}
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
                    />
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
        ) : null}
      </div>
    </div>
  )
}