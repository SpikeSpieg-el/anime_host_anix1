import React, { useState, useEffect, useRef } from "react"
import { Swords, ArrowRight, BookOpen, Clock, Zap, X, TrendingUp, Crown, Bot, Users, Trophy, Flame } from "lucide-react"
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, DragMoveEvent, useDraggable, useDroppable, pointerWithin, PointerSensor, useSensor, useSensors } from "@dnd-kit/core"
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { BattleZone, CCGBattleState, CardRole, Card, DeckContext } from "../types"
import { getCardBasePower, getCardRole, getDeckPowerModifier, getTerritoryBuff, calculateCardPowerOnZone } from "../utils"
import { BattleCard } from "./BattleCard"
import { rarityConfig } from "@/types/gacha"

interface DraggableCardProps {
  card: Card
  cardId: string
  size: "xs" | "sm" | "lg"
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
  size: "xs" | "sm" | "lg"
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
  confirmRoundPlacement: (isPvP?: boolean, pvpMatchId?: string, placeCards?: (matchId: string, placements: any[]) => void) => void
  nextRound: () => void
  updateScores: () => void
  finishBattle: (isPvPMode?: boolean) => void
  setBattleState: (state: "idle" | "loading" | "battle" | "result") => void
  deckContext?: DeckContext
  opponentDeckContext?: DeckContext | null
  onCardEffect?: (cardId: string, type: 'buff' | 'debuff' | 'synergy' | 'knb-win' | 'knb-loss') => void
  onCardDestroy?: (cardId: string) => void
  onModifierActivate?: (zoneId: string) => void
  onFloatingText?: (text: string, x: number, y: number, isPositive: boolean) => void
  cardEffects?: Map<string, { type: 'buff' | 'debuff' | 'synergy' | 'knb-win' | 'knb-loss' }>
  destroyingCards?: Set<string>
  modifierActivations?: Set<string>
  floatingTexts?: Array<{ id: string; text: string; x: number; y: number; color: string; isPositive: boolean }>
  isPvPMode?: boolean
  pvpMatchId?: string
  placeCards?: (matchId: string, placements: any[]) => void
  aiThinking?: boolean
  backgroundUrl?: string
  backgroundScale?: number
  backgroundPositionX?: number
  backgroundPositionY?: number
  backgroundOpacity?: number
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
  opponentDeckContext,
  onCardEffect,
  onCardDestroy,
  onModifierActivate,
  onFloatingText,
  cardEffects: propCardEffects,
  destroyingCards: propDestroyingCards,
  modifierActivations: propModifierActivations,
  floatingTexts: propFloatingTexts,
  isPvPMode,
  pvpMatchId,
  placeCards,
  aiThinking,
  backgroundUrl,
  backgroundScale,
  backgroundPositionX,
  backgroundPositionY,
  backgroundOpacity,
}) => {
  const [showRules, setShowRules] = useState(false)
  const [activeTerrain, setActiveTerrain] = useState<{ nameRu: string; description: string } | null>(null)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : true)
  const [dragSource, setDragSource] = useState<'hand' | 'zone' | null>(null)
  const [viewedCard, setViewedCard] = useState<{ card: any; isPlayer: boolean; power?: number; bonus?: number; synergyBonus?: number; formationBonus?: number; zoneModifier?: any } | null>(null)
  
  // Убрали state dragTilt, чтобы не вызывать повторный рендеринг всей арены 60 раз в секунду
  const lastDragPos = useRef({ x: 0, y: 0 })
  const lastDragTime = useRef(Date.now())

  const [revealingCards, setRevealingCards] = useState<Set<string>>(new Set())
  const [zoneAnimations, setZoneAnimations] = useState<Set<string>>(new Set())
  const [phaseTransition, setPhaseTransition] = useState(false)
  const [recallingCards, setRecallingCards] = useState<Set<string>>(new Set())
  const [phaseBanner, setPhaseBanner] = useState<{ text: string; subtext?: string; color: 'amber' | 'indigo' | 'emerald' | 'rose' } | null>(null)
  const [showSurrenderConfirm, setShowSurrenderConfirm] = useState(false)
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const revealTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const phaseBannerTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const revealProcessedRef = useRef<string>('')
  const scoreProcessedRef = useRef<string>('')
  const floatingTextIdRef = useRef(0)

  const showPhaseBanner = (text: string, subtext: string, color: 'amber' | 'indigo' | 'emerald' | 'rose', duration = 1500) => {
    if (phaseBannerTimeoutRef.current) clearTimeout(phaseBannerTimeoutRef.current)
    setPhaseBanner({ text, subtext, color })
    phaseBannerTimeoutRef.current = setTimeout(() => setPhaseBanner(null), duration)
  }

  // Use props from parent (use-battle-data.ts) for animation states
  const cardEffects = propCardEffects || new Map<string, { type: 'buff' | 'debuff' | 'synergy' | 'knb-win' | 'knb-loss' }>()
  const destroyingCards = propDestroyingCards || new Set<string>()
  const modifierActivations = propModifierActivations || new Set<string>()
  const floatingTexts = propFloatingTexts || []
  const prevRoundRef = useRef(ccgState?.round || 1)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const zoneCardSize = isMobile ? 'xs' : 'sm'

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
      const revealKey = `flip-${ccgState.round}`
      if (revealProcessedRef.current === revealKey) return
      revealProcessedRef.current = revealKey
      setPhaseTransition(true)
      setRevealingCards(new Set())
      showPhaseBanner('Вскрытие карт', 'Секретные карты открываются...', 'indigo', 1800)
      
      // Stagger reveal: zone 1 → zone 2 → zone 3
      const allSecretCards = ccgState.zones.flatMap((zone, zoneIdx) => 
        [...zone.playerCards, ...zone.aiCards]
          .filter(zc => zc.wasSecret)
          .map(zc => ({ id: zc.card.uniqueId, zoneIdx }))
      )
      
      // Reveal zone by zone with 350ms delay between zones
      const STAGGER_MS = 350
      allSecretCards.forEach(({ id, zoneIdx }) => {
        setTimeout(() => {
          setRevealingCards(prev => new Set([...prev, id]))
        }, zoneIdx * STAGGER_MS)
      })
      
      const maxDelay = ccgState.zones.length * STAGGER_MS
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current)
      revealTimeoutRef.current = setTimeout(() => {
        setRevealingCards(new Set())
        setPhaseTransition(false)
      }, maxDelay + 700)
    }
  }, [ccgState.phase, ccgState.round])

  useEffect(() => {
    if (isReveal) {
      const scoreKey = `score-${ccgState.round}`
      if (scoreProcessedRef.current === scoreKey) return
      scoreProcessedRef.current = scoreKey
      // Wait for card flip animations to finish before showing zone results
      const FLIP_TOTAL = ccgState.zones.length * 350 + 700 // matches reveal timing
      
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
      animationTimeoutRef.current = setTimeout(() => {
        // Stagger zone winner declarations
        const ownedZones = ccgState.zones.filter(z => z.owner !== "none")
        showPhaseBanner('Подсчёт сил', 'Определяем победителя линий...', 'amber', 1200)
        ownedZones.forEach((zone, idx) => {
          setTimeout(() => {
            setZoneAnimations(prev => new Set([...prev, zone.id]))
          }, idx * 200)
        })
        
        // Clear zone animations after all have shown
        setTimeout(() => {
          setZoneAnimations(new Set())
          
          // In PvP mode, round transitions and score calculation are driven by the server.
          // Client must NOT recalculate powers here — it would overwrite correct server values.
          if (isPvPMode) return

          // Автоматический подсчёт после завершения анимации открытия
          if (ccgState.round < 3) {
            // Раунды 1-2: автоматический переход к следующему
            setTimeout(() => {
              nextRound()
            }, 400)
          } else {
            // Раунд 3: только подсчёт очков, без перехода
            setTimeout(() => {
              updateScores()
            }, 400)
          }
        }, ownedZones.length * 200 + 600)
      }, FLIP_TOTAL)
    }
  }, [ccgState.zones, isReveal, ccgState.round, nextRound, updateScores])

  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) clearTimeout(animationTimeoutRef.current)
      if (revealTimeoutRef.current) clearTimeout(revealTimeoutRef.current)
      if (phaseBannerTimeoutRef.current) clearTimeout(phaseBannerTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!ccgState) return
    const prevRound = prevRoundRef.current
    if (ccgState.round !== prevRound && ccgState.phase === 'placement') {
      prevRoundRef.current = ccgState.round
      revealProcessedRef.current = ''
      scoreProcessedRef.current = ''
      const bannerText = ccgState.round === 1
        ? 'Раунд 1 — Расстановка'
        : ccgState.round === 2
        ? 'Раунд 2 — Расстановка'
        : 'Финальный раунд!'
      const subtext = ccgState.round === 3
        ? 'Последний шанс победить!'
        : isPvPMode
        ? 'Соперник тоже готовится...'
        : 'ИИ выбирает карты...'
      const color = ccgState.round === 3 ? 'amber' : 'indigo'
      showPhaseBanner(bannerText, subtext, color, 1800)
    }
    prevRoundRef.current = ccgState.round
  }, [ccgState?.round, ccgState?.phase])

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

  const handleCardView = (card: any, isPlayer: boolean, power?: number, bonus?: number, isSecret?: boolean, synergyBonus?: number, wasSecret?: boolean, zoneModifier?: any, zoneCards?: any[], isHandCard?: boolean) => {
    if (isSecret) return 
    
    // Use correct deck context based on card ownership
    // Player cards use player's deck context, opponent cards use opponent's deck context
    const cardDeckContext = isPlayer ? deckContext : opponentDeckContext
    
    // In PvP mode, server already includes synergy+leader+formation inside synergyBonus.
    // Don't recalculate formationBonus client-side to avoid double-counting and desync.
    let formationBonus = 0
    if (cardDeckContext && !isPvPMode) {
      formationBonus = getDeckPowerModifier(card, cardDeckContext, wasSecret || false)
    }

    // Calculate full power with territory modifier if zone context is available
    // In PvP mode, use server-calculated values for zone cards (not hand cards)
    // to avoid desync between what player sees and what enemy sees
    let calculatedPower = power
    let calculatedBonus = bonus
    let calculatedSynergy = synergyBonus

    if (zoneModifier && zoneCards && !isHandCard && !isPvPMode) {
      // Only recalculate in PvE mode - PvP uses server values
      const enemyCards = isPlayer ? zoneCards.filter((zc: any) => zc.isPlayer === false) : zoneCards.filter((zc: any) => zc.isPlayer === true)
      const playerCards = isPlayer ? zoneCards.filter((zc: any) => zc.isPlayer === true) : zoneCards.filter((zc: any) => zc.isPlayer === false)
      
      const result = calculateCardPowerOnZone(
        card,
        zoneModifier.id,
        enemyCards,
        playerCards,
        true,
        wasSecret || false,
        isPlayer,
        0,
        100,
        cardDeckContext || undefined
      )
      
      calculatedPower = result.power
      calculatedBonus = result.roleMatchupBonus
      calculatedSynergy = result.synergyBonus
    }
    
    setViewedCard({ card, isPlayer, power: calculatedPower, bonus: calculatedBonus, synergyBonus: calculatedSynergy, formationBonus, zoneModifier })
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
      {backgroundUrl && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          <img
            src={backgroundUrl}
            alt=""
            className="w-full h-full"
            style={{
              objectFit: 'cover',
              objectPosition: `${backgroundPositionX ?? 50}% ${backgroundPositionY ?? 50}%`,
              transform: `scale(${backgroundScale ?? 1})`,
              opacity: backgroundOpacity ?? 0.35,
            }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#05050a]/60 via-[#05050a]/70 to-[#05050a]/85" />
        </div>
      )}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(99,102,241,0.08),transparent_70%)] pointer-events-none" />

      {/* LLM AI THINKING INDICATOR (dev mode) */}
      {aiThinking && (
        <div className="absolute top-14 left-1/2 -translate-x-1/2 z-40 px-4 py-2 rounded-full bg-violet-500/20 backdrop-blur-md border border-violet-500/30 shadow-lg shadow-violet-500/10 flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-bold text-violet-200 uppercase tracking-wider">LLM думает...</span>
        </div>
      )}

      {/* ШАПКА */}
      <header className="px-2 sm:px-4 py-1.5 sm:py-2.5 bg-slate-950/60 border-b border-white/5 backdrop-blur-md z-30 shrink-0">
        <div className="flex items-center justify-between gap-1 sm:gap-2.5">
          <div className="flex items-center gap-1 sm:gap-2.5 min-w-0">
            {/* Режим игры */}
            <div className={`px-1.5 sm:px-2.5 py-1 sm:py-1.5 rounded-lg border flex items-center gap-1 shrink-0 ${
              isPvPMode
                ? 'bg-violet-500/10 border-violet-500/30'
                : 'bg-cyan-500/10 border-cyan-500/30'
            }`}>
              {isPvPMode ? <Users className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-violet-400" /> : <Bot className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-cyan-400" />}
              <span className={`text-[7px] sm:text-[9px] font-black uppercase tracking-wider ${isPvPMode ? 'text-violet-400' : 'text-cyan-400'}`}>
                {isPvPMode ? 'PvP' : 'PvE'}
              </span>
            </div>

            {/* Раунд */}
            <div className="px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-0.5 sm:gap-1 shrink-0">
              <span className="text-[8px] sm:text-[9px] font-black uppercase text-indigo-400 tracking-wider">Раунд</span>
              <span className="text-[10px] sm:text-xs font-black text-white">{ccgState.round}</span>
              <span className="text-[9px] sm:text-[10px] text-slate-500">/3</span>
            </div>

            {/* Счёт по зонам */}
            {(isReveal || ccgState.round > 1) && (
              <div className={`px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg sm:rounded-2xl border flex items-center gap-1 sm:gap-2 transition-all duration-300 shrink-0 ${
                isPlayerLeading
                  ? 'bg-emerald-500/10 border-emerald-500/30'
                  : isAiLeading
                  ? 'bg-rose-500/10 border-rose-500/30'
                  : 'bg-slate-500/10 border-slate-500/30'
              }`}>
                {isPlayerLeading && <Crown className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-emerald-400 animate-pulse" />}
                <div className="flex items-center gap-1 sm:gap-1.5">
                  <span className="text-[8px] sm:text-[9px] font-black uppercase text-emerald-400 tracking-wider">Вы</span>
                  <span className={`text-[10px] sm:text-xs font-black ${isPlayerLeading ? 'text-emerald-400' : isAiLeading ? 'text-rose-400' : 'text-slate-300'}`}>
                    {matchScore.playerZones}
                  </span>
                  <span className="text-slate-600 text-[9px] sm:text-[10px]">:</span>
                  <span className={`text-[10px] sm:text-xs font-black ${isAiLeading ? 'text-rose-400' : isPlayerLeading ? 'text-emerald-400' : 'text-slate-300'}`}>
                    {matchScore.aiZones}
                  </span>
                  <span className="text-[8px] sm:text-[9px] font-black uppercase text-rose-400 tracking-wider">{isPvPMode ? 'Враг' : 'ИИ'}</span>
                </div>
                {isAiLeading && <Crown className="w-2.5 h-2.5 sm:w-3.5 sm:h-3.5 text-rose-400 animate-pulse" />}
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {/* Фаза — скрыта на мобилке, т.к. есть placement hint */}
            <div className="hidden sm:flex text-[9px] font-black uppercase tracking-widest items-center gap-1.5">
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isPlacement ? 'bg-amber-400' : 'bg-indigo-400'}`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlacement ? 'bg-amber-500' : 'bg-indigo-500'}`}></span>
              </span>
              <span className={`${isPlacement ? 'text-amber-400' : 'text-indigo-400'}`}>
                {isPlacement ? 'Расстановка' : 'Вскрытие'}
              </span>
            </div>
            <button
              onClick={() => setShowRules(!showRules)}
              className="p-1.5 sm:p-2 bg-white/5 active:scale-90 border border-white/5 rounded-lg sm:rounded-xl transition-all"
            >
              <BookOpen className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-300" />
            </button>
            <button
              onClick={() => setShowSurrenderConfirm(true)}
              className="px-1.5 sm:px-3 py-1 sm:py-1.5 bg-rose-500/10 active:scale-90 text-rose-400 border border-rose-500/20 rounded-lg sm:rounded-xl transition-all text-[9px] sm:text-[10px] font-black uppercase"
            >
              {isPvPMode ? 'Выйти' : 'Сдаться'}
            </button>
          </div>
        </div>
      </header>

      {/* ПОДСКАЗКА ПО РАСКЛАДКЕ */}
      {isPlacement && !isRoundConfirmed && (
        <div className="px-3 py-1.5 bg-amber-500/5 border-b border-amber-500/10 flex items-center justify-center gap-2 z-20 shrink-0">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${placedThisRound.length >= 2 ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
            <span className="text-[9px] sm:text-[10px] font-bold text-amber-300/80 uppercase tracking-wide">
              {placedThisRound.length < 2
                ? `Поставьте ещё ${2 - placedThisRound.length} ${placedThisRound.length === 0 ? 'карты' : 'карту'} на линии`
                : 'Готово к вскрытию! Нажмите кнопку'
              }
            </span>
          </div>
        </div>
      )}

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

      {/* СТАТУС МАТЧА ВО ВРЕМЯ ВСКРЫТИЯ */}
      {isReveal && (matchScore.playerZones > 0 || matchScore.aiZones > 0) && (
        <div className={`px-3 py-1 flex items-center justify-center gap-2 z-20 shrink-0 border-b ${
          isPlayerLeading
            ? 'bg-emerald-500/5 border-emerald-500/10'
            : isAiLeading
            ? 'bg-rose-500/5 border-rose-500/10'
            : 'bg-slate-500/5 border-slate-500/10'
        }`}>
          <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-wide ${
            isPlayerLeading ? 'text-emerald-400' : isAiLeading ? 'text-rose-400' : 'text-slate-400'
          }`}>
            {isPlayerLeading
              ? `Вы ведёте ${matchScore.playerZones}:${matchScore.aiZones} — нужно выиграть 2 линии!`
              : isAiLeading
              ? `${isPvPMode ? 'Соперник' : 'ИИ'} ведёт ${matchScore.aiZones}:${matchScore.playerZones} — отыгрывайтесь!`
              : `Ничья ${matchScore.playerZones}:${matchScore.aiZones} — всё решится в финале!`
            }
          </span>
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
                ? `border-emerald-500/50 bg-emerald-950/30 ${isAnimating ? 'animate-zoneWinGlow' : ''}`
                : hasLost && isReveal
                ? `border-rose-500/50 bg-rose-950/30 ${isAnimating ? 'animate-zoneLoseDim' : ''}`
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
                <div className="flex flex-col justify-start gap-1 sm:gap-1">
                  <div className={`flex justify-between items-center px-1.5 sm:px-1.5 text-[9px] sm:text-[9px] font-bold uppercase transition-all duration-300 ${
                    aiPower > playerPower ? 'text-rose-400 scale-105' : 'text-rose-400/70'
                  }`}>
                    <span className="flex items-center gap-1 sm:gap-1">
                      {aiPower > playerPower && <TrendingUp className="w-2.5 h-2.5 sm:w-3 sm:h-3" />}
                      {isPvPMode ? 'Соперник' : 'ИИ'}
                    </span>
                    <span className="text-[11px] sm:text-xs font-black text-rose-400">
                      {aiPower}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-0.5 justify-items-center items-center">
                    {zone.aiCards.map((zc, idx) => {
                      const isRevealing = revealingCards.has(zc.card.uniqueId)
                      const isDestroying = destroyingCards.has(zc.card.uniqueId)
                      const cardEffect = cardEffects.get(zc.card.uniqueId)
                      return (
                        <div key={idx} className={`transition-all duration-500 transform-gpu will-change-transform ${
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
                            size={zoneCardSize}
                            isSecret={zc.isSecret && (!isReveal || ccgState.round < 3) && !isRevealing}
                            isPlayerCard={false}
                            powerValue={zc.powerAfterModifier}
                            roleMatchupBonus={zc.roleMatchupBonus}
                            synergyBonus={zc.synergyBonus}
                            isInteractive={true}
                            onClick={() => handleCardView(zc.card, false, zc.powerAfterModifier, zc.roleMatchupBonus, zc.isSecret && (!isReveal || ccgState.round < 3), zc.synergyBonus, zc.wasSecret, zone.modifier, [...zone.playerCards, ...zone.aiCards])}
                          />
                        </div>
                      )
                    })}
                    {aiPendingOnThisZone.map((p, idx) => {
                      if (!p.card) return null
                      return (
                        <div key={`ai-pending-${idx}`} className="transform-gpu will-change-transform">
                          <BattleCard
                            card={p.card}
                            size={zoneCardSize}
                            isSecret={p.isSecret && (!isReveal || ccgState.round < 3)}
                            isPlayerCard={false}
                            isPending={true}
                            isInteractive={false}
                          />
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* ПОРТАЛ СИЛЫ */}
                <div className="my-1.5 sm:my-1.5 flex flex-col items-center">
                  {isReveal && zone.owner !== "none" && (
                    <div className={`mb-1 px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider flex items-center gap-1 animate-in fade-in zoom-in duration-300 ${
                      hasWon
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    }`}>
                      {hasWon ? <><Trophy className="w-2.5 h-2.5" /> Победа</> : <><X className="w-2.5 h-2.5" /> Поражение</>}
                    </div>
                  )}
                  {isReveal && zone.owner === "none" && (
                    <div className="mb-1 px-2 py-0.5 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-slate-500/20 text-slate-300 border border-slate-500/30 animate-in fade-in duration-300">
                      Ничья
                    </div>
                  )}
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
                <div className="flex flex-col justify-end gap-1 sm:gap-1 border-t border-white/5 pt-1.5 sm:pt-1.5">
                  <div className="grid grid-cols-2 gap-0.5 justify-items-center items-center">
                    {zone.playerCards.map((zc, idx) => {
                      const isRevealing = revealingCards.has(zc.card.uniqueId)
                      const isDestroying = destroyingCards.has(zc.card.uniqueId)
                      const cardEffect = cardEffects.get(zc.card.uniqueId)
                      return (
                        <div key={idx} className={`transition-all duration-500 transform-gpu will-change-transform ${
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
                            size={zoneCardSize}
                            isSecret={zc.isSecret && (!isReveal || ccgState.round < 3) && !isRevealing}
                            powerValue={zc.powerAfterModifier}
                            roleMatchupBonus={zc.roleMatchupBonus}
                            synergyBonus={zc.synergyBonus}
                            isInteractive={true}
                            onClick={() => handleCardView(zc.card, true, zc.powerAfterModifier, zc.roleMatchupBonus, zc.isSecret && (!isReveal || ccgState.round < 3), zc.synergyBonus, zc.wasSecret, zone.modifier, [...zone.playerCards, ...zone.aiCards])}
                          />
                        </div>
                      )
                    })}

                    {playerPendingOnThisZone.map((p, idx) => {
                      if (!p.card) return null
                      const isRecalling = recallingCards.has(p.card.uniqueId)
                      return (
                        <div key={`pending-${idx}`} className={`transition-all duration-300 transform-gpu will-change-transform ${
                          isRecalling ? 'animate-cardRecall' : ''
                        }`}>
                          <DraggableCard
                            card={p.card!}
                            cardId={p.card!.uniqueId}
                            size={zoneCardSize}
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
                    playerPower > aiPower ? 'text-emerald-400 scale-105' : playerPower < aiPower ? 'text-emerald-400/50' : 'text-emerald-400/70'
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

      {/* ЛЁГКИЙ БАННЕР ФАЗЫ — посередине без затемнения */}
      {phaseBanner && (
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 z-40 flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-1 animate-in fade-in zoom-in-95 duration-300">
            <div className={`px-4 py-2 rounded-2xl backdrop-blur-md border flex flex-col items-center gap-0.5 ${
              phaseBanner.color === 'amber' ? 'bg-amber-500/10 border-amber-500/20'
              : phaseBanner.color === 'indigo' ? 'bg-indigo-500/10 border-indigo-500/20'
              : phaseBanner.color === 'emerald' ? 'bg-emerald-500/10 border-emerald-500/20'
              : 'bg-rose-500/10 border-rose-500/20'
            }`}>
              <div className="flex items-center gap-1.5">
                {phaseBanner.color === 'amber' && <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />}
                {phaseBanner.color === 'indigo' && <Zap className="w-3.5 h-3.5 text-indigo-400 animate-pulse" />}
                {phaseBanner.color === 'emerald' && <Trophy className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />}
                {phaseBanner.color === 'rose' && <X className="w-3.5 h-3.5 text-rose-400 animate-pulse" />}
                <span className={`text-sm sm:text-base font-black uppercase tracking-wider ${
                  phaseBanner.color === 'amber' ? 'text-amber-300'
                  : phaseBanner.color === 'indigo' ? 'text-indigo-300'
                  : phaseBanner.color === 'emerald' ? 'text-emerald-300'
                  : 'text-rose-300'
                }`}>
                  {phaseBanner.text}
                </span>
              </div>
              {phaseBanner.subtext && (
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  {phaseBanner.subtext}
                </span>
              )}
            </div>
          </div>
          {/* Auto fade-out animation */}
          <div className="absolute inset-0 animate-in fade-out duration-500 delay-1000" />
        </div>
      )}

      {/* ФИКСИРОВАННАЯ КНОПКА ЗАВЕРШЕНИЯ */}
      <div className="fixed right-4 bottom-28 sm:right-4 sm:bottom-30 z-50 lg:absolute lg:right-6 lg:bottom-40">
        {isFinalizing ? (
          <button
            onClick={() => finishBattle(isPvPMode || false)}
            className="w-16 h-16 sm:w-16 sm:h-16 rounded-full bg-amber-500 text-white font-black text-sm sm:text-sm transition-all active:scale-100 flex flex-col items-center justify-center animate-pulse shadow-lg shadow-amber-500/30"
          >
            <Crown className="w-5 h-5 sm:w-5 sm:h-5" />
            <span className="text-[8px] sm:text-[8px] leading-none">Итоги</span>
          </button>
        ) : isPlacement ? (
          isRoundConfirmed && isPvPMode ? (
            <button
              disabled={true}
              className="w-16 h-16 sm:w-16 sm:h-16 rounded-full bg-slate-800 text-slate-400 font-black text-sm sm:text-sm flex flex-col items-center justify-center animate-pulse"
            >
              <div className="w-5 h-5 border-2 border-slate-400 border-t-transparent rounded-full animate-spin mb-0.5" />
              <span className="text-[7px] sm:text-[7px] leading-none">Ждём врага</span>
            </button>
          ) : (
            <button
              onClick={() => confirmRoundPlacement(isPvPMode, pvpMatchId, placeCards)}
              disabled={placedThisRound.length < 2 || (!isPvPMode && (aiPlacedThisRound.length < 2 || aiThinking))}
              className="w-16 h-16 sm:w-16 sm:h-16 rounded-full bg-emerald-500 disabled:bg-slate-700 text-white disabled:text-slate-500 font-black text-sm sm:text-sm transition-all active:scale-100 flex flex-col items-center justify-center shadow-lg shadow-emerald-500/20 disabled:shadow-none"
            >
              <Swords className="w-5 h-5 sm:w-5 sm:h-5" />
              <span className="text-[8px] sm:text-[8px] leading-none">
                {placedThisRound.length < 2 ? `${placedThisRound.length}/2` : isPvPMode ? 'Готово' : 'Вскрыть!'}
              </span>
            </button>
          )
        ) : isReveal && ccgState.round === 3 ? (
          <button
            onClick={nextRound}
            className="w-16 h-16 sm:w-16 sm:h-16 rounded-full bg-indigo-500 text-white font-black text-sm sm:text-sm transition-all active:scale-100 flex flex-col items-center justify-center shadow-lg shadow-indigo-500/20"
          >
            <Crown className="w-5 h-5 sm:w-5 sm:h-5" />
            <span className="text-[8px] sm:text-[8px] leading-none">Итоги</span>
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
            {isPlacement && !isRoundConfirmed && (
              <span className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider text-amber-400/60">
                Перетащите карты на линии
              </span>
            )}
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
                    onClick={() => handleCardView(card, true, getCardBasePower(card), 0, false, 0, false, undefined, undefined, true)}
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

      {/* ПОДТВЕРЖДЕНИЕ СДАЧИ */}
      {showSurrenderConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowSurrenderConfirm(false)}
        >
          <div
            className="bg-[#0b0b14]/95 border border-rose-500/20 rounded-2xl sm:rounded-3xl p-4 sm:p-6 max-w-xs w-full shadow-2xl relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col items-center text-center gap-3">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center">
                <X className="w-5 h-5 sm:w-6 sm:h-6 text-rose-400" />
              </div>
              <h3 className="text-base sm:text-lg font-black text-white uppercase tracking-wide">
                {isPvPMode ? 'Покинуть бой?' : 'Сдаться?'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-400">
                {isPvPMode
                  ? 'Вы покинете матч. Это будет засчитано как поражение.'
                  : 'Бой будет завершён. Это будет засчитано как поражение.'}
              </p>
              <div className="flex gap-2 w-full mt-1">
                <button
                  onClick={() => setShowSurrenderConfirm(false)}
                  className="flex-1 py-2 sm:py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-xs sm:text-sm transition-all active:scale-95"
                >
                  Отмена
                </button>
                <button
                  onClick={() => {
                    setShowSurrenderConfirm(false)
                    setBattleState("idle")
                  }}
                  className="flex-1 py-2 sm:py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30 font-bold text-xs sm:text-sm transition-all active:scale-95"
                >
                  {isPvPMode ? 'Выйти' : 'Сдаться'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
                      <span className="text-rose-400">{isPvPMode ? 'Карта соперника' : 'Карта ИИ'}</span>
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
                      {(viewedCard.synergyBonus ?? 0) !== 0 && (
                        <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-violet-500/10 border border-violet-500/20">
                          <span className="text-violet-400 font-bold text-[9px] sm:text-[10px] uppercase">{isPvPMode ? "Колода" : "Синергия"}</span>
                          <span className="text-violet-300 font-black text-xs sm:text-sm">{(viewedCard.synergyBonus ?? 0) > 0 ? '+' : ''}{viewedCard.synergyBonus}</span>
                        </div>
                      )}
                      {!isPvPMode && (viewedCard.formationBonus ?? 0) !== 0 && (
                        <div className="flex flex-col items-center p-1.5 sm:p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
                          <span className="text-cyan-400 font-bold text-[9px] sm:text-[10px] uppercase">Формация</span>
                          <span className="text-cyan-300 font-black text-xs sm:text-sm">{(viewedCard.formationBonus ?? 0) > 0 ? '+' : ''}{viewedCard.formationBonus}</span>
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