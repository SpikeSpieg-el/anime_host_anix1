import React, { useState, useEffect, useRef } from "react"
import { Swords, ArrowRight, BookOpen, Clock, Zap, X, TrendingUp, Crown } from "lucide-react"
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragMoveEvent, useDraggable, useDroppable, pointerWithin, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { BattleZone, CCGBattleState, CardRole, Card, DeckContext } from "../types"
import { getCardBasePower, getCardRole, getDeckPowerModifier, getTerritoryBuff } from "../utils"
import { BattleCard } from "./BattleCard"
import { rarityConfig } from "@/types/gacha"

interface DraggableCardProps {
  card: Card
  cardId: string
  size: "sm" | "lg"
  isPlacement?: boolean
  source: 'hand' | 'zone'
  isSecret?: boolean
  isPlayerCard?: boolean
  isPending?: boolean
  isInteractive?: boolean
  idx?: number
  onClick?: () => void
  onRemove?: () => void
}

const DraggableCard: React.FC<DraggableCardProps> = ({
  card,
  cardId,
  size,
  isPlacement = false,
  source,
  isSecret = false,
  isPlayerCard = true,
  isPending = false,
  isInteractive = true,
  idx = 0,
  onClick,
  onRemove
}) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: cardId,
    data: { source },
    disabled: !isPlacement
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        transform: isDragging ? 'scale(1.1) rotate(3deg)' : '',
        zIndex: isDragging ? 1000 : 10 + idx,
        cursor: isPlacement ? 'grab' : 'default',
        opacity: isDragging ? 0.5 : 1
      }}
      className={`relative transition-all duration-200 ease-out shrink-0 transform-gpu will-change-transform ${
        isPlacement && !isDragging ? 'hover:-translate-y-2' : ''
      }`}
    >
      <BattleCard
        card={card}
        size={size}
        isSecret={isSecret}
        isPlayerCard={isPlayerCard}
        isPending={isPending}
        onClick={onClick}
        onRemove={onRemove}
        isInteractive={isInteractive}
      />
    </div>
  )
}

interface SortableCardProps {
  card: Card
  cardId: string
  size: "sm" | "lg"
  isPlacement?: boolean
  isInteractive?: boolean
  idx?: number
  onClick?: () => void
  fanStyle?: React.CSSProperties
}

const SortableCard: React.FC<SortableCardProps> = ({
  card,
  cardId,
  size,
  isPlacement = false,
  isInteractive = true,
  idx = 0,
  onClick,
  fanStyle
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: cardId })

  const springTransition = transition || 'transform 220ms cubic-bezier(0.18, 0.89, 0.32, 1.28)'

  const style: React.CSSProperties = {
    transform: transform
      ? `translate3d(${transform.x}px, ${transform.y}px, 0) ${fanStyle?.transform || ''}`
      : fanStyle?.transform,
    transformOrigin: fanStyle?.transformOrigin || 'bottom center',
    transition: springTransition,
    zIndex: isDragging ? 1000 : 10 + idx,
    cursor: isPlacement ? 'grab' : 'default',
    opacity: isDragging ? 0.15 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={style}
      className={`relative shrink-0 group transition-all duration-150 transform-gpu will-change-transform ${
        isPlacement && !isDragging ? 'hover:!z-[999]' : ''
      }`}
    >
      <div className={`transition-all duration-200 ease-out ${
        isPlacement && !isDragging 
          ? 'group-hover:-translate-y-8 group-hover:scale-110 group-hover:rotate-0' 
          : ''
      }`}>
        <BattleCard
          card={card}
          size={size}
          onClick={onClick}
          isInteractive={isInteractive}
        />
      </div>
    </div>
  )
}

interface ZoneDropZoneProps {
  zoneId: string
  isPlacement: boolean
  isDragging: boolean
  statusGlow: string
  children: React.ReactNode
}

