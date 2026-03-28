"use client"

import { useState, useRef, MouseEvent, useCallback, useEffect } from "react"
import { Navbar } from "@/components/navbar"
import { FloatingNav } from "@/components/floating-nav"
import { Sparkles, Star, Heart, Loader2, X, ZoomIn, ExternalLink, RefreshCcw } from "lucide-react"
import { rollAnimeCharacter } from "./actions" 

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
  serialId: string
  name: string
  anime: string
  rarity: Rarity
  imageUrl: string
  originalUrl: string
  score: number
  shikiId: number
  characterId: number
  stats: CardStats
}

const rarityConfig: Record<Rarity, { color: string; bg: string; label: string; glow: string; fx: string; rgb: string }> = {
  trash: { color: "from-stone-500 to-stone-700", bg: "bg-stone-950", label: "Trash", glow: "shadow-stone-500/10", fx: "bg-gradient-to-br from-stone-400/10 to-transparent", rgb: "120, 113, 108" },
  common: { color: "from-slate-400 to-slate-500", bg: "bg-slate-900", label: "Common", glow: "shadow-slate-400/20", fx: "bg-gradient-to-br from-white/10 to-transparent", rgb: "148, 163, 184" },
  uncommon: { color: "from-emerald-400 to-teal-500", bg: "bg-emerald-950", label: "Uncommon", glow: "shadow-emerald-500/20", fx: "bg-gradient-to-br from-emerald-400/20 to-transparent", rgb: "52, 211, 153" },
  rare: { color: "from-blue-400 to-cyan-500", bg: "bg-cyan-950", label: "Rare", glow: "shadow-blue-500/30", fx: "bg-gradient-to-br from-blue-400/20 to-transparent", rgb: "34, 211, 238" },
  super_rare: { color: "from-indigo-400 to-blue-600", bg: "bg-indigo-950", label: "Super Rare", glow: "shadow-indigo-500/40", fx: "bg-gradient-to-br from-indigo-400/30 to-transparent", rgb: "129, 140, 248" },
  epic: { color: "from-purple-500 to-pink-500", bg: "bg-purple-950", label: "Epic", glow: "shadow-purple-500/50", fx: "bg-gradient-to-br from-purple-400/30 to-transparent", rgb: "192, 132, 252" },
  mythic: { color: "from-fuchsia-400 to-rose-500", bg: "bg-fuchsia-950", label: "Mythic", glow: "shadow-fuchsia-500/50", fx: "bg-gradient-to-br from-fuchsia-400/40 to-transparent", rgb: "232, 121, 249" },
  legendary: { color: "from-pink-400 to-rose-600", bg: "bg-pink-950", label: "Legendary", glow: "shadow-pink-500/60", fx: "bg-gradient-to-tr from-pink-300/40 via-transparent to-rose-300/40", rgb: "244, 114, 182" },
  ancient: { color: "from-amber-400 to-orange-500", bg: "bg-amber-950", label: "Ancient", glow: "shadow-amber-500/70", fx: "bg-gradient-to-tr from-amber-300/50 via-transparent to-yellow-300/40", rgb: "251, 191, 36" },
  divine: { color: "from-orange-400 to-red-500", bg: "bg-orange-950", label: "Divine", glow: "shadow-orange-500/80", fx: "bg-gradient-to-tr from-orange-400/50 via-transparent to-red-400/40", rgb: "251, 146, 60" },
  transcendent: { color: "from-red-500 to-rose-700", bg: "bg-red-950", label: "Transcendent", glow: "shadow-red-500/90", fx: "bg-gradient-to-tr from-red-400/60 via-transparent to-rose-400/50", rgb: "248, 113, 113" },
  omnipotent: { color: "from-white via-yellow-200 to-amber-500", bg: "bg-zinc-900", label: "Omnipotent", glow: "shadow-white/100", fx: "bg-gradient-to-tr from-white/60 via-yellow-200/40 to-white/60", rgb: "255, 255, 255" },
}

const StatBar = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="w-full space-y-1">
    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-white/70">
      <span>{label}</span>
      <span>{value}</span>
    </div>
    <div className="h-1.5 w-full bg-black/40 rounded-full overflow-hidden border border-white/5">
      <div 
        className={`h-full bg-gradient-to-r ${color} transition-all duration-1000`} 
        style={{ width: `${value}%` }}
      />
    </div>
  </div>
)

