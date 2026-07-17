import React, { useState, useRef, useEffect, useCallback, MouseEvent } from "react"
import { Loader2, Crown, RefreshCcw, Star, Swords } from "lucide-react"
import { CanvasImage } from "@/components/gacha/canvas-image"
import { frameNames, coatingNames, FrameOverlay, CoatingOverlay } from "@/components/gacha/card-modifiers"
import { getCardBasePower, getCardProvision } from "@/app/battle/utils"
import { Card } from "../types"
import { rarityConfig } from "@/types/gacha"
import { getProxiedSrc, handleImageError } from "../utils"
import { statLabels } from "../config"
import Image from "next/image"

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

interface InteractiveCardProps {
  card: Card
  forceFlipped?: boolean
}

export const InteractiveCard = ({ card, forceFlipped = false }: InteractiveCardProps) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isTouching, setIsTouching] = useState(false)
  const [isImageLoading, setIsImageLoading] = useState(true)
  const animationFrameRef = useRef<number | undefined>(undefined)
  const [showFlipHint, setShowFlipHint] = useState(false)
  const [isHintExiting, setIsHintExiting] = useState(false)
  const [isHintExpanded, setIsHintExpanded] = useState(false)
  const hintTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const hideHintTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [isRotating, setIsRotating] = useState(false)
  
  // Track loading state for each 3D layer
  const [layersLoaded, setLayersLoaded] = useState({ bg: false, char: false, vfx: false })
  const [imageStartedLoading, setImageStartedLoading] = useState(false)

  useEffect(() => {
    setIsFlipped(forceFlipped)
  }, [forceFlipped])

  useEffect(() => {
    setIsImageLoading(true)
    setImageStartedLoading(false)
    const timer = setTimeout(() => {
      setImageStartedLoading(true)
    }, 50)

    // Initialize layers loaded state - mark missing layers as already loaded
    setLayersLoaded({
      bg: !card.imageLayers?.[0],
      char: !card.imageLayers?.[1],
      vfx: !card.imageLayers?.[2]
    })

    // Fallback: hide spinner after 3 seconds for regular cards
    const fallbackTimer = setTimeout(() => {
      if (!card.imageLayers || !card.imageLayers.some(l => l)) {
        setIsImageLoading(false)
      }
    }, 3000)

    return () => {
      clearTimeout(timer)
      clearTimeout(fallbackTimer)
    }
  }, [card.imageUrl, card.uniqueId, card.imageLayers])
  
  useEffect(() => {
    if (!card.imageLayers || !card.imageLayers.some(l => l)) {
      return
    }
    
    const hasBg = !!card.imageLayers[0]
    const hasChar = !!card.imageLayers[1]
    const hasVfx = !!card.imageLayers[2]
    
    const allLoaded = 
      (!hasBg || layersLoaded.bg) &&
      (!hasChar || layersLoaded.char) &&
      (!hasVfx || layersLoaded.vfx)
    
    if (allLoaded) {
      setIsImageLoading(false)
    }
  }, [layersLoaded, card.imageLayers])

  useEffect(() => {
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current)
      hintTimeoutRef.current = null
    }
    if (hideHintTimeoutRef.current) {
      clearTimeout(hideHintTimeoutRef.current)
      hideHintTimeoutRef.current = null
    }

    setShowFlipHint(false)
    setIsHintExiting(false)
    setIsHintExpanded(false)

    hintTimeoutRef.current = setTimeout(() => {
      setShowFlipHint(true)
      setIsHintExiting(false)
      
      setTimeout(() => {
        setIsHintExpanded(true)
      }, 150)

      hideHintTimeoutRef.current = setTimeout(() => {
        setIsHintExpanded(false)
        
        setTimeout(() => {
          setIsHintExiting(true)
          setTimeout(() => {
            setShowFlipHint(false)
          }, 150)
        }, 150)
      }, 5000)
    }, 2000)

    return () => {
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current)
      }
      if (hideHintTimeoutRef.current) {
        clearTimeout(hideHintTimeoutRef.current)
      }
    }
  }, [card.uniqueId])

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
  }, [])

  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = undefined
      }
    }
  }, [])

  const handleMouseMove = useCallback((e: MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)

    setIsRotating(true)

    animationFrameRef.current = requestAnimationFrame(() => {
      const rect = cardRef.current?.getBoundingClientRect()
      if (!rect) return
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      setRotation({
        x: ((y - centerY) / centerY) * -8,
        y: ((x - centerX) / centerX) * 8
      })
      setIsHovered(true)
    })
  }, [])

  const handleMouseLeave = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = requestAnimationFrame(() => {
      setRotation({ x: 0, y: 0 })
      setIsHovered(false)
      setIsRotating(false)
    })
  }, [])

  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    setIsTouching(true)
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!cardRef.current || !isTouching) return
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)

    setIsRotating(true)

    animationFrameRef.current = requestAnimationFrame(() => {
      const rect = cardRef.current?.getBoundingClientRect()
      if (!rect) return
      const touch = e.touches[0]
      const x = touch.clientX - rect.left
      const y = touch.clientY - rect.top
      const centerX = rect.width / 2
      const centerY = rect.height / 2

      setRotation({
        x: ((y - centerY) / centerY) * -8,
        y: ((x - centerX) / centerX) * 8
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
      setIsRotating(false)
    })
  }, [])

  const highlightX = -rotation.y * 1.2
  const highlightY = rotation.x * 1.2

  const layerOffsets = [
    { x: rotation.y * 1.0, y: -rotation.x * 1.0 },
    { x: rotation.y * 2.5, y: -rotation.x * 2.5 },
    { x: rotation.y * 4.0, y: -rotation.x * 4.0 },
  ]

  return (
    <div 
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => setIsFlipped(!isFlipped)}
      className="relative w-[260px] sm:w-72 md:w-80 h-[380px] sm:h-[440px] md:h-[480px] max-w-[calc(100vw-2rem)] transition-transform duration-700 ease-out cursor-pointer"
      style={{
        transform: `perspective(1200px) rotateX(${rotation.x}deg) rotateY(${rotation.y + (isFlipped ? 180 : 0)}deg)`,
        transformStyle: "preserve-3d",
        touchAction: isTouching ? 'none' : 'auto',
        willChange: 'transform'
      }}
    >
      {/* FRONT SIDE */}
      <div 
        className={`absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] ${rarityConfig[card.rarity].bg} ${rarityConfig[card.rarity].glow} border-2 border-white/10`}
        style={{ 
          backfaceVisibility: "hidden",
          transformStyle: "preserve-3d",
          willChange: "transform"
        }}
      >
        {card.imageLayers && card.imageLayers.some(l => l) ? (
          <>
            <div className="absolute inset-0 rounded-[1.4rem] sm:rounded-[1.9rem] md:rounded-[2.4rem] overflow-hidden">
               <div className="absolute inset-0 scale-[1.1]">
                  {card.imageLayers[0] && (
                    <div 
                      className="absolute inset-0 w-full h-full transition-transform duration-100 ease-out"
                      style={{ 
                        transform: `translate3d(${layerOffsets[0].x}px, ${layerOffsets[0].y}px, 0) scale(1.05)`,
                        willChange: "transform"
                      }}
                    >
                      <Image
                        src={getProxiedSrc(card.imageLayers[0])}
                        alt={`${card.name} bg`}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 260px, (max-width: 1024px) 288px, 320px"
                        onLoad={() => setLayersLoaded(prev => ({ ...prev, bg: true }))}
                      />
                    </div>
                  )}
                  
               </div>
            </div>

            <div className="absolute inset-0 pointer-events-none" style={{ transformStyle: "preserve-3d" }}>
               {card.imageLayers[1] && (
                 /* Контейнер-ограничитель для персонажа: снизу обрезает по форме карты, сверху разрешает выход за границы */
                 <div 
                   className="absolute inset-x-0 bottom-0 top-[-200px] overflow-hidden rounded-b-[1.4rem] sm:rounded-b-[1.9rem] md:rounded-b-[2.4rem]"
                   style={{ transformStyle: "preserve-3d" }}
                 >
                   <div
                     className="absolute bottom-0 left-0 right-0 h-[380px] sm:h-[440px] md:h-[480px] transition-transform duration-100 ease-out z-30"
                     style={{
                       transform: `translate3d(${layerOffsets[1].x}px, ${layerOffsets[1].y}px, 50px) scale(1.08)`,
                       filter: "drop-shadow(0 20px 30px rgba(0,0,0,0.5))",
                       willChange: "transform",
                       /* Примечание: если вы хотите, чтобы низ обрезался резко по границе без плавного исчезновения, 
                          вы можете убрать или закомментировать свойства maskImage ниже */
                       maskImage: 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)',
                       WebkitMaskImage: 'linear-gradient(to bottom, black 0%, black 70%, transparent 100%)'
                     }}
                   >
                     <Image
                       src={getProxiedSrc(card.imageLayers[1])}
                       alt={`${card.name} char`}
                       fill
                       className="object-contain"
                       sizes="(max-width: 768px) 260px, (max-width: 1024px) 288px, 320px"
                       onLoad={() => setLayersLoaded(prev => ({ ...prev, char: true }))}
                     />
                   </div>
                 </div>
               )}

               {card.imageLayers[2] && (
                 <div
                   className="absolute inset-0 w-full h-full transition-transform duration-100 ease-out z-20 overflow-visible"
                   style={{
                     transform: `translate3d(${layerOffsets[2].x}px, ${layerOffsets[2].y}px, 80px) scale(1.15)`,
                     willChange: "transform",
                     opacity: 0.8
                   }}
                 >
                   <Image
                     src={getProxiedSrc(card.imageLayers[2])}
                     alt={`${card.name} vfx`}
                     fill
                     className="object-cover"
                     sizes="(max-width: 768px) 260px, (max-width: 1024px) 288px, 320px"
                     onLoad={() => setLayersLoaded(prev => ({ ...prev, vfx: true }))}
                   />
                 </div>
               )}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 rounded-[1.4rem] sm:rounded-[1.9rem] md:rounded-[2.4rem] overflow-hidden">
            <CanvasImage 
              src={getProxiedSrc(card.imageUrl)} 
              alt={card.name}
              className="absolute inset-0 w-full h-full scale-[1.02]"
              style={{ willChange: 'transform', transform: 'translateZ(0)' }}
              objectFit="cover"
              objectPosition={card.artPosition || { x: 50, y: 50 }}
              onError={(e) => handleImageError(e, card, false)}
              onLoad={() => setIsImageLoading(false)}
            />
          </div>
        )}
        
        {isImageLoading && imageStartedLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-20">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-white/80 animate-spin" />
              <span className="text-xs sm:text-sm text-white/60 font-medium">Загрузка арта...</span>
            </div>
          </div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/20 pointer-events-none" />
        
        <CoatingOverlay coating={card.coatingModifier} />
        <FrameOverlay frame={card.frameModifier} />
        
        <div 
          className="absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none"
          style={{ 
            background: `radial-gradient(circle at ${50 + highlightX}% ${50 + highlightY}%, rgba(255,255,255,0.15) 0%, transparent 50%)`,
            opacity: isHovered ? 1 : 0 
          }}
        />

        <div className={`absolute top-3 sm:top-4 md:top-5 inset-x-3 sm:inset-x-4 md:inset-x-5 flex justify-between items-start pointer-events-none z-10 transition-opacity duration-300 ${isRotating ? 'opacity-0' : 'opacity-100'}`}>
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <div className="px-2.5 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest backdrop-blur-md bg-black/40 border border-white/20 shadow-xl w-fit">
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
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-yellow-200" />
                {frameNames[card.frameModifier]}
              </div>
            )}
            {card.coatingModifier && (
              <div className="w-fit flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-cyan-600 to-cyan-400 text-cyan-950 shadow-lg border border-cyan-300">
                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-cyan-200" />
                {coatingNames[card.coatingModifier]}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md px-2.5 sm:px-3 py-1 rounded-full border border-white/20 shadow-xl shrink-0">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-[10px] sm:text-[11px] font-black text-white">{card.score.toFixed(1)}</span>
          </div>
        </div>

        <div className={`absolute bottom-3 sm:bottom-4 md:bottom-5 inset-x-3 sm:inset-x-4 md:inset-x-5 pointer-events-none z-10 transition-opacity duration-300 ${isRotating ? 'opacity-0' : 'opacity-100'}`}>
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
              <span className="text-[7px] sm:text-[8px] md:text-[9px] font-mono text-white/40 tracking-wider">ID: {card.uniqueId.length > 20 ? card.uniqueId.slice(-8) : card.uniqueId}</span>
              {card.packName && (
                <span className="text-[7px] sm:text-[8px] md:text-[9px] font-black text-indigo-300 uppercase tracking-widest truncate max-w-[60%] text-right">{card.packName}</span>
              )}
            </div>
            {showFlipHint && (
              <div className={`mt-1.5 overflow-hidden transition-all duration-150 ${isHintExiting ? 'max-h-0' : 'max-h-8'}`}>
                <div className={`text-center transition-opacity duration-150 ${isHintExpanded ? 'opacity-100' : 'opacity-0'}`}>
                  <p className="text-[7px] sm:text-[8px] font-black text-white/30 uppercase tracking-widest">Нажмите на карту чтобы перевернуть</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BACK SIDE (STATS) */}
      <div 
        className={`absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] p-5 sm:p-6 md:p-8 flex flex-col justify-between border-[3px] sm:border-4 ${rarityConfig[card.rarity].bg} ${rarityConfig[card.rarity].glow}`}
        style={{ 
          backfaceVisibility: "hidden", 
          transform: "rotateY(180deg)",
          borderColor: `rgba(${rarityConfig[card.rarity].rgb}, 0.5)`,
          willChange: "transform"
        }}
      >
        <div className="absolute top-3 right-3 sm:top-4 sm:right-4 md:top-5 md:right-5 flex items-center gap-1.5 z-20">
          <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">вес</span>
          <span className="text-sm sm:text-base font-black text-violet-400">{getCardProvision(card)}</span>
        </div>

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
          <div className="flex items-center justify-center gap-2">
            <Swords className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
            <span className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider">Общая сила</span>
            <span className="text-sm sm:text-base font-black text-amber-300">{getCardBasePower(card)}</span>
          </div>
          <div className="w-10 sm:w-14 h-10 sm:h-14 mx-auto rounded-full border-2 border-white/10 flex items-center justify-center bg-white/5 backdrop-blur-sm shadow-xl">
            <RefreshCcw className="w-4 sm:w-6 h-4 sm:h-6 text-white/40" />
          </div>
          <p className="text-[7px] sm:text-[9px] font-black text-white/40 uppercase tracking-widest leading-tight">Нажмите чтобы перевернуть</p>
        </div>
      </div>
    </div>
  )
}