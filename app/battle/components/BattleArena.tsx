import React, { useState, useEffect, useRef } from "react"
import { Swords, ArrowRight, BookOpen, Clock, Zap, X, TrendingUp, TrendingDown, Crown } from "lucide-react"
import { BattleZone, CCGBattleState, CardRole, Card, DeckContext } from "../types"
import { getCardBasePower, getCardRole, getDeckPowerModifier, getTerritoryBuff } from "../utils"
import { BattleCard } from "./BattleCard"
import { rarityConfig } from "@/types/gacha"

interface BattleArenaProps {
  ccgState: CCGBattleState | null
  placedThisRound: { cardId: string; zoneId: string; isSecret: boolean }[]
  aiPlacedThisRound: { cardId: string; zoneId: string; isSecret: boolean }[]
  isRoundConfirmed: boolean
  playCardToZone: (cardId: string, zoneId: string) => void
  recallCard: (cardId: string) => void
  confirmRoundPlacement: () => void
  nextRound: () => void
  finishBattle: () => void
  setBattleState: (state: "idle" | "loading" | "battle" | "result") => void
  deckContext?: DeckContext
  onCardEffect?: (cardId: string, type: 'buff' | 'debuff' | 'synergy' | 'knb-win' | 'knb-loss') => void
  onCardDestroy?: (cardId: string) => void
  onModifierActivate?: (zoneId: string) => void
  onFloatingText?: (text: string, x: number, y: number, isPositive: boolean) => void
}