const ZoneDropZone: React.FC<ZoneDropZoneProps> = ({
  zoneId,
  isPlacement,
  isDragging,
  statusGlow,
  children
}) => {
  const { setNodeRef, isOver } = useDroppable({
    id: zoneId,
    disabled: !isPlacement
  })

  return (
    <div
      ref={setNodeRef}
      className={`relative rounded-xl p-2 transition-all flex flex-col justify-between border transform-gpu will-change-transform ${
        isPlacement && isDragging
          ? isOver
            ? "ring-2 ring-emerald-500/50 bg-emerald-500/10"
            : "ring-2 ring-indigo-500/30 bg-indigo-500/5"
          : statusGlow
      }`}
    >
      {isPlacement && isDragging && (
        <div className="absolute inset-0 -m-4 pointer-events-none" />
      )}
      {children}
    </div>
  )
}

interface BattleArenaProps {
  ccgState: CCGBattleState | null
  placedThisRound: { cardId: string; zoneId: string; isSecret: boolean }[]
  aiPlacedThisRound: { cardId: string; zoneId: string; isSecret: boolean }[]
  isRoundConfirmed: boolean
  playCardToZone: (cardId: string, zoneId: string) => void
  recallCard: (cardId: string) => void
  reorganizeHand: (oldIndex: number, newIndex: number) => void
  moveCardBetweenZones: (cardId: string, newZoneId: string) => void
  confirmRoundPlacement: () => void
  nextRound: () => void
  updateScores: () => void
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
  reorganizeHand,
  moveCardBetweenZones,
  confirmRoundPlacement,
  nextRound,
  updateScores,
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
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [dragSource, setDragSource] = useState<'hand' | 'zone' | null>(null)
  const [viewedCard, setViewedCard] = useState<{ card: any; isPlayer: boolean; power?: number; bonus?: number; synergyBonus?: number; formationBonus?: number; zoneModifier?: any } | null>(null)
  
  // Убрали state dragTilt, чтобы не вызывать повторный рендеринг всей арены 60 раз в секунду
  const lastDragPos = useRef({ x: 0, y: 0 })
  const lastDragTime = useRef(Date.now())