const InteractiveCard = ({ card, forceFlipped = false }: { card: Card, forceFlipped?: boolean }) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
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

  const highlightX = -rotation.y * 1.2; 
  const highlightY = rotation.x * 1.2;

  return (
    <div 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={() => setIsFlipped(!isFlipped)}
      className="relative w-80 h-[480px] transition-transform duration-500 ease-out cursor-pointer"
      style={{
        transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y + (isFlipped ? 180 : 0)}deg)`,
        transformStyle: "preserve-3d",
      }}
    >
      {/* FRONT SIDE */}
      <div 
        className={`absolute inset-0 rounded-[2rem] overflow-hidden ${rarityConfig[card.rarity].bg} ${rarityConfig[card.rarity].glow}`}
        style={{ backfaceVisibility: "hidden" }}
      >
        <img 
          src={card.imageUrl} 
          alt={card.name}
          className="absolute inset-0 w-full h-full object-cover"
          referrerPolicy="no-referrer" 
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/50 to-transparent pointer-events-none" />
        <div className={`absolute inset-0 mix-blend-overlay opacity-30 pointer-events-none ${rarityConfig[card.rarity].fx}`} />

        <div 
          className="absolute inset-0 pointer-events-none rounded-[2rem]"
          style={{
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.2s ease-out',
            boxShadow: `
              inset ${highlightX}px ${highlightY}px 20px rgba(${rarityConfig[card.rarity].rgb}, 0.4), 
              inset ${highlightX * 0.3}px ${highlightY * 0.3}px 4px rgba(${rarityConfig[card.rarity].rgb}, 0.8),
              inset ${-highlightX * 0.4}px ${-highlightY * 0.4}px 12px rgba(0,0,0, 0.6)
            `
          }}
        />
        
        <div className="absolute bottom-0 inset-x-0 p-8 pointer-events-none">
          <div className="flex justify-between items-start mb-3">
            <div className={`inline-block px-3 py-1 rounded-full text-[10px] font-black uppercase bg-gradient-to-r ${rarityConfig[card.rarity].color} text-white shadow-lg`}>
              {rarityConfig[card.rarity].label}
            </div>
            <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md px-2 py-1 rounded-full border border-white/10">
              <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
              <span className="text-[10px] font-bold text-white">{card.score.toFixed(2)}</span>
            </div>
          </div>
          <h3 className="text-3xl font-black text-white uppercase leading-tight drop-shadow-md line-clamp-2">{card.name}</h3>
          <p className="text-slate-300 font-bold mb-4 drop-shadow-md text-sm line-clamp-1">{card.anime}</p>
          <div className="pt-4 border-t border-white/20 flex justify-between items-center backdrop-blur-sm">
            <span className="text-[10px] font-mono text-white/70">SHIKI-{card.shikiId}</span>
            <Heart className="w-5 h-5 text-pink-500 fill-pink-500" />
          </div>
        </div>
      </div>

      {/* BACK SIDE (STATS) */}
      <div 
        className={`absolute inset-0 rounded-[2rem] p-8 flex flex-col justify-between border-4 ${rarityConfig[card.rarity].bg} ${rarityConfig[card.rarity].glow}`}
        style={{ 
          backfaceVisibility: "hidden", 
          transform: "rotateY(180deg)",
          borderColor: `rgba(${rarityConfig[card.rarity].rgb}, 0.5)`
        }}
      >
        <div className={`absolute inset-0 opacity-10 ${rarityConfig[card.rarity].fx}`} />
        
        <div className="relative z-10 space-y-4">
          <div className="text-center pb-4 border-b border-white/10">
            <p className={`text-[10px] font-black uppercase tracking-tighter bg-gradient-to-r ${rarityConfig[card.rarity].color} bg-clip-text text-transparent`}>
              Character Attributes
            </p>
            <h4 className="text-xl font-black text-white uppercase truncate">{card.name}</h4>
          </div>

          <div className="space-y-5 pt-4">
            <StatBar label="Health Points" value={card.stats.hp} color={rarityConfig[card.rarity].color} />
            <StatBar label="Attack Power" value={card.stats.atk} color={rarityConfig[card.rarity].color} />
            <StatBar label="Defense" value={card.stats.def} color={rarityConfig[card.rarity].color} />
            <StatBar label="Speed" value={card.stats.spd} color={rarityConfig[card.rarity].color} />
            <StatBar label="Luck" value={card.stats.luck} color={rarityConfig[card.rarity].color} />
          </div>
        </div>

        <div className="relative z-10 text-center space-y-2">
           <div className="w-16 h-16 mx-auto rounded-full border-2 border-white/10 flex items-center justify-center bg-white/5">
              <RefreshCcw className="w-8 h-8 text-white/20" />
           </div>
           <p className="text-[10px] font-bold text-white/30 uppercase tracking-widest">Tap to flip back</p>
        </div>
      </div>
    </div>
  )
}

export default function GachaPage() {
  const[isRolling, setIsRolling] = useState(false)
  const [revealedCard, setRevealedCard] = useState<Card | null>(null)
  const [collectedCards, setCollectedCards] = useState<Card[]>([])
  const [showCard, setShowCard] = useState(false)
  const[viewedCard, setViewedCard] = useState<Card | null>(null)
  const [usedCharacterIds, setUsedCharacterIds] = useState<Set<number>>(new Set())

  useEffect(() => {
    const ids = new Set(collectedCards.map(card => card.characterId));
    setUsedCharacterIds(ids);
  }, [collectedCards]);

  const handleRoll = async () => {
    if (isRolling) return
    setIsRolling(true)
    setRevealedCard(null)
    setShowCard(false)

    try {
      const result = await rollAnimeCharacter(Array.from(usedCharacterIds))
      if (!result) throw new Error("Roll failed")

      const newCard: Card = {
        id: Date.now(),
        serialId: result.shikiId.toString(),
        name: result.characterName,
        anime: result.animeName,
        rarity: result.rarity as Rarity,
        imageUrl: result.imageUrl || '',
        originalUrl: result.originalUrl || '',
        score: result.score,
        shikiId: result.shikiId,
        characterId: result.characterId,
        stats: result.stats
      }

      setRevealedCard(newCard)
      setShowCard(true)
    } catch (error) {
      console.error("Gacha error:", error)
      alert("Connection failed. Try again!")
    } finally {
      setIsRolling(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 selection:bg-pink-500/30 font-sans">
      <Navbar />
      <FloatingNav />

      {viewedCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200">
          <button onClick={() => setViewedCard(null)} className="absolute top-8 right-8 p-3 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
          
          <div className="flex flex-col items-center animate-in zoom-in-95 duration-300">
            <InteractiveCard card={viewedCard} />
            <div className="flex gap-4 mt-8">
              <a href={viewedCard.originalUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-6 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white font-medium">
                <ZoomIn className="w-4 h-4" /> Original Art
              </a>
              <a href={`https://shikimori.one/animes/${viewedCard.shikiId}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 px-6 py-2 rounded-full bg-blue-500/20 hover:bg-blue-500/40 text-blue-200 font-medium">
                <ExternalLink className="w-4 h-4" /> Shikimori
              </a>
            </div>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-16">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 uppercase">
            Shikimori Gacha
          </h1>
          <p className="text-slate-400 text-lg font-medium">Flip the card to see battle attributes.</p>
        </div>

        <div className="flex flex-col items-center justify-center min-h-[550px] mb-24 relative">
          {!showCard && !isRolling && (
            <button onClick={handleRoll} className="group relative w-72 h-[420px] rounded-[2.5rem] border-2 border-dashed border-slate-700/50 bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center hover:border-indigo-500 transition-all">
              <Sparkles className="w-12 h-12 text-indigo-500 mb-4 animate-pulse" />
              <span className="font-black text-slate-500 group-hover:text-indigo-400 uppercase tracking-widest">Summon</span>
            </button>
          )}

          {isRolling && (
            <div className="w-72 h-[420px] rounded-[2.5rem] bg-slate-900/80 border border-slate-800 flex flex-col items-center justify-center">
              <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-6" />
              <p className="text-indigo-400 font-black animate-pulse uppercase tracking-widest text-sm">Searching Multiverse...</p>
            </div>
          )}

          {showCard && revealedCard && (
            <div className="flex flex-col items-center animate-in zoom-in-95 duration-500">
              <InteractiveCard card={revealedCard} />
              <div className="flex gap-4 mt-8">
                <button 
                  onClick={() => {
                    setCollectedCards(prev =>[revealedCard, ...prev]);
                    setUsedCharacterIds(prev => new Set(prev).add(revealedCard.characterId));
                    setShowCard(false);
                  }}
                  className="px-8 py-4 bg-white text-black font-black uppercase tracking-wider rounded-2xl hover:bg-indigo-500 hover:text-white transition-all"
                >
                  Keep Card
                </button>
                <button 
                  onClick={() => {
                    setUsedCharacterIds(prev => new Set(prev).add(revealedCard.characterId));
                    setShowCard(false);
                  }}
                  className="px-8 py-4 bg-slate-800/80 text-slate-300 font-bold uppercase tracking-wider rounded-2xl hover:bg-slate-700 transition-all"
                >
                  Discard
                </button>
              </div>
            </div>
          )}
        </div>

        {collectedCards.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-2xl font-black uppercase flex items-center gap-3">
              <Star className="w-6 h-6 text-yellow-500" />
              Collection ({collectedCards.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {collectedCards.map((card, i) => (
                <div 
                  key={i} 
                  onClick={() => setViewedCard(card)}
                  className={`aspect-[2/3] rounded-xl overflow-hidden border border-white/10 relative group bg-slate-900 cursor-pointer transition-transform hover:-translate-y-2 ${rarityConfig[card.rarity].glow}`}
                >
                  <img src={card.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={card.name} referrerPolicy="no-referrer" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-90" />
                  <div className={`absolute top-2 right-2 w-2.5 h-2.5 rounded-full bg-gradient-to-r ${rarityConfig[card.rarity].color} shadow-lg`} />
                  <div className="absolute bottom-0 inset-x-0 p-3">
                    <p className="text-[10px] font-bold text-slate-400 uppercase truncate">★{card.score.toFixed(1)} {card.anime}</p>
                    <p className="text-sm font-black text-white truncate">{card.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}