export const BattleArena: React.FC<BattleArenaProps> = ({
  ccgState,
  placedThisRound,
  aiPlacedThisRound,
  isRoundConfirmed,
  playCardToZone,
  recallCard,
  confirmRoundPlacement,
  nextRound,
  finishBattle,
  setBattleState,
  deckContext,
  onCardEffect,
  onCardDestroy,
  onModifierActivate,
  onFloatingText,
}) => {
  const [showRules, setShowRules] = useState(false)
  const [activeTerrain, setActiveTerrain] = useState<{ nameRu: string; description: string } | null>(null)
  const [draggedCardId, setDraggedCardId] = useState<string | null>(null)
  const [touchDragCard, setTouchDragCard] = useState<{ cardId: string; startX: number; startY: number } | null>(null)
  const [touchDragPosition, setTouchDragPosition] = useState<{ x: number; y: number } | null>(null)
  const [draggedZoneCardId, setDraggedZoneCardId] = useState<string | null>(null)
  const [viewedCard, setViewedCard] = useState<{ card: any; isPlayer: boolean; power?: number; bonus?: number; synergyBonus?: number; formationBonus?: number; zoneModifier?: any } | null>(null)
  
  // Animation states
  const [animatingCards, setAnimatingCards] = useState<Set<string>>(new Set())
  const [revealingCards, setRevealingCards] = useState<Set<string>>(new Set())
  const [powerAnimations, setPowerAnimations] = useState<Map<string, { from: number; to: number }>>(new Map())
  const [zoneAnimations, setZoneAnimations] = useState<Set<string>>(new Set())
  const [phaseTransition, setPhaseTransition] = useState(false)
  const [recallingCards, setRecallingCards] = useState<Set<string>>(new Set())
  const [destroyingCards, setDestroyingCards] = useState<Set<string>>(new Set())
  const [floatingTexts, setFloatingTexts] = useState<Array<{ id: string; text: string; x: number; y: number; color: string; isPositive: boolean }>>([])
  const [modifierActivations, setModifierActivations] = useState<Set<string>>(new Set())
  const [cardEffects, setCardEffects] = useState<Map<string, { type: 'buff' | 'debuff' | 'synergy' | 'knb-win' | 'knb-loss' }>>(new Map())
  const [drawingCards, setDrawingCards] = useState<Set<string>>(new Set())
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const floatingTextIdRef = useRef(0)
  const previousHandRef = useRef<string[]>([])

  if (!ccgState) return null

  const isPlacement = ccgState.phase === "placement"
  const isReveal = ccgState.phase === "reveal"
  const isFinalizing = ccgState.phase === "finalizing"

  // Trigger placement animation when cards are placed
  useEffect(() => {
    if (placedThisRound.length > 0) {
      const newCardIds = placedThisRound.map(p => p.cardId)
      setAnimatingCards(prev => new Set([...prev, ...newCardIds]))
      
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = setTimeout(() => {
        setAnimatingCards(new Set())
      }, 500)
    }
  }, [placedThisRound])

  // Trigger reveal animation when phase changes to reveal
  useEffect(() => {
    if (isReveal) {
      setPhaseTransition(true)
      setRevealingCards(new Set())
      
      // Animate secret cards revealing
      const secretCards = ccgState.zones.flatMap(zone => 
        [...zone.playerCards, ...zone.aiCards]
          .filter(zc => zc.wasSecret)
          .map(zc => zc.card.uniqueId)
      )
      
      setRevealingCards(new Set(secretCards))
      
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = setTimeout(() => {
        setRevealingCards(new Set())
        setPhaseTransition(false)
      }, 800)
    }
  }, [ccgState.phase, ccgState.round])

  // Trigger zone ownership animation
  useEffect(() => {
    if (isReveal) {
      const ownedZones = ccgState.zones.filter(z => z.owner !== "none").map(z => z.id)
      setZoneAnimations(new Set(ownedZones))
      
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = setTimeout(() => {
        setZoneAnimations(new Set())
      }, 1000)
    }
  }, [ccgState.zones, isReveal])

  // Trigger card draw animation when hand changes (new cards drawn)
  useEffect(() => {
    if (ccgState && ccgState.hand.length > 0) {
      const currentHandIds = ccgState.hand.map(c => c.uniqueId)
      const previousHandIds = previousHandRef.current
      
      // Find cards that are in current hand but not in previous hand
      const newCardIds = currentHandIds.filter(id => !previousHandIds.includes(id))
      
      if (newCardIds.length > 0) {
        setDrawingCards(new Set(newCardIds))
        
        if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
        animationTimeoutRef.current = setTimeout(() => {
          setDrawingCards(new Set())
        }, 400)
      }
      
      // Update previous hand ref
      previousHandRef.current = currentHandIds
    }
  }, [ccgState?.hand, ccgState?.round])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
    }
  }, [])

  // Helper function to add floating text
  const addFloatingText = (text: string, x: number, y: number, isPositive: boolean) => {
    if (onFloatingText) {
      onFloatingText(text, x, y, isPositive)
    } else {
      const id = `float-${floatingTextIdRef.current++}`
      const color = isPositive ? 'text-emerald-400' : 'text-rose-400'
      setFloatingTexts(prev => [...prev, { id, text, x, y, color, isPositive }])
      
      setTimeout(() => {
        setFloatingTexts(prev => prev.filter(t => t.id !== id))
      }, 1000)
    }
  }

  // Helper function to trigger card effect animation
  const triggerCardEffect = (cardId: string, type: 'buff' | 'debuff' | 'synergy' | 'knb-win' | 'knb-loss') => {
    if (onCardEffect) {
      onCardEffect(cardId, type)
    } else {
      setCardEffects(prev => new Map(prev).set(cardId, { type }))
      setTimeout(() => {
        setCardEffects(prev => {
          const next = new Map(prev)
          next.delete(cardId)
          return next
        })
      }, 600)
    }
  }

  // Helper function to trigger modifier activation
  const triggerModifierActivation = (zoneId: string) => {
    if (onModifierActivate) {
      onModifierActivate(zoneId)
    } else {
      setModifierActivations(prev => new Set(prev).add(zoneId))
      setTimeout(() => {
        setModifierActivations(prev => {
          const next = new Set(prev)
          next.delete(zoneId)
          return next
        })
      }, 500)
    }
  }

  // Trigger card destruction animation
  const triggerCardDestruction = (cardId: string) => {
    if (onCardDestroy) {
      onCardDestroy(cardId)
    } else {
      setDestroyingCards(prev => new Set(prev).add(cardId))
      setTimeout(() => {
        setDestroyingCards(prev => {
          const next = new Set(prev)
          next.delete(cardId)
          return next
        })
      }, 600)
    }
  }

  const handleZoneClick = (zoneId: string) => {
    // Zone click only for drag-drop, no selection mode
  }

  const handleDragStart = (e: React.DragEvent, cardId: string) => {
    if (!isPlacement || isRoundConfirmed) {
      e.preventDefault()
      return
    }
    setDraggedCardId(cardId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleDragOver = (e: React.DragEvent, zoneId: string) => {
    if (!isPlacement || !draggedCardId) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
  }

  const handleDrop = (e: React.DragEvent, zoneId: string) => {
    if (!isPlacement || !draggedCardId) return
    e.preventDefault()
    playCardToZone(draggedCardId, zoneId)
    setDraggedCardId(null)
  }

  const handleDragEnd = () => {
    setDraggedCardId(null)
  }

  const handleTouchStart = (e: React.TouchEvent, cardId: string) => {
    if (!isPlacement || isRoundConfirmed) return
    const touch = e.touches[0]
    setTouchDragCard({
      cardId,
      startX: touch.clientX,
      startY: touch.clientY
    })
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchDragCard) return
    const touch = e.touches[0]
    setTouchDragPosition({
      x: touch.clientX,
      y: touch.clientY
    })
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchDragCard) return

    const touch = e.changedTouches[0]
    const element = document.elementFromPoint(touch.clientX, touch.clientY)
    if (element) {
      const zoneElement = element.closest('[data-zone-id]')
      if (zoneElement) {
        const zoneId = zoneElement.getAttribute('data-zone-id')
        if (zoneId) {
          playCardToZone(touchDragCard.cardId, zoneId)
        }
      } else {
        // Если сбросили не на зону - возвращаем карту в руку с анимацией
        const isZoneCard = placedThisRound.some(p => p.cardId === touchDragCard.cardId)
        if (isZoneCard) {
          setRecallingCards(prev => new Set([...prev, touchDragCard.cardId]))
          setTimeout(() => {
            recallCard(touchDragCard.cardId)
            setRecallingCards(prev => {
              const newSet = new Set(prev)
              newSet.delete(touchDragCard.cardId)
              return newSet
            })
          }, 300)
        }
      }
    }

    setTouchDragCard(null)
    setTouchDragPosition(null)
  }

  const handleZoneCardDragStart = (e: React.DragEvent, cardId: string) => {
    if (!isPlacement || isRoundConfirmed) {
      e.preventDefault()
      return
    }
    setDraggedZoneCardId(cardId)
    e.dataTransfer.effectAllowed = "move"
  }

  const handleZoneCardDragEnd = (e: React.DragEvent) => {
    if (!draggedZoneCardId) return

    // Проверяем, сбросили ли на зону
    const element = document.elementFromPoint(e.clientX, e.clientY)
    if (element) {
      const zoneElement = element.closest('[data-zone-id]')
      if (!zoneElement) {
        // Если сбросили не на зону - возвращаем карту в руку с анимацией
        setRecallingCards(prev => new Set([...prev, draggedZoneCardId]))
        setTimeout(() => {
          recallCard(draggedZoneCardId)
          setRecallingCards(prev => {
            const newSet = new Set(prev)
            newSet.delete(draggedZoneCardId)
            return newSet
          })
        }, 300)
      }
    }

    setDraggedZoneCardId(null)
  }

  const handleZoneCardTouchStart = (e: React.TouchEvent, cardId: string) => {
    if (!isPlacement || isRoundConfirmed) return
    const touch = e.touches[0]
    setTouchDragCard({
      cardId,
      startX: touch.clientX,
      startY: touch.clientY
    })
  }

  const handleCardView = (card: any, isPlayer: boolean, power?: number, bonus?: number, isSecret?: boolean, synergyBonus?: number, wasSecret?: boolean, zoneModifier?: any) => {
    if (isSecret) return // Don't view secret cards
    
    // Calculate formation bonus for player cards
    let formationBonus = 0
    if (isPlayer && deckContext) {
      formationBonus = getDeckPowerModifier(card, deckContext, wasSecret || false)
    }
    
    setViewedCard({ card, isPlayer, power, bonus, synergyBonus, formationBonus, zoneModifier })
  }

  const getZoneLiveScores = (zone: BattleZone) => {
    let playerPower = zone.playerCards.reduce((acc, zc) => acc + zc.powerAfterModifier, 0)
    placedThisRound.forEach(p => {
      if (p.zoneId === zone.id) {
        const card = ccgState.hand.find(c => c.uniqueId === p.cardId)
        if (card) playerPower += getCardBasePower(card)
      }
    })

    const aiPower = zone.aiCards.reduce((acc, zc) => {
      if (zc.isSecret && isPlacement) return acc
      return acc + zc.powerAfterModifier
    }, 0)

    return { playerPower, aiPower }
  }

  // Calculate overall match score
  const getMatchScore = () => {
    let playerZones = 0
    let aiZones = 0
    ccgState.zones.forEach(zone => {
      if (zone.owner === "player") playerZones++
      if (zone.owner === "ai") aiZones++
    })
    return { playerZones, aiZones }
  }

  const matchScore = getMatchScore()
  const isPlayerLeading = matchScore.playerZones > matchScore.aiZones
  const isAiLeading = matchScore.aiZones > matchScore.playerZones
  const isTied = matchScore.playerZones === matchScore.aiZones

  return (
    <div className="w-full max-w-md mx-auto lg:max-w-4xl h-[100dvh] bg-[#05050a] text-white flex flex-col justify-between overflow-hidden relative select-none overscroll-none touch-none">
      {/* Декоративное космическое свечение на фоне */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(99,102,241,0.08),transparent_70%)] pointer-events-none" />

      {/* ВЕРХНЯЯ ИНФО-ПАНЕЛЬ */}
      <header className="px-2.5 sm:px-4 py-2 sm:py-3 bg-slate-950/60 border-b border-white/5 backdrop-blur-md flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-0.5 sm:gap-1">
            <span className="text-[7px] sm:text-[9px] font-black uppercase text-indigo-400 tracking-wider">Раунд</span>
            <span className="text-[9px] sm:text-xs font-black text-white">{ccgState.round}</span>
            <span className="text-[8px] sm:text-[10px] text-slate-500">/3</span>
          </div>
          
          {/* MATCH SCORE INDICATOR */}
          {(isReveal || ccgState.round > 1) && (
            <div className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-xl sm:rounded-2xl border flex items-center gap-1 sm:gap-2 transition-all duration-300 ${
              isPlayerLeading 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : isAiLeading 
                ? 'bg-rose-500/10 border-rose-500/30' 
                : 'bg-slate-500/10 border-slate-500/30'
            }`}>
              {isPlayerLeading && <Crown className="w-2 h-2 sm:w-3 sm:h-3 text-emerald-400" />}
              <span className="text-[7px] sm:text-[9px] font-black uppercase text-slate-400 tracking-wider">Счёт</span>
              <span className={`text-[9px] sm:text-xs font-black ${isPlayerLeading ? 'text-emerald-400' : isAiLeading ? 'text-rose-400' : 'text-slate-300'}`}>
                {matchScore.playerZones}:{matchScore.aiZones}
              </span>
              {isAiLeading && <Crown className="w-2 h-2 sm:w-3 sm:h-3 text-rose-400" />}
            </div>
          )}
          
          <div className="text-[7px] sm:text-[9px] font-black uppercase tracking-widest flex items-center gap-1 sm:gap-1.5">
            <span className="relative flex h-1.5 w-1.5 sm:h-2 sm:w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPlacement ? 'bg-amber-400' : 'bg-indigo-400'}`}></span>
              <span className={`relative inline-flex rounded-full h-1.5 w-1.5 sm:h-2 sm:w-2 ${isPlacement ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
            </span>
            <span className={`${isPlacement ? 'text-amber-400' : 'text-indigo-400'}`}>
              {isPlacement ? 'План' : 'Вскр'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          <button
            onClick={() => setShowRules(!showRules)}
            className="p-1.5 sm:p-2 bg-white/5 active:scale-90 border border-white/5 rounded-lg sm:rounded-xl transition-all"
          >
            <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300" />
          </button>
          <button
            onClick={() => setBattleState("idle")}
            className="px-1.5 sm:px-3 py-1 sm:py-1.5 bg-rose-500/10 active:scale-90 text-rose-400 border border-rose-500/20 rounded-lg sm:rounded-xl transition-all text-[8px] sm:text-[10px] font-black uppercase"
          >
            Сдаться
          </button>
        </div>
      </header>

      {/* КРАТКИЙ СПРАВОЧНИК КНБ */}
      {showRules && (
        <div className="bg-slate-950/95 border-b border-white/10 p-3.5 absolute top-[52px] left-0 right-0 z-40 animate-in slide-in-from-top-3 duration-200">
          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-wider mb-2">🔥 Бонус ролей (КНБ): победитель получает +50% к силе!</h4>
          <div className="grid grid-cols-3 gap-1 text-[8px] font-extrabold text-center">
            <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
              🗡️ Авангард &gt; Плут
            </div>
            <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">
              🛡️ Страж &gt; Авангард
            </div>
            <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
              ⚡ Плут &gt; Стража
            </div>
          </div>
        </div>
      )}

      {/* ИГРОВОЕ ПОЛЕ ИЗ 3 ЛОКАЦИЙ (Вертикально адаптированная сетка) */}
      <main className="flex-1 p-2 flex flex-col justify-center gap-2 z-10">
        <div className="grid grid-cols-3 gap-1.5 lg:gap-3 h-full items-stretch max-h-[600px] lg:max-h-[850px]">
          {ccgState.zones.map((zone) => {
            const { playerPower, aiPower } = getZoneLiveScores(zone)
            const playerPendingOnThisZone = placedThisRound
              .filter(p => p.zoneId === zone.id)
              .map(p => ({
                card: ccgState.hand.find(c => c.uniqueId === p.cardId),
                isSecret: p.isSecret
              }))

            const aiPendingOnThisZone = aiPlacedThisRound
              .filter(p => p.zoneId === zone.id)
              .map(p => ({
                card: ccgState.aiHand.find(c => c.uniqueId === p.cardId),
                isSecret: p.isSecret
              }))

            const hasWon = zone.owner === "player"
            const hasLost = zone.owner === "ai"
            const isAnimating = zoneAnimations.has(zone.id)

            // Стилизованное свечение локаций с анимацией
            const statusGlow = 
              hasWon && isReveal
                ? `border-emerald-500/50 bg-emerald-950/30 ${isAnimating ? 'animate-pulse' : ''}`
                : hasLost && isReveal
                ? `border-rose-500/50 bg-rose-950/30 ${isAnimating ? 'animate-pulse' : ''}`
                : playerPower > aiPower
                ? 'border-emerald-500/30 bg-emerald-950/10'
                : aiPower > playerPower
                ? 'border-rose-500/30 bg-rose-950/10'
                : "border-white/10 bg-white/[0.02] hover:border-white/20"

            return (
              <div
                key={zone.id}
                data-zone-id={zone.id}
                onClick={() => handleZoneClick(zone.id)}
                onDragOver={(e) => handleDragOver(e, zone.id)}
                onDrop={(e) => handleDrop(e, zone.id)}
                className={`relative rounded-xl p-2 transition-all flex flex-col justify-between border ${
                  isPlacement && (draggedCardId || touchDragCard)
                    ? "cursor-pointer ring-2 ring-indigo-500/30 bg-indigo-500/5"
                    : statusGlow
                }`}
              >
                {/* КАРТЫ ПРОТИВНИКА (Сверху локации) */}
                <div className="flex-1 flex flex-col justify-start min-h-[80px] gap-1">
                  <div className={`flex justify-between items-center px-1.5 text-[9px] font-bold uppercase transition-all duration-300 ${
                    aiPower > playerPower ? 'text-rose-400 scale-105' : 'text-rose-400/70'
                  }`}>
                    <span className="flex items-center gap-1">
                      {aiPower > playerPower && <TrendingUp className="w-3 h-3" />}
                      Враг
                    </span>
                    <span className={`text-xs font-black ${aiPower > playerPower ? 'text-rose-400' : 'text-rose-400'}`}>
                      {aiPower}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 justify-items-center items-center">
                    {/* Карты из предыдущих раундов */}
                    {zone.aiCards.map((zc, idx) => {
                      const isRevealing = revealingCards.has(zc.card.uniqueId)
                      const isDestroying = destroyingCards.has(zc.card.uniqueId)
                      const cardEffect = cardEffects.get(zc.card.uniqueId)
                      return (
                        <div key={idx} className={`scale-[0.85] lg:scale-100 transition-all duration-500 ${
                          isRevealing ? 'animate-[flipIn_0.6s_ease-out]' : ''
                        } ${
                          isDestroying ? 'animate-cardDestroy' : ''
                        } ${
                          cardEffect?.type === 'buff' ? 'animate-powerBuff' : ''
                        } ${
                          cardEffect?.type === 'debuff' ? 'animate-powerDebuff' : ''
                        } ${
                          cardEffect?.type === 'synergy' ? 'animate-synergyGlow' : ''
                        } ${
                          cardEffect?.type === 'knb-win' ? 'animate-knbWin' : ''
                        } ${
                          cardEffect?.type === 'knb-loss' ? 'animate-knbLoss' : ''
                        }`}>
                          <BattleCard
                            card={zc.card}
                            size="sm"
                            isSecret={zc.isSecret && (!isReveal || ccgState.round < 3) && !isRevealing}
                            isPlayerCard={false}
                            powerValue={zc.powerAfterModifier}
                            roleMatchupBonus={zc.roleMatchupBonus}
                            synergyBonus={zc.synergyBonus}
                            isInteractive={true}
                            onClick={() => handleCardView(zc.card, false, zc.powerAfterModifier, zc.roleMatchupBonus, zc.isSecret && (!isReveal || ccgState.round < 3), zc.synergyBonus, zc.wasSecret, zone.modifier)}
                            forceHidden={zone.modifier.id === "dark_zone"}
                          />
                        </div>
                      )
                    })}
                    {/* Карты размещенные в этом раунде */}
                    {aiPendingOnThisZone.map((p, idx) => {
                      if (!p.card) return null
                      return (
                        <div key={`ai-pending-${idx}`} className="scale-[0.85] lg:scale-100">
                          <BattleCard
                            card={p.card}
                            size="sm"
                            isSecret={p.isSecret && (!isReveal || ccgState.round < 3)}
                            isPlayerCard={false}
                            isPending={true}
                            isInteractive={false}
                            forceHidden={zone.modifier.id === "dark_zone"}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ПОРТАЛ СИЛЫ И ИНФОРМАЦИИ (Центр локации) */}
                <div className="my-1.5 flex flex-col items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveTerrain({ nameRu: zone.modifier.nameRu, description: zone.modifier.description })
                    }}
                    className={`relative w-full py-2 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] flex flex-col items-center justify-center transition-all active:scale-95 ${
                      modifierActivations.has(zone.id) ? 'animate-modifierActivate' : ''
                    }`}
                  >
                    <div className="text-center w-full px-1">
                      <span className="text-[9px] font-bold uppercase tracking-wide text-slate-300 block truncate">
                        {zone.modifier.nameRu}
                      </span>
                    </div>
                  </button>
                </div>

                {/* КАРТЫ ИГРОКА (Снизу локации) */}
                <div className="flex-1 flex flex-col justify-end min-h-[80px] gap-1 border-t border-white/5 pt-1.5">
                  <div className="grid grid-cols-2 gap-1 justify-items-center items-center">
                    {zone.playerCards.map((zc, idx) => {
                      const isRevealing = revealingCards.has(zc.card.uniqueId)
                      const isDestroying = destroyingCards.has(zc.card.uniqueId)
                      const cardEffect = cardEffects.get(zc.card.uniqueId)
                      return (
                        <div key={idx} className={`scale-[0.85] lg:scale-100 transition-all duration-500 ${
                          isRevealing ? 'animate-[flipIn_0.6s_ease-out]' : ''
                        } ${
                          isDestroying ? 'animate-cardDestroy' : ''
                        } ${
                          cardEffect?.type === 'buff' ? 'animate-powerBuff' : ''
                        } ${
                          cardEffect?.type === 'debuff' ? 'animate-powerDebuff' : ''
                        } ${
                          cardEffect?.type === 'synergy' ? 'animate-synergyGlow' : ''
                        } ${
                          cardEffect?.type === 'knb-win' ? 'animate-knbWin' : ''
                        } ${
                          cardEffect?.type === 'knb-loss' ? 'animate-knbLoss' : ''
                        }`}>
                          <BattleCard
                            card={zc.card}
                            size="sm"
                            isSecret={zc.isSecret && (!isReveal || ccgState.round < 3) && !isRevealing}
                            powerValue={zc.powerAfterModifier}
                            roleMatchupBonus={zc.roleMatchupBonus}
                            synergyBonus={zc.synergyBonus}
                            isInteractive={true}
                            onClick={() => handleCardView(zc.card, true, zc.powerAfterModifier, zc.roleMatchupBonus, zc.isSecret && (!isReveal || ccgState.round < 3), zc.synergyBonus, zc.wasSecret, zone.modifier)}
                            forceHidden={zone.modifier.id === "dark_zone"}
                          />
                        </div>
                      )
                    })}

                    {playerPendingOnThisZone.map((p, idx) => {
                      if (!p.card) return null
                      const isAnimating = animatingCards.has(p.card.uniqueId)
                      const isRecalling = recallingCards.has(p.card.uniqueId)
                      return (
                        <div key={`pending-${idx}`} className={`scale-[0.85] lg:scale-100 transition-all duration-300 ${
                          isAnimating ? 'animate-[cardPlace_0.4s_ease-out]' : ''
                        } ${
                          isRecalling ? 'animate-cardRecall' : ''
                        }`}>
                          <BattleCard
                            card={p.card}
                            size="sm"
                            isSecret={p.isSecret && (!isReveal || ccgState.round < 3)}
                            isPlayerCard={true}
                            isPending={true}
                            draggable={isPlacement && !isRecalling}
                            onDragStart={handleZoneCardDragStart}
                            onDragEnd={handleZoneCardDragEnd}
                            onTouchStart={handleZoneCardTouchStart}
                            onTouchMove={handleTouchMove}
                            onTouchEnd={handleTouchEnd}
                            onRemove={() => {
                              setRecallingCards(prev => new Set([...prev, p.card!.uniqueId]))
                              setTimeout(() => {
                                recallCard(p.card!.uniqueId)
                                setRecallingCards(prev => {
                                  const newSet = new Set(prev)
                                  newSet.delete(p.card!.uniqueId)
                                  return newSet
                                })
                              }, 300)
                            }}
                            isInteractive={false}
                          />
                        </div>
                      )
                    })}
                  </div>
                  <div className={`flex justify-between items-center px-1.5 text-[9px] font-bold uppercase transition-all duration-300 ${
                    playerPower > aiPower ? 'text-emerald-400 scale-105' : 'text-emerald-400/70'
                  }`}>
                    <span className="flex items-center gap-1">
                      {playerPower > aiPower && <TrendingUp className="w-3 h-3" />}
                      Вы
                    </span>
                    <span className={`text-xs font-black ${playerPower > aiPower ? 'text-emerald-400' : 'text-emerald-400'}`}>
                      {playerPower}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </main>

      {/* ПЛАВАЮЩАЯ КНОПКА ЗАВЕРШЕНИЯ ХОДА СПРАВА */}
      <div className="fixed right-4 bottom-30 z-50 lg:absolute lg:right-6 lg:bottom-40">
        {isFinalizing ? (
          <button
            onClick={finishBattle}
            className="w-14 h-14 rounded-full bg-amber-500 text-white font-black text-sm transition-all active:scale-100 flex flex-col items-center justify-center animate-pulse"
          >
            <Crown className="w-5 h-5" />
            <span className="text-[9px] leading-none">Финиш</span>
          </button>
        ) : isPlacement ? (
          <button
            onClick={confirmRoundPlacement}
            disabled={placedThisRound.length < 2 || aiPlacedThisRound.length < 2}
            className="w-14 h-14 rounded-full bg-emerald-500 disabled:bg-slate-700 text-white disabled:text-slate-500 font-black text-sm transition-all active:scale-100 flex flex-col items-center justify-center"
          >
            <Swords className="w-5 h-5" />
            <span className="text-[9px] leading-none">
              {placedThisRound.length}/{aiPlacedThisRound.length}
            </span>
          </button>
        ) : (
          <button
            onClick={nextRound}
            className="w-14 h-14 rounded-full bg-indigo-500 text-white font-black text-sm transition-all active:scale-100 flex flex-col items-center justify-center"
          >
            <ArrowRight className="w-5 h-5" />
            <span className="text-[9px] leading-none">Далее</span>
          </button>
        )}
      </div>

      {/* ЗОНА РУКИ - ОТДЕЛЬНЫЙ БЛОК */}
      <div className="bg-slate-950/95 border-t border-white/10 px-3 pt-2 pb-5 backdrop-blur-2xl z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] shrink-0">
        <div className="max-w-md mx-auto lg:max-w-4xl w-full relative">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-[8px] text-slate-400 font-extrabold uppercase tracking-wider">
              Карт в руке ({ccgState.hand.length})
            </span>
          </div>
          
          {/* Отрендеренный веер карт */}
          <div className="flex items-center justify-center gap-2 lg:gap-4 py-3 px-2 overflow-visible min-h-[130px] lg:min-h-[160px]">
            {ccgState.hand.map((card, idx) => {
              const isPlaced = placedThisRound.some(p => p.cardId === card.uniqueId)
              const isDrawing = drawingCards.has(card.uniqueId)

              if (isPlaced) return null

              return (
                <div
                  key={card.uniqueId}
                  style={{
                    transform: "translateY(0) scale(1)",
                    zIndex: 10 + idx,
                  }}
                  className={`relative transition-all duration-300 ease-out shrink-0 hover:-translate-y-2 ${
                    isDrawing ? 'animate-cardDraw' : ''
                  }`}
                >
                  <BattleCard
                    card={card}
                    size="sm"
                    draggable={isPlacement && !isRoundConfirmed}
                    onDragStart={handleDragStart}
                    onDragEnd={() => {}}
                    onTouchStart={handleTouchStart}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                    onClick={() => handleCardView(card, true, getCardBasePower(card), 0, false, 0, false)}
                    isInteractive={true}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ВИЗУАЛЬНЫЙ ЭЛЕМЕНТ ПРИ TOUCH DRAG */}
      {touchDragCard && touchDragPosition && (() => {
        const card = ccgState.hand.find(c => c.uniqueId === touchDragCard.cardId)
        if (!card) return null
        return (
          <div
            className="fixed pointer-events-none z-50 opacity-80"
            style={{
              left: touchDragPosition.x - 52,
              top: touchDragPosition.y - 75,
              transform: 'scale(1.1) rotate(5deg)'
            }}
          >
            <BattleCard
              card={card}
              size="sm"
              isInteractive={false}
            />
          </div>
        )
      })()}

      {/* ПЛАВАЮЩИЙ ТЕКСТ ДЛЯ ИЗМЕНЕНИЙ СИЛЫ */}
      {floatingTexts.map(ft => (
        <div
          key={ft.id}
          className={`fixed pointer-events-none z-40 font-black text-sm ${ft.color} ${ft.isPositive ? 'animate-floatUp' : 'animate-floatDown'}`}
          style={{
            left: ft.x,
            top: ft.y,
          }}
        >
          {ft.text}
        </div>
      ))}

      {/* ПОДРОБНОЕ МОДАЛЬНОЕ ОКНО ЛОКАЦИИ ДЛЯ СМАРТФОНОВ */}
      {activeTerrain && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActiveTerrain(null)}
        >
          <div
            className="bg-[#0b0b14]/95 border border-white/10 rounded-3xl p-5 max-w-xs lg:max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveTerrain(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 text-slate-400 active:scale-90 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-yellow-400 text-xs font-black uppercase mb-3">
              <Zap className="w-4 h-4 animate-pulse" /> Эффект локации
            </div>
            <h3 className="text-base font-black text-white uppercase tracking-wider mb-2">
              {activeTerrain.nameRu}
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-semibold">
              {activeTerrain.description}
            </p>
          </div>
        </div>
      )}

      {/* МОДАЛЬНОЕ ОКНО ПРОСМОТРА КАРТЫ */}
      {viewedCard && (() => {
        const card = viewedCard.card
        const role: CardRole = card.role || getCardRole(card)
        const roleNames: Record<CardRole, string> = {
          vanguard: "Авангард",
          guard: "Страж",
          trickster: "Плут"
        }
        const roleBeats: Record<CardRole, string> = {
          vanguard: "Бьёт: Плут (+50%)",
          guard: "Бьёт: Авангард (+50%)",
          trickster: "Бьёт: Стража (+50%)"
        }
        const roleColors: Record<CardRole, string> = {
          vanguard: "text-rose-400 bg-rose-500/10 border-rose-500/20",
          guard: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
          trickster: "text-amber-400 bg-amber-500/10 border-amber-500/20"
        }
        
        // Calculate territory buff if zone modifier is available
        let territoryBuff = null
        if (viewedCard.zoneModifier) {
          territoryBuff = getTerritoryBuff(card, viewedCard.zoneModifier.id, false, 0)
        }
        
        return (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setViewedCard(null)}
          >
            <div
              className="bg-[#0b0b14]/95 border border-white/10 rounded-3xl p-5 max-w-lg lg:max-w-2xl w-full shadow-2xl relative animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setViewedCard(null)}
                className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 text-slate-400 active:scale-90 transition-colors hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
              
              <div className="flex gap-4">
                {/* КАРТА СЛЕВА */}
                <div className="flex flex-col items-center">
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase mb-3 ${roleColors[role]}`}>
                    {roleNames[role]}
                  </div>
                  <div className={`px-3 py-1.5 rounded-xl border text-xs font-black uppercase mb-3 bg-gradient-to-r ${rarityConfig[card.rarity as keyof typeof rarityConfig].color} text-white border-white/20`}>
                    {rarityConfig[card.rarity as keyof typeof rarityConfig].label}
                  </div>
                  <div className="text-[10px] font-bold uppercase mb-3">
                    {viewedCard.isPlayer ? (
                      <span className="text-emerald-400">Ваша карта</span>
                    ) : (
                      <span className="text-rose-400">Карта врага</span>
                    )}
                  </div>
                  <BattleCard
                    card={card}
                    size="lg"
                    showPower={true}
                    powerValue={viewedCard.power}
                    roleMatchupBonus={viewedCard.bonus}
                    synergyBonus={viewedCard.synergyBonus}
                    isInteractive={false}
                  />
                  <div className={`px-3 py-2 rounded-xl border mt-3 text-center text-[10px] font-black uppercase ${roleColors[role]}`}>
                    {roleBeats[role]}
                  </div>
                </div>

                {/* БАФЫ СПРАВА */}
                <div className="flex-1 flex flex-col justify-center gap-3">
                  {/* МОДИФИКАТОРЫ СИЛЫ */}
                  <div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Модификаторы силы</div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex flex-col items-center p-2 rounded-lg bg-white/5">
                        <span className="text-slate-400 font-bold text-[10px] uppercase">Базовая сила</span>
                        <span className="text-slate-300 font-black text-sm">{getCardBasePower(card)}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg bg-white/5">
                        <span className="text-slate-400 font-bold text-[10px] uppercase">Итоговая сила</span>
                        <span className="text-white font-black text-sm">{viewedCard.power ?? getCardBasePower(card)}</span>
                      </div>
                      {(viewedCard.bonus ?? 0) > 0 && (
                        <div className="flex flex-col items-center p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <span className="text-emerald-400 font-bold text-[10px] uppercase">КНБ</span>
                          <span className="text-emerald-300 font-black text-sm">+{Math.round((viewedCard.bonus ?? 0) * 100)}%</span>
                        </div>
                      )}
                      {(viewedCard.synergyBonus ?? 0) > 0 && (
                        <div className="flex flex-col items-center p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                          <span className="text-violet-400 font-bold text-[10px] uppercase">Синергия</span>
                          <span className="text-violet-300 font-black text-sm">+{viewedCard.synergyBonus}</span>
                        </div>
                      )}
                      {(viewedCard.formationBonus ?? 0) !== 0 && (
                        <div className="flex flex-col items-center p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                          <span className="text-cyan-400 font-bold text-[10px] uppercase">Формация</span>
                          <span className="text-cyan-300 font-black text-sm">{(viewedCard.formationBonus ?? 0) > 0 ? '+' : ''}{viewedCard.formationBonus}</span>
                        </div>
                      )}
                      {territoryBuff && territoryBuff.value !== 0 && (
                        <div className="flex flex-col items-center p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <span className="text-yellow-400 font-bold text-[10px] uppercase">Локация</span>
                          <span className="text-yellow-300 font-black text-sm">{territoryBuff.value > 0 ? '+' : ''}{territoryBuff.value}</span>
                        </div>
                      )}
                      {territoryBuff && territoryBuff.description && territoryBuff.description !== "0" && (
                        <div className="flex flex-col items-center p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 col-span-2">
                          <span className="text-orange-400 font-bold text-[10px] uppercase">Эффект локации</span>
                          <span className="text-orange-300 font-black text-sm">{territoryBuff.description}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* БАЗОВЫЕ СТАТЫ */}
                  <div>
                    <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-2">Базовые характеристики</div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="flex flex-col items-center p-2 rounded-lg bg-white/5">
                        <span className="text-slate-400 font-bold text-[10px] uppercase">HP</span>
                        <span className="text-white font-black text-sm">{card.stats.hp}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg bg-white/5">
                        <span className="text-slate-400 font-bold text-[10px] uppercase">ATK</span>
                        <span className="text-white font-black text-sm">{card.stats.atk}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg bg-white/5">
                        <span className="text-slate-400 font-bold text-[10px] uppercase">DEF</span>
                        <span className="text-white font-black text-sm">{card.stats.def}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg bg-white/5">
                        <span className="text-slate-400 font-bold text-[10px] uppercase">SPD</span>
                        <span className="text-white font-black text-sm">{card.stats.spd}</span>
                      </div>
                      <div className="flex flex-col items-center p-2 rounded-lg bg-white/5 col-span-2">
                        <span className="text-slate-400 font-bold text-[10px] uppercase">LUCK</span>
                        <span className="text-white font-black text-sm">{card.stats.luck}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}