  const [revealingCards, setRevealingCards] = useState<Set<string>>(new Set())
  const [zoneAnimations, setZoneAnimations] = useState<Set<string>>(new Set())
  const [phaseTransition, setPhaseTransition] = useState(false)
  const [recallingCards, setRecallingCards] = useState<Set<string>>(new Set())
  const [destroyingCards, setDestroyingCards] = useState<Set<string>>(new Set())
  const [floatingTexts, setFloatingTexts] = useState<Array<{ id: string; text: string; x: number; y: number; color: string; isPositive: boolean }>>([])
  const [modifierActivations, setModifierActivations] = useState<Set<string>>(new Set())
  const [cardEffects, setCardEffects] = useState<Map<string, { type: 'buff' | 'debuff' | 'synergy' | 'knb-win' | 'knb-loss' }>>(new Map())
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const floatingTextIdRef = useRef(0)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5
      }
    })
  )

  if (!ccgState) return null

  const isPlacement = ccgState.phase === "placement"
  const isReveal = ccgState.phase === "reveal"
  const isFinalizing = ccgState.phase === "finalizing"

  const getHandCardStyle = (idx: number, total: number) => {
    if (total <= 1) return {}
    const mid = (total - 1) / 2
    const offset = idx - mid
    const rotation = offset * 5 
    const translateY = Math.abs(offset) * 3.5 
    const translateX = offset * -1.5 

    return {
      transform: `rotate(${rotation}deg) translateY(${translateY}px) translateX(${translateX}px)`,
      transformOrigin: 'bottom center'
    }
  }

  useEffect(() => {
    if (isReveal) {
      setPhaseTransition(true)
      setRevealingCards(new Set())
      
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

  useEffect(() => {
    if (isReveal) {
      const ownedZones = ccgState.zones.filter(z => z.owner !== "none").map(z => z.id)
      setZoneAnimations(new Set(ownedZones))
      
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = setTimeout(() => {
        setZoneAnimations(new Set())
        
        // Автоматический подсчёт после завершения анимации открытия
        if (ccgState.round < 3) {
          // Раунды 1-2: автоматический переход к следующему
          setTimeout(() => {
            nextRound()
          }, 300)
        } else {
          // Раунд 3: только подсчёт очков, без перехода
          setTimeout(() => {
            updateScores()
          }, 300)
        }
      }, 1200)
    }
  }, [ccgState.zones, isReveal, ccgState.round, nextRound, updateScores])

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
    }
  }, [])

  const handleDragStart = (event: DragStartEvent) => {
    if (!isPlacement || isRoundConfirmed) return
    setActiveDragId(event.active.id as string)
    setDragSource(event.active.data.current?.source || 'hand')

    lastDragPos.current = { x: 0, y: 0 }
    lastDragTime.current = Date.now()
  }

  // ОПТИМИЗАЦИЯ: Прямая запись в DOM без вызова setState
  const handleDragMove = (event: DragMoveEvent) => {
    const { delta } = event
    const now = Date.now()
    const dt = now - lastDragTime.current

    if (dt > 12) { // Небольшой троттлинг для плавности
      const dx = delta.x - lastDragPos.current.x
      const dy = delta.y - lastDragPos.current.y
      
      const speedX = dx / dt
      const speedY = dy / dt
      
      const targetRotY = Math.max(-18, Math.min(18, speedX * 85))  
      const targetRotX = Math.max(-12, Math.min(12, -speedY * 85)) 
      const targetRotZ = Math.max(-8, Math.min(8, speedX * 35))    

      // Напрямую находим DOM-элемент оверлея и применяем трансформацию, минуя React-рендеры
      const overlayEl = document.getElementById("drag-tilt-overlay")
      if (overlayEl) {
        overlayEl.style.transform = `perspective(1000px) rotateX(${targetRotX}deg) rotateY(${targetRotY}deg) rotateZ(${targetRotZ}deg) scale(1.12)`
      }
      
      lastDragPos.current = { x: delta.x, y: delta.y }
      lastDragTime.current = now
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    setDragSource(null)

    if (!over || !isPlacement || isRoundConfirmed) return

    const cardId = active.id as string
    const overId = over.id as string

    if (overId.startsWith('zone-')) {
      if (dragSource === 'zone') {
        const existingPlacement = placedThisRound.find(p => p.cardId === cardId)
        if (existingPlacement && existingPlacement.zoneId !== overId) {
          moveCardBetweenZones(cardId, overId)
        }
      } else {
        playCardToZone(cardId, overId)
      }
    } else if (dragSource === 'zone') {
      setRecallingCards(prev => new Set([...prev, cardId]))
      setTimeout(() => {
        recallCard(cardId)
        setRecallingCards(prev => {
          const newSet = new Set(prev)
          newSet.delete(cardId)
          return newSet
        })
      }, 300)
    } else if (dragSource === 'hand' && overId !== cardId) {
      const oldIndex = ccgState.hand.findIndex(c => c.uniqueId === cardId)
      const newIndex = ccgState.hand.findIndex(c => c.uniqueId === overId)
      if (oldIndex !== -1 && newIndex !== -1) {
        reorganizeHand(oldIndex, newIndex)
      }
    }
  }

  const handleCardView = (card: any, isPlayer: boolean, power?: number, bonus?: number, isSecret?: boolean, synergyBonus?: number, wasSecret?: boolean, zoneModifier?: any) => {
    if (isSecret) return 
    
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

  const activeHandCards = ccgState.hand.filter(
    card => !placedThisRound.some(p => p.cardId === card.uniqueId)
  )

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full max-w-md mx-auto lg:max-w-4xl h-[100dvh] bg-[#05050a] text-white flex flex-col justify-between overflow-hidden relative select-none overscroll-none touch-none">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(99,102,241,0.08),transparent_70%)] pointer-events-none" />

      {/* ШАПКА */}
      <header className="px-2 sm:px-4 py-2 sm:py-3 bg-slate-950/60 border-b border-white/5 backdrop-blur-md flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-3">
          <div className="px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-0.5 sm:gap-1">
            <span className="text-[8px] sm:text-[9px] font-black uppercase text-indigo-400 tracking-wider">Раунд</span>
            <span className="text-[10px] sm:text-xs font-black text-white">{ccgState.round}</span>
            <span className="text-[9px] sm:text-[10px] text-slate-500">/3</span>
          </div>
          
          {(isReveal || ccgState.round > 1) && (
            <div className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-2xl border flex items-center gap-1 sm:gap-2 transition-all duration-300 ${
              isPlayerLeading 
                ? 'bg-emerald-500/10 border-emerald-500/30' 
                : isAiLeading 
                ? 'bg-rose-500/10 border-rose-500/30' 
                : 'bg-slate-500/10 border-slate-500/30'
            }`}>
              {isPlayerLeading && <Crown className="w-2 h-2 sm:w-3 sm:h-3 text-emerald-400 animate-pulse" />}
              <span className="text-[8px] sm:text-[9px] font-black uppercase text-slate-400 tracking-wider">Счёт</span>
              <span className={`text-[10px] sm:text-xs font-black ${isPlayerLeading ? 'text-emerald-400' : isAiLeading ? 'text-rose-400' : 'text-slate-300'}`}>
                {matchScore.playerZones}:{matchScore.aiZones}
              </span>
              {isAiLeading && <Crown className="w-2 h-2 sm:w-3 sm:h-3 text-rose-400 animate-pulse" />}
            </div>
          )}
          
          <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest flex items-center gap-1 sm:gap-1.5">
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
            className="px-1.5 sm:px-3 py-1 sm:py-1.5 bg-rose-500/10 active:scale-90 text-rose-400 border border-rose-500/20 rounded-lg sm:rounded-xl transition-all text-[9px] sm:text-[10px] font-black uppercase"
          >
            Сдаться
          </button>
        </div>
      </header>

      {/* КРАТКИЙ СПРАВОЧНИК КНБ */}
      {showRules && (
        <div className="bg-slate-950/95 border-b border-white/10 p-3.5 absolute top-[52px] left-0 right-0 z-40 animate-in slide-in-from-top-3 duration-200">
          <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-wider mb-3">🔥 Бонус ролей (КНБ): победитель получает +50% к силе!</h4>
          <div className="flex flex-col items-center gap-1 text-[8px] font-extrabold text-center relative py-2">
            <div className="relative">
              <div className="p-1.5 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300">
                🗡️ Авангард
              </div>
              <span className="absolute -right-3 top-1/2 -translate-y-1/2 text-rose-400 text-[10px]">↘</span>
            </div>
            <div className="flex items-center gap-8">
              <div className="relative">
                <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300">
                  🛡️ Страж
                </div>
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-blue-400 text-[10px]">↗</span>
              </div>
              <div className="relative">
                <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  ⚡ Плут
                </div>
                <span className="absolute -left-3 top-1/2 -translate-y-1/2 text-amber-400 text-[10px]">←</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ИГРОВОЕ ПОЛЕ ИЗ 3 ЛОКАЦИЙ */}
      <main className="flex-1 p-1.5 sm:p-2 flex flex-col justify-center gap-1.5 sm:gap-2 z-10">
        <div className="grid grid-cols-3 gap-1 sm:gap-1.5 lg:gap-3 h-full items-stretch max-h-[55vh] sm:max-h-[600px] lg:max-h-[850px]">
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
              <ZoneDropZone
                key={zone.id}
                zoneId={zone.id}
                isPlacement={isPlacement}
                isDragging={activeDragId !== null}
                statusGlow={statusGlow}
              >
                {/* КАРТЫ ПРОТИВНИКА */}
                <div className="flex-1 flex flex-col justify-start min-h-[70px] sm:min-h-[80px] gap-1 sm:gap-1">
                  <div className={`flex justify-between items-center px-1.5 sm:px-1.5 text-[9px] sm:text-[9px] font-bold uppercase transition-all duration-300 ${
                    aiPower > playerPower ? 'text-rose-400 scale-105' : 'text-rose-400/70'
                  }`}>
                    <span className="flex items-center gap-1 sm:gap-1">
                      {aiPower > playerPower && <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                      Враг
                    </span>
                    <span className="text-[11px] sm:text-xs font-black text-rose-400">
                      {aiPower}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1 sm:gap-1 justify-items-center items-center">
                    {zone.aiCards.map((zc, idx) => {
                      const isRevealing = revealingCards.has(zc.card.uniqueId)
                      const isDestroying = destroyingCards.has(zc.card.uniqueId)
                      const cardEffect = cardEffects.get(zc.card.uniqueId)
                      return (
                        <div key={idx} className={`scale-[0.8] sm:scale-[0.85] lg:scale-100 transition-all duration-500 transform-gpu will-change-transform ${
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
                    {aiPendingOnThisZone.map((p, idx) => {
                      if (!p.card) return null
                      return (
                        <div key={`ai-pending-${idx}`} className="scale-[0.8] sm:scale-[0.85] lg:scale-100 transform-gpu will-change-transform">
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

                {/* ПОРТАЛ СИЛЫ */}
                <div className="my-1.5 sm:my-1.5 flex flex-col items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveTerrain({ nameRu: zone.modifier.nameRu, description: zone.modifier.description })
                    }}
                    className={`relative w-full py-2 sm:py-2 rounded-lg border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] flex flex-col items-center justify-center transition-all active:scale-95 transform-gpu will-change-transform ${
                      modifierActivations.has(zone.id) ? 'animate-modifierActivate' : ''
                    }`}
                  >
                    <div className="text-center w-full px-1 sm:px-1">
                      <span className="text-[9px] sm:text-[9px] font-bold uppercase tracking-wide text-slate-300 block truncate">
                        {zone.modifier.nameRu}
                      </span>
                    </div>
                  </button>
                </div>

                {/* КАРТЫ ИГРОКА */}
                <div className="flex-1 flex flex-col justify-end min-h-[70px] sm:min-h-[80px] gap-1 sm:gap-1 border-t border-white/5 pt-1.5 sm:pt-1.5">
                  <div className="grid grid-cols-2 gap-1 sm:gap-1 justify-items-center items-center">
                    {zone.playerCards.map((zc, idx) => {
                      const isRevealing = revealingCards.has(zc.card.uniqueId)
                      const isDestroying = destroyingCards.has(zc.card.uniqueId)
                      const cardEffect = cardEffects.get(zc.card.uniqueId)
                      return (
                        <div key={idx} className={`scale-[0.8] sm:scale-[0.85] lg:scale-100 transition-all duration-500 transform-gpu will-change-transform ${
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
                      const isRecalling = recallingCards.has(p.card.uniqueId)
                      return (
                        <div key={`pending-${idx}`} className={`scale-[0.8] sm:scale-[0.85] lg:scale-100 transition-all duration-300 transform-gpu will-change-transform ${
                          isRecalling ? 'animate-cardRecall' : ''
                        }`}>
                          <DraggableCard
                            card={p.card!}
                            cardId={p.card!.uniqueId}
                            size="sm"
                            isSecret={p.isSecret && (!isReveal || ccgState.round < 3)}
                            isPlayerCard={true}
                            isPending={true}
                            isPlacement={isPlacement && !isRecalling}
                            source="zone"
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
                  <div className={`flex justify-between items-center px-1.5 sm:px-1.5 text-[9px] sm:text-[9px] font-bold uppercase transition-all duration-300 ${
                    playerPower > aiPower ? 'text-emerald-400 scale-105' : 'text-emerald-400/70'
                  }`}>
                    <span className="flex items-center gap-1 sm:gap-1">
                      {playerPower > aiPower && <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                      Вы
                    </span>
                    <span className="text-[11px] sm:text-xs font-black text-emerald-400">
                      {playerPower}
                    </span>
                  </div>
                </div>
              </ZoneDropZone>
            )
          })}
        </div>
      </main>

      {/* ФИКСИРОВАННАЯ КНОПКА ЗАВЕРШЕНИЯ */}
      <div className="fixed right-4 bottom-28 sm:right-4 sm:bottom-30 z-50 lg:absolute lg:right-6 lg:bottom-40">
        {isFinalizing ? (
          <button
            onClick={finishBattle}
            className="w-14 h-14 sm:w-14 sm:h-14 rounded-full bg-amber-500 text-white font-black text-sm sm:text-sm transition-all active:scale-100 flex flex-col items-center justify-center animate-pulse"
          >
            <Crown className="w-5 h-5 sm:w-5 sm:h-5" />
            <span className="text-[9px] sm:text-[9px] leading-none">Финиш</span>
          </button>
        ) : isPlacement ? (
          <button
            onClick={confirmRoundPlacement}
            disabled={placedThisRound.length < 2 || aiPlacedThisRound.length < 2}
            className="w-14 h-14 sm:w-14 sm:h-14 rounded-full bg-emerald-500 disabled:bg-slate-700 text-white disabled:text-slate-500 font-black text-sm sm:text-sm transition-all active:scale-100 flex flex-col items-center justify-center"
          >
            <Swords className="w-5 h-5 sm:w-5 sm:h-5" />
            <span className="text-[9px] sm:text-[9px] leading-none">
              {placedThisRound.length}/{aiPlacedThisRound.length}
            </span>
          </button>
        ) : isReveal && ccgState.round === 3 ? (
          <button
            onClick={nextRound}
            className="w-14 h-14 sm:w-14 sm:h-14 rounded-full bg-indigo-500 text-white font-black text-sm sm:text-sm transition-all active:scale-100 flex flex-col items-center justify-center"
          >
            <ArrowRight className="w-5 h-5 sm:w-5 sm:h-5" />
            <span className="text-[9px] sm:text-[9px] leading-none">Финиш</span>
          </button>
        ) : null}
      </div>

      {/* ЗОНА РУКИ ИГРОКА */}
      <div className="bg-slate-950/95 border-t border-white/10 px-2.5 sm:px-3 pt-2 sm:pt-2 pb-4 sm:pb-5 backdrop-blur-2xl z-30 shadow-[0_-10px_30px_rgba(0,0,0,0.8)] shrink-0">
        <div className="max-w-md mx-auto lg:max-w-4xl w-full relative">
          <div className="flex items-center justify-between px-1 sm:px-1 mb-1 sm:mb-1">
            <span className="text-[9px] sm:text-[8px] text-slate-400 font-extrabold uppercase tracking-wider">
              Карт в руке ({ccgState.hand.length})
            </span>
          </div>
          
          <SortableContext items={ccgState.hand.map(c => c.uniqueId)} strategy={verticalListSortingStrategy}>
            <div className="flex items-center justify-center gap-1.5 sm:gap-2 lg:gap-4 py-2.5 sm:py-3 px-1.5 sm:px-2 overflow-visible min-h-[110px] sm:min-h-[130px] lg:min-h-[160px]">
              {ccgState.hand.map((card, idx) => {
                const isPlaced = placedThisRound.some(p => p.cardId === card.uniqueId)

                if (isPlaced) return null

                const currentTotal = activeHandCards.length
                const activeIdx = activeHandCards.findIndex(c => c.uniqueId === card.uniqueId)

                return (
                  <SortableCard
                    key={card.uniqueId}
                    card={card}
                    cardId={card.uniqueId}
                    size="sm"
                    isPlacement={isPlacement && !isRoundConfirmed}
                    onClick={() => handleCardView(card, true, getCardBasePower(card), 0, false, 0, false)}
                    isInteractive={true}
                    idx={idx}
                    fanStyle={getHandCardStyle(activeIdx, currentTotal)}
                  />
                )
              })}
            </div>
          </SortableContext>
        </div>
      </div>

      {/* DRAG OVERLAY С ОПТИМИЗИРОВАННЫМ ID ДЛЯ ПРЯМОГО ВЗАИМОДЕЙСТВИЯ (ОТСУТСТВУЕТ REACT RE-RENDERS) */}
      <DragOverlay dropAnimation={null}>
        {activeDragId ? (() => {
          let card = ccgState.hand.find(c => c.uniqueId === activeDragId)
          if (!card) {
            const placed = placedThisRound.find(p => p.cardId === activeDragId)
            if (placed) {
              card = ccgState.hand.find(c => c.uniqueId === placed.cardId)
            }
          }
          
          if (!card) return null
          
          return (
            <div 
              id="drag-tilt-overlay"
              style={{
                filter: 'drop-shadow(0 25px 15px rgba(0, 0, 0, 0.65))',
                transform: 'perspective(1000px) scale(1.12)',
                transition: 'transform 0.08s ease-out',
                zIndex: 10000,
                pointerEvents: 'none',
              }}
              className="origin-center transform-gpu will-change-transform"
            >
              <BattleCard card={card} size="sm" isInteractive={false} />
            </div>
          )
        })() : null}
      </DragOverlay>

      {/* ОПТИМИЗИРОВАННЫЙ ВСПЛЫВАЮЩИЙ ТЕКСТ (ИСПОЛЬЗУЕТ translate3d ДЛЯ РАБОТЫ НА GPU) */}
      {floatingTexts.map(ft => (
        <div
          key={ft.id}
          className={`fixed pointer-events-none z-40 font-black text-sm ${ft.color} ${ft.isPositive ? 'animate-floatUp' : 'animate-floatDown'} transform-gpu`}
          style={{
            transform: `translate3d(${ft.x}px, ${ft.y}px, 0)`,
            willChange: 'transform',
          }}
        >
          {ft.text}
        </div>
      ))}

      {/* ПОДРОБНОЕ МОДАЛЬНОЕ ОКНО ЛОКАЦИИ */}
      {activeTerrain && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setActiveTerrain(null)}
        >
          <div
            className="bg-[#0b0b14]/95 border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-5 max-w-[280px] sm:max-w-xs lg:max-w-md w-full shadow-2xl relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveTerrain(null)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1 sm:p-1.5 rounded-full bg-white/5 text-slate-400 active:scale-90 transition-colors"
            >
              <X className="w-3 h-3 sm:w-4 sm:h-4" />
            </button>
            <div className="flex items-center gap-1.5 sm:gap-2 text-yellow-400 text-[10px] sm:text-xs font-black uppercase mb-2 sm:mb-3">
              <Zap className="w-3 h-3 sm:w-4 sm:h-4 animate-pulse" /> Эффект локации
            </div>
            <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wider mb-1.5 sm:mb-2">
              {activeTerrain.nameRu}
            </h3>
            <p className="text-[10px] sm:text-xs text-slate-300 leading-relaxed font-semibold">
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
              className="bg-[#0b0b14]/95 border border-white/10 rounded-2xl sm:rounded-3xl p-3 sm:p-5 max-w-[320px] sm:max-w-lg lg:max-w-2xl w-full shadow-2xl relative animate-in zoom-in-95 duration-200"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setViewedCard(null)}
                className="absolute top-3 right-3 sm:top-4 sm:right-4 p-1 sm:p-1.5 rounded-full bg-white/5 text-slate-400 active:scale-90 transition-colors hover:bg-white/10"
              >
                <X className="w-3 h-3 sm:w-4 sm:h-4" />
              </button>
              
              <div className="flex gap-2 sm:gap-4 flex-col sm:flex-row">
                <div className="flex flex-col items-center w-full sm:w-auto">
                  <div className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border text-[10px] sm:text-xs font-black uppercase mb-2 sm:mb-3 ${roleColors[role]}`}>
                    {roleNames[role]}
                  </div>
                  <div className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-xl border text-[10px] sm:text-xs font-black uppercase mb-2 sm:mb-3 bg-gradient-to-r ${rarityConfig[card.rarity as keyof typeof rarityConfig].color} text-white border-white/20`}>
                    {rarityConfig[card.rarity as keyof typeof rarityConfig].label}
                  </div>
                  <div className="text-[9px] sm:text-[10px] font-bold uppercase mb-2 sm:mb-3">
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
                  <div className={`px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg sm:rounded-xl border mt-2 sm:mt-3 text-center text-[9px] sm:text-[10px] font-black uppercase ${roleColors[role]}`}>
                    {roleBeats[role]}
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-center gap-2 sm:gap-3">
                  <div>
                    <div className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2">Модификаторы силы</div>
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                      <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-white/5">
                        <span className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase">Базовая сила</span>
                        <span className="text-slate-300 font-black text-xs sm:text-sm">{getCardBasePower(card)}</span>
                      </div>
                      <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-white/5">
                        <span className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase">Итоговая сила</span>
                        <span className="text-white font-black text-xs sm:text-sm">{viewedCard.power ?? getCardBasePower(card)}</span>
                      </div>
                      {(viewedCard.bonus ?? 0) > 0 && (
                        <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                          <span className="text-emerald-400 font-bold text-[9px] sm:text-[10px] uppercase">КНБ</span>
                          <span className="text-emerald-300 font-black text-xs sm:text-sm">+{Math.round((viewedCard.bonus ?? 0) * 100)}%</span>
                        </div>
                      )}
                      {(viewedCard.synergyBonus ?? 0) > 0 && (
                        <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                          <span className="text-violet-400 font-bold text-[9px] sm:text-[10px] uppercase">Синергия</span>
                          <span className="text-violet-300 font-black text-xs sm:text-sm">+{viewedCard.synergyBonus}</span>
                        </div>
                      )}
                      {(viewedCard.formationBonus ?? 0) !== 0 && (
                        <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                          <span className="text-cyan-400 font-bold text-[9px] sm:text-[10px] uppercase">Формация</span>
                          <span className="text-cyan-300 font-black text-xs sm:text-sm">{(viewedCard.formationBonus ?? 0) > 0 ? '+' : ''}{viewedCard.formationBonus}</span>
                        </div>
                      )}
                      {territoryBuff && territoryBuff.value !== 0 && (
                        <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                          <span className="text-yellow-400 font-bold text-[9px] sm:text-[10px] uppercase">Локация</span>
                          <span className="text-yellow-300 font-black text-xs sm:text-sm">{territoryBuff.value > 0 ? '+' : ''}{territoryBuff.value}</span>
                        </div>
                      )}
                      {territoryBuff && territoryBuff.description && territoryBuff.description !== "0" && (
                        <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 col-span-2">
                          <span className="text-orange-400 font-bold text-[9px] sm:text-[10px] uppercase">Эффект локации</span>
                          <span className="text-orange-300 font-black text-xs sm:text-sm">{territoryBuff.description}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 sm:mb-2">Базовые характеристики</div>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                      <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-white/5">
                        <span className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase">HP</span>
                        <span className="text-white font-black text-xs sm:text-sm">{card.stats.hp}</span>
                      </div>
                      <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-white/5">
                        <span className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase">ATK</span>
                        <span className="text-white font-black text-xs sm:text-sm">{card.stats.atk}</span>
                      </div>
                      <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-white/5">
                        <span className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase">DEF</span>
                        <span className="text-white font-black text-xs sm:text-sm">{card.stats.def}</span>
                      </div>
                      <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-white/5">
                        <span className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase">SPD</span>
                        <span className="text-white font-black text-xs sm:text-sm">{card.stats.spd}</span>
                      </div>
                      <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-white/5 col-span-2">
                        <span className="text-slate-400 font-bold text-[9px] sm:text-[10px] uppercase">LUCK</span>
                        <span className="text-white font-black text-xs sm:text-sm">{card.stats.luck}</span>
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
    </DndContext>
  )
}