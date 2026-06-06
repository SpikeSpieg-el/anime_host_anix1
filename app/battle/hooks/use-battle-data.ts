import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { useCoins } from "@/hooks/use-coins"
import { useDust } from "@/hooks/use-dust"
import { arrayMove } from "@dnd-kit/sortable"
import { Card, Dungeon, Enemy, BattleProgress, BattleLog, CCGBattleState, BattleZone, ZoneCard, CardRole, DeckContext } from "../types"
import { getCardRole, getCardProvision, calculateCardPowerOnZone, getCardBasePower, computeDeckSynergies } from "../utils"
import { PROVISION_LIMIT, DECK_SIZE, TERRITORY_MODIFIERS, FormationId } from "../config"
import { Rarity } from "@/types/gacha"
import { getAIDeckForDungeon, getRandomMarketDeck } from "../ai-decks"
import { createAI, createAIDecisionContext, AIConfig } from "../ai"

// Helper function to preload card images in background
const preloadCardImages = (cards: Card[]) => {
  const externalDomains = [
    'i.pinimg.com',
    'pinimg.com',
    'konachan.net',
    'safebooru.org',
    'zerochan.net',
    's3.zerochan.net',
    'shikimori.one'
  ]

  cards.forEach(card => {
    if (!card.imageUrl) return

    const isExternal = externalDomains.some(domain => card.imageUrl.includes(domain))
    const src = isExternal ? `/api/image-proxy?url=${encodeURIComponent(card.imageUrl)}` : card.imageUrl

    // Preload image without blocking
    const img = new Image()
    img.src = src
    // Don't wait for load - fire and forget
  })
}

export function useBattleData() {
  const { user, session, sessionLoading } = useAuth()
  const { coins: userCoins, addCoins, refresh: refreshCoins } = useCoins()
  const { dust, addDust, refresh: refreshDust } = useDust()

  const [progress, setProgress] = useState<BattleProgress | null>(null)
  const [dungeons, setDungeons] = useState<Dungeon[]>([])
  const [enemies, setEnemies] = useState<Enemy[]>([])
  const [logs, setLogs] = useState<BattleLog[]>([])

  const [collectedCards, setCollectedCards] = useState<Card[]>([])
  const [selectedCards, setSelectedCards] = useState<Card[]>([]) // This is the player's DECK (max DECK_SIZE cards)
  const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null)
  const [leaderId, setLeaderId] = useState<string | null>(null)
  const [formation, setFormation] = useState<FormationId>("balance")

  const [battleState, setBattleState] = useState<"idle" | "loading" | "battle" | "result">("idle")
  
  // CCG Match State
  const [ccgState, setCcgState] = useState<CCGBattleState | null>(null)
  const [placedThisRound, setPlacedPlacedThisRound] = useState<{ cardId: string; zoneId: string; isSecret: boolean }[]>([])
  const [aiPlacedThisRound, setAiPlacedThisRound] = useState<{ cardId: string; zoneId: string; isSecret: boolean }[]>([])
  const [isRoundConfirmed, setIsRoundConfirmed] = useState(false)

  // Animation states
  const [cardEffects, setCardEffects] = useState<Map<string, { type: 'buff' | 'debuff' | 'synergy' | 'knb-win' | 'knb-loss' }>>(new Map())
  const [destroyingCards, setDestroyingCards] = useState<Set<string>>(new Set())
  const [modifierActivations, setModifierActivations] = useState<Set<string>>(new Set())
  const [floatingTexts, setFloatingTexts] = useState<Array<{ id: string; text: string; x: number; y: number; color: string; isPositive: boolean }>>([])
  const floatingTextIdRef = useRef(0)

  const [showTeamBuilder, setShowTeamBuilder] = useState(false)
  const [teamSearch, setTeamSearch] = useState("")
  const [selectedRole, setSelectedRole] = useState<CardRole | "all">("all")
  const [sortBy, setSortBy] = useState<"default" | "power" | "rarity" | "provision" | "name" | "anime">("default")

  const [error, setError] = useState<string | null>(null)
  const [staminaTime, setStaminaTime] = useState("")
  const [isFinishing, setIsFinishing] = useState(false)

  // AI Engine instance
  const aiEngineRef = useRef<ReturnType<typeof createAI> | null>(null)

  const loadBattleData = useCallback(async () => {
    if (!user) return
    
    try {
      const accessToken = session?.access_token
      if (!accessToken) return
      console.log('[BattlePage] Loading battle data...')
      const res = await fetch('/api/battle?mode=all', { headers: { 'Authorization': `Bearer ${accessToken}` } })
      if (res.ok) {
        const data = await res.json()
        setProgress(data.progress)
        setDungeons(data.dungeons || [])
        setEnemies(data.enemies)
        setLogs(data.logs || [])

      }
    } catch (err) {
      console.error('[BattlePage] Error loading battle data:', err)
    }
  }, [user, session])

  const loadUserCards = useCallback(async () => {
    if (!user) return
    try {
      const { supabase } = await import("@/lib/supabase")
      const { data, error } = await supabase.rpc('get_battle_available_cards', {
        p_user_id: user.id
      })

      let rawCards = []
      if (!error && data) {
        rawCards = data
      } else {
        const { data: fallbackData } = await supabase
          .from('user_cards')
          .select('unique_id, name, anime, rarity, image_url, stats_hp, stats_atk, stats_def, stats_spd, stats_luck, is_main_character, score')
        if (fallbackData) rawCards = fallbackData
      }

      const mapped = rawCards.map((c: any) => {
        const mappedCard: Card = {
          uniqueId: c.unique_id, name: c.name, anime: c.anime, rarity: c.rarity as Rarity, imageUrl: c.image_url,
          stats: { hp: c.stats_hp, atk: c.stats_atk, def: c.stats_def, spd: c.stats_spd, luck: c.stats_luck },
          isMainCharacter: c.is_main_character || false, score: c.score,
        }
        mappedCard.role = getCardRole(mappedCard)
        mappedCard.provisionCost = getCardProvision(mappedCard)
        return mappedCard
      })

      setCollectedCards(mapped)

      // Preload card images in background to avoid blocking drag/drop
      preloadCardImages(mapped)

      // Try to load saved deck from API first, fallback to localStorage
      let savedDeckIds: string[] | null = null
      let savedLeaderId: string | null = null
      let savedFormation: FormationId = 'balance'

      try {
        const deckRes = await fetch('/api/battle/deck', {
          headers: { 'Authorization': `Bearer ${session?.access_token}` }
        })
        if (deckRes.ok) {
          const deckData = await deckRes.json()
          savedDeckIds = deckData.card_ids || []
          savedLeaderId = deckData.leader_id || null
          savedFormation = deckData.formation || 'balance'
        }
      } catch (err) {
        console.error('[BattlePage] Error loading deck from API, using localStorage:', err)
      }

      // Fallback to localStorage if API failed
      if (!savedDeckIds || savedDeckIds.length === 0) {
        savedDeckIds = JSON.parse(localStorage.getItem(`battle_deck_${DECK_SIZE}_${user.id}`) || '[]')
        savedLeaderId = localStorage.getItem(`battle_leader_${user.id}`)
        const localFormation = localStorage.getItem(`battle_formation_${user.id}`) as FormationId
        if (localFormation && ["aggression", "defense", "balance"].includes(localFormation)) {
          savedFormation = localFormation
        }
      }

      if (savedDeckIds && savedDeckIds.length > 0) {
        const savedDeck = mapped.filter((c: Card) => savedDeckIds!.includes(c.uniqueId)).slice(0, DECK_SIZE)
        // Recalculate provision costs and roles to ensure they're up to date
        savedDeck.forEach((c: Card) => {
          c.provisionCost = getCardProvision(c)
          c.role = getCardRole(c)
        })
        setSelectedCards(savedDeck)
      } else {
        // Fallback: select top DECK_SIZE cards by power
        const defaultDeck = mapped
          .slice()
          .sort((a: Card, b: Card) => getCardBasePower(b) - getCardBasePower(a))
          .slice(0, DECK_SIZE)

        // Recalculate provision costs and roles for default deck
        defaultDeck.forEach((c: Card) => {
          c.provisionCost = getCardProvision(c)
          c.role = getCardRole(c)
        })

        const provisionSum = defaultDeck.reduce((acc: number, c: Card) => acc + (c.provisionCost || getCardProvision(c)), 0)
        if (provisionSum <= PROVISION_LIMIT && defaultDeck.length === DECK_SIZE) {
          setSelectedCards(defaultDeck)
        }
      }

      // Set leaderId and formation
      if (savedLeaderId) {
        setLeaderId(savedLeaderId)
      }
      setFormation(savedFormation)
    } catch (err) {
      console.error('[BattlePage] Error loading cards:', err)
    }
  }, [user, session])

  useEffect(() => {
    if (user && !sessionLoading) {
      loadBattleData()
      loadUserCards()
    }
  }, [user, sessionLoading, loadBattleData, loadUserCards])

  // Save leaderId and formation to API when they change
  const saveDeckToAPI = useCallback(async () => {
    if (!user || !session) return
    try {
      await fetch('/api/battle/deck', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          card_ids: selectedCards.map(c => c.uniqueId),
          leader_id: leaderId,
          formation
        })
      })
    } catch (err) {
      console.error('[BattlePage] Error saving deck to API:', err)
    }
  }, [user, session, selectedCards, leaderId, formation])

  useEffect(() => {
    if (user) {
      // Save to localStorage as fallback
      if (leaderId) {
        localStorage.setItem(`battle_leader_${user.id}`, leaderId)
      } else {
        localStorage.removeItem(`battle_leader_${user.id}`)
      }
      // Save to API
      saveDeckToAPI()
    }
  }, [leaderId, user, saveDeckToAPI])

  useEffect(() => {
    if (user) {
      // Save to localStorage as fallback
      localStorage.setItem(`battle_formation_${user.id}`, formation)
      // Save to API
      saveDeckToAPI()
    }
  }, [formation, user, saveDeckToAPI])

  // Timer for stamina recovery countdown
  useEffect(() => {
    if (!progress?.staminaRefillMs || progress.current_stamina >= progress.max_stamina) { 
      setStaminaTime("Полная")
      return 
    }
    const update = () => {
      const ms = progress.staminaRefillMs || 0
      const m = Math.floor(ms / 60000)
      const s = Math.floor((ms % 60000) / 1000)
      setStaminaTime(`${m}:${s.toString().padStart(2, "0")}`)
    }
    update()
    const t = setInterval(update, 1000)
    return () => clearInterval(t)
  }, [progress])

  // Animation helper functions
  const triggerCardEffect = useCallback((cardId: string, type: 'buff' | 'debuff' | 'synergy' | 'knb-win' | 'knb-loss') => {
    setCardEffects(prev => new Map(prev).set(cardId, { type }))
    setTimeout(() => {
      setCardEffects(prev => {
        const next = new Map(prev)
        next.delete(cardId)
        return next
      })
    }, 600)
  }, [])

  const triggerCardDestruction = useCallback((cardId: string) => {
    setDestroyingCards(prev => new Set(prev).add(cardId))
    setTimeout(() => {
      setDestroyingCards(prev => {
        const next = new Set(prev)
        next.delete(cardId)
        return next
      })
    }, 600)
  }, [])

  const triggerModifierActivation = useCallback((zoneId: string) => {
    setModifierActivations(prev => new Set(prev).add(zoneId))
    setTimeout(() => {
      setModifierActivations(prev => {
        const next = new Set(prev)
        next.delete(zoneId)
        return next
      })
    }, 500)
  }, [])

  const addFloatingText = useCallback((text: string, x: number, y: number, isPositive: boolean) => {
    const id = `float-${floatingTextIdRef.current++}`
    const color = isPositive ? 'text-emerald-400' : 'text-rose-400'
    setFloatingTexts(prev => [...prev, { id, text, x, y, color, isPositive }])
    
    setTimeout(() => {
      setFloatingTexts(prev => prev.filter(t => t.id !== id))
    }, 1000)
  }, [])

  const toggleCardSelection = (card: Card) => {
    setSelectedCards(prev => {
      if (prev.some(c => c.uniqueId === card.uniqueId)) {
        const next = prev.filter(c => c.uniqueId !== card.uniqueId)
        const totalProv = next.reduce((acc: number, c: Card) => acc + (c.provisionCost || getCardProvision(c)), 0)
        if (totalProv > PROVISION_LIMIT) {
          setError(`Превышен лимит веса колоды (${totalProv}/${PROVISION_LIMIT})! Замените тяжёлые карты на более лёгкие перед дуэлью.`)
        } else {
          setError(null)
        }
        if (user) {
          localStorage.setItem(`battle_deck_${DECK_SIZE}_${user.id}`, JSON.stringify(next.map(c => c.uniqueId)))
          // Save to API
          saveDeckToAPI()
        }
        return next
      }
      if (prev.length >= DECK_SIZE) return prev
      
      const next = [...prev, card]
      const totalProv = next.reduce((acc: number, c: Card) => acc + (c.provisionCost || getCardProvision(c)), 0)
      if (totalProv > PROVISION_LIMIT) {
        setError(`Превышен лимит веса колоды (${totalProv}/${PROVISION_LIMIT})! Замените тяжёлые карты на более лёгкие перед дуэлью.`)
      } else {
        setError(null)
      }
      
      if (user) {
        localStorage.setItem(`battle_deck_${DECK_SIZE}_${user.id}`, JSON.stringify(next.map(c => c.uniqueId)))
        // Save to API
        saveDeckToAPI()
      }
      return next
    })
  }

  // CCG GAMEPLAY ACTIONS
  const startBattle = async () => {
    if (selectedCards.length !== DECK_SIZE) {
      return setError(`Колода должна содержать ровно ${DECK_SIZE} карт! Сейчас: ${selectedCards.length}`)
    }
    const totalProv = selectedCards.reduce((acc: number, c: Card) => acc + (c.provisionCost || getCardProvision(c)), 0)
    if (totalProv > PROVISION_LIMIT) {
      return setError(`Превышен лимит веса колоды (${totalProv}/${PROVISION_LIMIT} очков)!`)
    }
    if (!selectedDungeon) return setError("Выберите подземелье!")
    if (progress && progress.current_stamina < selectedDungeon.energy_cost) {
      return setError("Недостаточно энергии!")
    }
    // Validate leader is in deck
    if (leaderId && !selectedCards.some(c => c.uniqueId === leaderId)) {
      return setError("Лидер должен быть в колоде!")
    }

    setError(null)
    setBattleState("loading")
    setPlacedPlacedThisRound([])
    setAiPlacedThisRound([])
    setIsRoundConfirmed(false)

    try {
      const token = session?.access_token
      if (!token) return setError("Необходима авторизация")

      // Call API to spend stamina and register battle
      const spendRes = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          action: 'start_battle',
          dungeonId: selectedDungeon.id,
          playerCards: selectedCards.slice(0, 3).map(c => ({ uniqueId: c.uniqueId, name: c.name, stats: c.stats, rarity: c.rarity })) // Old payload compatibility
        }),
      })

      if (!spendRes.ok) {
        const data = await spendRes.json()
        console.error('[Battle] API Error:', data)
        setError(data.message || "Ошибка списания энергии")
        setBattleState("idle")
        return
      }

      // Generate AI Deck from pre-defined deck for this dungeon
      let predefinedDeck: Card[]
      if (selectedDungeon.id?.startsWith('daily-market-')) {
        // Use random market deck for daily market battles
        predefinedDeck = getRandomMarketDeck()
      } else {
        const dungeonTheme = selectedDungeon.is_daily ? 'daily' : selectedDungeon.theme
        predefinedDeck = getAIDeckForDungeon(dungeonTheme)
      }

      // Initialize AI Engine with strategic strategy
      aiEngineRef.current = createAI({
        strategy: "strategic",
        enableLogging: false, // Disable logging in production
        logLevel: "none",
        aggressiveness: 0.6,
        defensiveness: 0.4,
        bluffChance: 0.3
      })
      
      const aiDeck = predefinedDeck
        .slice()
        .sort(() => Math.random() - 0.5)
        .slice(0, DECK_SIZE)
        .map((c, idx) => ({
          ...c,
          uniqueId: `ai-card-${idx}-${Date.now()}`,
          role: getCardRole(c),
          provisionCost: getCardProvision(c)
        }))

      // Prepare 3 Battle Zones with random modifiers
      const shuffledModifiers = TERRITORY_MODIFIERS.slice().sort(() => Math.random() - 0.5)
      const zones: BattleZone[] = [
        { id: "zone-1", name: "Линия 1", nameRu: "Авангардная Линия", modifier: shuffledModifiers[0], playerCards: [], aiCards: [], playerScore: 0, aiScore: 0, owner: "none" },
        { id: "zone-2", name: "Линия 2", nameRu: "Центральная Линия", modifier: shuffledModifiers[1], playerCards: [], aiCards: [], playerScore: 0, aiScore: 0, owner: "none" },
        { id: "zone-3", name: "Линия 3", nameRu: "Теневая Линия", modifier: shuffledModifiers[2], playerCards: [], aiCards: [], playerScore: 0, aiScore: 0, owner: "none" }
      ]

      // Draw initial hands (4 cards each)
      const shuffledDeck = selectedCards.slice().sort(() => Math.random() - 0.5)
      const hand = shuffledDeck.slice(0, 4)
      const deck = shuffledDeck.slice(4)

      const shuffledAIDeck = aiDeck.slice().sort(() => Math.random() - 0.5)
      const aiHand = shuffledAIDeck.slice(0, 4)
      const aiDeckLeft = shuffledAIDeck.slice(4)

      setCcgState({
        round: 1,
        zones,
        hand,
        deck,
        aiHand,
        aiDeck: aiDeckLeft,
        phase: "placement",
        victory: null,
        roundHistory: []
      })

      setBattleState("battle")
    } catch (err) {
      setError("Ошибка соединения")
      setBattleState("idle")
    }
  }

  // Player deploys a card onto a zone
  const playCardToZone = (cardId: string, zoneId: string) => {
    if (!ccgState || ccgState.phase !== "placement") return
    if (isRoundConfirmed) return // Блокируем размещение после подтверждения

    // Limit to placing 2 cards per round
    if (placedThisRound.length >= 2) {
      return setError("Вы уже разместили 2 карты в этом раунде!")
    }
    if (placedThisRound.some(p => p.cardId === cardId)) return

    const card = ccgState.hand.find(c => c.uniqueId === cardId)
    if (!card) return

    setError(null)
    // 1st card in the round is OPEN (false isSecret), 2nd card is SECRET (true isSecret)
    const isSecret = placedThisRound.length === 1

    setPlacedPlacedThisRound(prev => [...prev, { cardId, zoneId, isSecret }])

    // AI responds using new AI Engine
    const aiCardIndex = aiPlacedThisRound.length
    if (aiCardIndex < 2 && ccgState.aiHand.length > 0 && aiEngineRef.current) {
      // Filter out already placed cards from AI hand
      const placedCardIds = aiPlacedThisRound.map(p => p.cardId)
      const availableAiHand = ccgState.aiHand.filter(c => !placedCardIds.includes(c.uniqueId))
      
      const context = createAIDecisionContext(
        availableAiHand,
        ccgState.aiDeck,
        ccgState.zones,
        ccgState.round,
        aiEngineRef.current.getConfig()
      )
      context.cardsPlacedThisRound = aiCardIndex
      context.opponentPlacements = placedThisRound.map(p => ({ zoneId: p.zoneId, isSecret: p.isSecret }))

      const decision = aiEngineRef.current.decideCard(context)
      if (decision) {
        setAiPlacedThisRound(prev => [...prev, { 
          cardId: decision.card.uniqueId, 
          zoneId: decision.zoneId, 
          isSecret: decision.isSecret 
        }])
      }
    }
  }

  // Cancel card deployment before revealing
  const recallCard = (cardId: string) => {
    if (isRoundConfirmed) return // Блокируем отзыв после подтверждения
    
    // Move the recalled card to the end of hand (Balatro-style move)
    setCcgState(prev => {
      if (!prev) return null
      const card = prev.hand.find(c => c.uniqueId === cardId)
      if (!card) return prev
      
      // Remove card from current position and add to end
      const newHand = prev.hand.filter(c => c.uniqueId !== cardId)
      newHand.push(card)
      
      return {
        ...prev,
        hand: newHand
      }
    })
    
    setPlacedPlacedThisRound(prev => prev.filter(p => p.cardId !== cardId))
  }

  // Reorganize hand by moving card from oldIndex to newIndex
  const reorganizeHand = useCallback((oldIndex: number, newIndex: number) => {
    setCcgState(prev => {
      if (!prev) return null
      const newHand = arrayMove(prev.hand, oldIndex, newIndex)
      return {
        ...prev,
        hand: newHand
      }
    })
  }, [])

  // Move card between zones during placement
  const moveCardBetweenZones = (cardId: string, newZoneId: string) => {
    if (isRoundConfirmed) return
    setPlacedPlacedThisRound(prev => 
      prev.map(p => p.cardId === cardId ? { ...p, zoneId: newZoneId } : p)
    )
  }

  // Confirm round placement, trigger reveal phase
  const confirmRoundPlacement = () => {
    if (!ccgState || placedThisRound.length < 2 || aiPlacedThisRound.length < 2) {
      return setError("Оба игрока должны разместить по 2 карты!")
    }

    setError(null)
    setIsRoundConfirmed(true) // Блокируем изменения после подтверждения
    const nextZones = ccgState.zones.map(z => ({ ...z, playerCards: [...z.playerCards], aiCards: [...z.aiCards] }))

    // Track placement order per zone
    const zoneCardCounts: Record<string, number> = {}
    ccgState.zones.forEach(z => {
      zoneCardCounts[z.id] = z.playerCards.length + z.aiCards.length
    })

    // 1. Move player's cards from hand to zones
    placedThisRound.forEach(p => {
      const card = ccgState.hand.find(c => c.uniqueId === p.cardId)
      if (card) {
        const zone = nextZones.find(z => z.id === p.zoneId)
        if (zone) {
          const currentOrder = zoneCardCounts[p.zoneId] || 0
          zone.playerCards.push({
            card,
            isSecret: p.isSecret,
            wasSecret: p.isSecret,
            powerAfterModifier: getCardBasePower(card), // temporary before reveal logic
            placementOrder: currentOrder
          })
          zoneCardCounts[p.zoneId] = currentOrder + 1
        }
      }
    })

    // Remove placed cards from player's hand
    const placedIds = placedThisRound.map(p => p.cardId)
    const nextHand = ccgState.hand.filter(c => !placedIds.includes(c.uniqueId))

    // 2. Move AI's cards from hand to zones (already selected during player's placement)
    aiPlacedThisRound.forEach(p => {
      const card = ccgState.aiHand.find(c => c.uniqueId === p.cardId)
      if (card) {
        const zone = nextZones.find(z => z.id === p.zoneId)
        if (zone) {
          const currentOrder = zoneCardCounts[p.zoneId] || 0
          zone.aiCards.push({
            card,
            isSecret: p.isSecret,
            wasSecret: p.isSecret,
            powerAfterModifier: getCardBasePower(card),
            placementOrder: currentOrder
          })
          zoneCardCounts[p.zoneId] = currentOrder + 1
        }
      }
    })

    // Remove placed cards from AI hand
    const aiPlacedIds = aiPlacedThisRound.map(p => p.cardId)
    const nextAIHand = ccgState.aiHand.filter(c => !aiPlacedIds.includes(c.uniqueId))

    // 3. Update battle state to Reveal phase
    setCcgState(prev => {
      if (!prev) return null
      return {
        ...prev,
        zones: nextZones,
        hand: nextHand,
        aiHand: nextAIHand,
        phase: "reveal",
        roundHistory: [
          ...prev.roundHistory,
          {
            round: prev.round,
            playerActions: placedThisRound.map(p => {
              const c = prev.hand.find(card => card.uniqueId === p.cardId)
              return { zoneId: p.zoneId, cardName: c?.name || "Герой", isSecret: p.isSecret }
            }),
            aiActions: aiPlacedThisRound.map(p => {
              const c = prev.aiHand.find(card => card.uniqueId === p.cardId)
              return { zoneId: p.zoneId, cardName: c?.name || "Враг", isSecret: p.isSecret }
            })
          }
        ]
      }
    })

    setPlacedPlacedThisRound([])
    setAiPlacedThisRound([])
  }

  // Evaluates end-of-round scores with actual matchups and transitions to next round/results
  const nextRound = () => {
    if (!ccgState) return

    // Trigger modifier activation animations for all zones
    ccgState.zones.forEach(zone => {
      triggerModifierActivation(zone.id)
    })

    const nextZones = ccgState.zones.map(zone => {
      console.log(`[Battle Round ${ccgState.round}] Processing zone ${zone.id}:`, {
        playerCardsBefore: zone.playerCards.length,
        aiCardsBefore: zone.aiCards.length,
        modifier: zone.modifier.id
      })

      // Reveal all secret cards
      const playerCards = zone.playerCards.map(zc => ({ ...zc, isSecret: false }))
      const aiCards = zone.aiCards.map(zc => ({ ...zc, isSecret: false }))

      // Provocation Point: Guard secret cards force-reveal enemy secret cards on the same zone
      if (zone.modifier.id === "provocation_point") {
        const hasGuardSecret = playerCards.some(zc => (zc.card.role || getCardRole(zc.card)) === "guard" && zc.wasSecret)
        const hasAIGuardSecret = aiCards.some(zc => (zc.card.role || getCardRole(zc.card)) === "guard" && zc.wasSecret)
        if (hasGuardSecret) aiCards.forEach(zc => { zc.isSecret = false })
        if (hasAIGuardSecret) playerCards.forEach(zc => { zc.isSecret = false })
      }

      // Evaluate power modifiers and KNB matchups
      // Calculate player HP percentage for last_stand modifier
      const playerHpPercent = progress ? (progress.current_stamina / progress.max_stamina) * 100 : 100

      // Prepare deck context for player cards (synergies, leader, formation)
      const deckContext: DeckContext = {
        deck: selectedCards,
        leaderId,
        formation,
      }

      playerCards.forEach(zc => {
        const { power, roleMatchupBonus, synergyBonus } = calculateCardPowerOnZone(zc.card, zone.modifier.id, aiCards, playerCards, true, zc.wasSecret || false, true, zc.placementOrder || 0, playerHpPercent, deckContext)
        const oldPower = zc.powerAfterModifier
        zc.powerAfterModifier = power
        zc.roleMatchupBonus = roleMatchupBonus
        zc.synergyBonus = synergyBonus
        console.log(`[Battle Round ${ccgState.round}] Player card ${zc.card.name}:`, {
          basePower: getCardBasePower(zc.card),
          oldPower,
          newPower: power,
          roleMatchupBonus,
          synergyBonus,
          wasSecret: zc.wasSecret
        })

        // Trigger animations based on changes
        if (roleMatchupBonus > 0) {
          triggerCardEffect(zc.card.uniqueId, 'knb-win')
        } else if (roleMatchupBonus < 0) {
          triggerCardEffect(zc.card.uniqueId, 'knb-loss')
        }
        if (synergyBonus > 0) {
          triggerCardEffect(zc.card.uniqueId, 'synergy')
        }
        if (power > oldPower) {
          triggerCardEffect(zc.card.uniqueId, 'buff')
        } else if (power < oldPower) {
          triggerCardEffect(zc.card.uniqueId, 'debuff')
        }
      })

      aiCards.forEach(zc => {
        const { power, roleMatchupBonus, synergyBonus } = calculateCardPowerOnZone(zc.card, zone.modifier.id, playerCards, aiCards, true, zc.wasSecret || false, false, zc.placementOrder || 0, playerHpPercent)
        const oldPower = zc.powerAfterModifier
        zc.powerAfterModifier = power
        zc.roleMatchupBonus = roleMatchupBonus
        zc.synergyBonus = synergyBonus
        console.log(`[Battle Round ${ccgState.round}] AI card ${zc.card.name}:`, {
          basePower: getCardBasePower(zc.card),
          oldPower,
          newPower: power,
          roleMatchupBonus,
          synergyBonus,
          wasSecret: zc.wasSecret
        })

        // Trigger animations based on changes
        if (roleMatchupBonus > 0) {
          triggerCardEffect(zc.card.uniqueId, 'knb-win')
        } else if (roleMatchupBonus < 0) {
          triggerCardEffect(zc.card.uniqueId, 'knb-loss')
        }
        if (synergyBonus > 0) {
          triggerCardEffect(zc.card.uniqueId, 'synergy')
        }
        if (power > oldPower) {
          triggerCardEffect(zc.card.uniqueId, 'buff')
        } else if (power < oldPower) {
          triggerCardEffect(zc.card.uniqueId, 'debuff')
        }
      })

      // Sabotage Camp: Tricksters reduce enemy secret card power by 100
      // Iron Curtain: Guards are protected from sabotage (checked in utils.ts)
      if (zone.modifier.id === "sabotage_camp") {
        const playerTricksters = playerCards.filter(zc => (zc.card.role || getCardRole(zc.card)) === "trickster")
        const aiTricksters = aiCards.filter(zc => (zc.card.role || getCardRole(zc.card)) === "trickster")
        aiCards.forEach(zc => {
          const isGuard = (zc.card.role || getCardRole(zc.card)) === "guard"
          if (zc.wasSecret && !isGuard) {
            zc.powerAfterModifier -= 100 * playerTricksters.length
            triggerCardEffect(zc.card.uniqueId, 'debuff')
          }
        })
        playerCards.forEach(zc => {
          const isGuard = (zc.card.role || getCardRole(zc.card)) === "guard"
          if (zc.wasSecret && !isGuard) {
            zc.powerAfterModifier -= 100 * aiTricksters.length
            triggerCardEffect(zc.card.uniqueId, 'debuff')
          }
        })
      }

      // Stamina Drain: strongest card gives 100 power to weakest card on the same zone
      if (zone.modifier.id === "stamina_drain" && (playerCards.length + aiCards.length) > 1) {
        const allZoneCards = [...playerCards, ...aiCards]
        allZoneCards.sort((a, b) => a.powerAfterModifier - b.powerAfterModifier)
        const weakest = allZoneCards[0]
        const strongest = allZoneCards[allZoneCards.length - 1]
        if (weakest && strongest && weakest !== strongest) {
          strongest.powerAfterModifier -= 100
          weakest.powerAfterModifier += 100
          triggerCardEffect(strongest.card.uniqueId, 'debuff')
          triggerCardEffect(weakest.card.uniqueId, 'buff')
        }
      }

      // Kamikaze Rift: strongest card on the zone is destroyed (removed)
      if (zone.modifier.id === "kamikaze_rift" && (playerCards.length + aiCards.length) > 0) {
        const allZoneCards = [...playerCards, ...aiCards]
        allZoneCards.sort((a, b) => b.powerAfterModifier - a.powerAfterModifier)
        const strongest = allZoneCards[0]
        if (strongest) {
          triggerCardDestruction(strongest.card.uniqueId)
          if (playerCards.includes(strongest)) {
            const idx = playerCards.indexOf(strongest)
            if (idx >= 0) playerCards.splice(idx, 1)
          } else {
            const idx = aiCards.indexOf(strongest)
            if (idx >= 0) aiCards.splice(idx, 1)
          }
        }
      }

      // Royal battle rule: "battle_royale" -> Only the single strongest card survives on this zone
      let playerSurvived = [...playerCards]
      let aiSurvived = [...aiCards]
      if (zone.modifier.id === "battle_royale" && (playerCards.length > 0 || aiCards.length > 0)) {
        const allCards = [
          ...playerCards.map(c => ({ ...c, side: 'player' as const })),
          ...aiCards.map(c => ({ ...c, side: 'ai' as const }))
        ]
        allCards.sort((a, b) => b.powerAfterModifier - a.powerAfterModifier)
        const victor = allCards[0]
        
        // Trigger destruction for all cards except the victor
        allCards.forEach(c => {
          if (c.card.uniqueId !== victor.card.uniqueId) {
            triggerCardDestruction(c.card.uniqueId)
          }
        })
        
        playerSurvived = playerCards.filter(c => victor && victor.side === 'player' && c.card.uniqueId === victor.card.uniqueId)
        aiSurvived = aiCards.filter(c => victor && victor.side === 'ai' && c.card.uniqueId === victor.card.uniqueId)
      }

      const playerScore = playerSurvived.reduce((acc, c) => acc + c.powerAfterModifier, 0)
      const aiScore = aiSurvived.reduce((acc, c) => acc + c.powerAfterModifier, 0)

      let owner: "player" | "ai" | "none"
      if (zone.modifier.id === "reversal_gate") {
        owner = playerScore < aiScore ? "player" : aiScore < playerScore ? "ai" : "none"
      } else {
        owner = playerScore > aiScore ? "player" : aiScore > playerScore ? "ai" : "none"
      }

      console.log(`[Battle Round ${ccgState.round}] Zone ${zone.id} final result:`, {
        playerSurvived: playerSurvived.length,
        aiSurvived: aiSurvived.length,
        playerScore,
        aiScore,
        owner,
        modifier: zone.modifier.id
      })

      return {
        ...zone,
        playerCards: playerSurvived,
        aiCards: aiSurvived,
        playerScore,
        aiScore,
        owner
      }
    })

    // Cross-zone modifiers: gravity_well and overdrive
    console.log(`[Battle Round ${ccgState.round}] Applying cross-zone modifiers...`)
    nextZones.forEach((zone, index) => {
      if (zone.modifier.id === "gravity_well") {
        let adjacentCards = 0
        if (index > 0) adjacentCards += nextZones[index - 1].playerCards.length + nextZones[index - 1].aiCards.length
        if (index < nextZones.length - 1) adjacentCards += nextZones[index + 1].playerCards.length + nextZones[index + 1].aiCards.length
        const penalty = adjacentCards * 50
        console.log(`[Battle Round ${ccgState.round}] Gravity well on zone ${zone.id}:`, {
          adjacentCards,
          penalty,
          beforePlayerScore: zone.playerScore,
          beforeAiScore: zone.aiScore
        })
        zone.playerCards.forEach(zc => { zc.powerAfterModifier -= penalty })
        zone.aiCards.forEach(zc => { zc.powerAfterModifier -= penalty })
        zone.playerScore = zone.playerCards.reduce((acc, c) => acc + c.powerAfterModifier, 0)
        zone.aiScore = zone.aiCards.reduce((acc, c) => acc + c.powerAfterModifier, 0)
        zone.owner = zone.playerScore > zone.aiScore ? "player" : zone.aiScore > zone.playerScore ? "ai" : "none"
        console.log(`[Battle Round ${ccgState.round}] Gravity well after:`, {
          afterPlayerScore: zone.playerScore,
          afterAiScore: zone.aiScore,
          owner: zone.owner
        })
      }

      if (zone.modifier.id === "overdrive") {
        const allCards = [...zone.playerCards, ...zone.aiCards]
        if (allCards.length > 0) {
          const strongest = allCards.reduce((max, zc) => zc.powerAfterModifier > max.powerAfterModifier ? zc : max, allCards[0])
          const damage = Math.round(strongest.powerAfterModifier * 0.5)
          const isPlayerStrongest = zone.playerCards.some(zc => zc.card.uniqueId === strongest.card.uniqueId)
          console.log(`[Battle Round ${ccgState.round}] Overdrive on zone ${zone.id}:`, {
            strongestCard: strongest.card.name,
            strongestPower: strongest.powerAfterModifier,
            damage,
            isPlayerStrongest
          })
          if (index > 0) {
            const adj = nextZones[index - 1]
            console.log(`[Battle Round ${ccgState.round}] Overdrive damaging zone ${adj.id} (left):`, {
              beforePlayerScore: adj.playerScore,
              beforeAiScore: adj.aiScore
            })
            if (isPlayerStrongest) {
              adj.aiCards.forEach(zc => { zc.powerAfterModifier = Math.max(0, zc.powerAfterModifier - damage) })
            } else {
              adj.playerCards.forEach(zc => { zc.powerAfterModifier = Math.max(0, zc.powerAfterModifier - damage) })
            }
            // Recalculate scores from modified card powers
            adj.playerScore = adj.playerCards.reduce((acc, c) => acc + c.powerAfterModifier, 0)
            adj.aiScore = adj.aiCards.reduce((acc, c) => acc + c.powerAfterModifier, 0)
            if (adj.modifier.id !== "reversal_gate") {
              adj.owner = adj.playerScore > adj.aiScore ? "player" : adj.aiScore > adj.playerScore ? "ai" : "none"
            } else {
              adj.owner = adj.playerScore < adj.aiScore ? "player" : adj.aiScore < adj.playerScore ? "ai" : "none"
            }
            console.log(`[Battle Round ${ccgState.round}] Overdrive after damaging zone ${adj.id}:`, {
              afterPlayerScore: adj.playerScore,
              afterAiScore: adj.aiScore,
              owner: adj.owner
            })
          }
          if (index < nextZones.length - 1) {
            const adj = nextZones[index + 1]
            console.log(`[Battle Round ${ccgState.round}] Overdrive damaging zone ${adj.id} (right):`, {
              beforePlayerScore: adj.playerScore,
              beforeAiScore: adj.aiScore
            })
            if (isPlayerStrongest) {
              adj.aiCards.forEach(zc => { zc.powerAfterModifier = Math.max(0, zc.powerAfterModifier - damage) })
            } else {
              adj.playerCards.forEach(zc => { zc.powerAfterModifier = Math.max(0, zc.powerAfterModifier - damage) })
            }
            // Recalculate scores from modified card powers
            adj.playerScore = adj.playerCards.reduce((acc, c) => acc + c.powerAfterModifier, 0)
            adj.aiScore = adj.aiCards.reduce((acc, c) => acc + c.powerAfterModifier, 0)
            if (adj.modifier.id !== "reversal_gate") {
              adj.owner = adj.playerScore > adj.aiScore ? "player" : adj.aiScore > adj.playerScore ? "ai" : "none"
            } else {
              adj.owner = adj.playerScore < adj.aiScore ? "player" : adj.aiScore < adj.playerScore ? "ai" : "none"
            }
            console.log(`[Battle Round ${ccgState.round}] Overdrive after damaging zone ${adj.id}:`, {
              afterPlayerScore: adj.playerScore,
              afterAiScore: adj.aiScore,
              owner: adj.owner
            })
          }
        }
      }
    })

    const isMatchEnded = ccgState.round === 3

    if (!isMatchEnded) {
      // Draw remaining cards to Hand (Draw 2 cards up to max of 4)
      const nextRoundNum = ccgState.round + 1
      const cardsToDraw = 2

      const drawnPlayerCards = ccgState.deck.slice(0, cardsToDraw)
      const remainingDeck = ccgState.deck.slice(cardsToDraw)
      const nextHand = [...ccgState.hand, ...drawnPlayerCards]

      const drawnAICards = ccgState.aiDeck.slice(0, cardsToDraw)
      const remainingAIDeck = ccgState.aiDeck.slice(cardsToDraw)
      const nextAIHand = [...ccgState.aiHand, ...drawnAICards]

      setCcgState(prev => {
        if (!prev) return null
        return {
          ...prev,
          round: nextRoundNum,
          zones: nextZones,
          hand: nextHand,
          deck: remainingDeck,
          aiHand: nextAIHand,
          aiDeck: remainingAIDeck,
          phase: "placement",
          roundHistory: [...prev.roundHistory],
        }
      })

      // Reset placement tracking for new round
      setPlacedPlacedThisRound([])
      setAiPlacedThisRound([])
      setIsRoundConfirmed(false)
    } else {
      // Determine match winner based on Zone ownership
      let playerZonesWon = 0
      let aiZonesWon = 0

      nextZones.forEach(z => {
        if (z.owner === "player") playerZonesWon++
        else if (z.owner === "ai") aiZonesWon++
      })

      // Debug logging
      console.log('[Battle] Final zone ownership:', nextZones.map(z => ({ id: z.id, owner: z.owner, playerScore: z.playerScore, aiScore: z.aiScore })))
      console.log('[Battle] Player zones won:', playerZonesWon, 'AI zones won:', aiZonesWon)

      let victory = false
      if (playerZonesWon > aiZonesWon) {
        victory = true
      } else if (playerZonesWon === aiZonesWon) {
        // Tie breaker: sum total power across all zones
        const totalPlayerPower = nextZones.reduce((acc, z) => acc + z.playerScore, 0)
        const totalAIPower = nextZones.reduce((acc, z) => acc + z.aiScore, 0)
        console.log('[Battle] Tie breaker - Player total power:', totalPlayerPower, 'AI total power:', totalAIPower)
        victory = totalPlayerPower >= totalAIPower
      }

      // Calculate MVP (Strongest Player card deployed on any zone)
      let mvpCard = { name: "Герой", power: 0 }
      nextZones.forEach(z => {
        z.playerCards.forEach(zc => {
          if (zc.powerAfterModifier > mvpCard.power) {
            mvpCard = { name: zc.card.name, power: zc.powerAfterModifier }
          }
        })
      })

      // Generate rewards
      const baseCoins = selectedDungeon ? selectedDungeon.coins_reward_base : 50
      const baseDust = selectedDungeon ? selectedDungeon.dust_reward_base : 10
      const baseXp = selectedDungeon ? selectedDungeon.xp_reward_base : 25

      const coinsEarned = victory ? Math.round(baseCoins * (1 + Math.random() * 0.3)) : 0
      const dustEarned = victory ? Math.round(baseDust * (1 + Math.random() * 0.2)) : 0
      const xpEarned = victory ? Math.round(baseXp * (1 + Math.random() * 0.1)) : Math.round(baseXp * 0.2)

      setCcgState(prev => {
        if (!prev) return null
        return {
          ...prev,
          zones: nextZones,
          phase: "finalizing",
          victory,
          coinsEarned,
          dustEarned,
          xpEarned,
          mvpCard
        }
      })

      setBattleState("result")
    }
  }

  const finishBattle = async () => {
    setIsFinishing(true)
    try {
      // Transition from finalizing to ended phase to show results modal
      if (ccgState) {
        setCcgState(prev => {
          if (!prev) return null
          return {
            ...prev,
            phase: "ended"
          }
        })
      }

      // Process rewards and API calls in background
      if (ccgState && ccgState.victory) {
        const token = session?.access_token
        if (token) {
          try {
            // Send result log to the server
            await fetch('/api/battle', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                action: 'finish_battle',
                dungeonId: selectedDungeon?.id,
                result: 'win',
                coinsEarned: ccgState.coinsEarned || 0,
                dustEarned: ccgState.dustEarned || 0,
                xpEarned: ccgState.xpEarned || 0,
                turns: 3
              })
            })
          } catch (e) {
            console.error("Failed to post battle logs", e)
          }
        }
        await refreshCoins()
        await refreshDust()
      }
      await loadBattleData()
    } finally {
      setIsFinishing(false)
    }
  }

  const closeBattleResult = () => {
    setBattleState("idle")
    setCcgState(null)
  }

  const teamPower = {
    totalPower: selectedCards.reduce((acc: number, c: Card) => acc + getCardBasePower(c), 0),
    rating: selectedCards.reduce((acc: number, c: Card) => acc + getCardBasePower(c), 0) > 1000 ? "S" : "A",
    ratingColor: "from-amber-400 to-orange-500"
  }

  const filteredCards = collectedCards
    .filter(c => !teamSearch.trim() || c.name.toLowerCase().includes(teamSearch.toLowerCase()) || c.anime.toLowerCase().includes(teamSearch.toLowerCase()))
    .filter(c => selectedRole === "all" || (c.role || getCardRole(c)) === selectedRole)
    .sort((a: Card, b: Card) => {
      const getP = (c: Card) => c.stats.hp + c.stats.atk * 2 + c.stats.def + c.stats.spd + c.stats.luck
      switch (sortBy) {
        case "power": return getP(b) - getP(a)
        case "rarity":
          const r = ["trash", "common", "uncommon", "rare", "super_rare", "epic", "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"]
          return r.indexOf(a.rarity) - r.indexOf(b.rarity)
        case "provision": return (getCardProvision(b) || 0) - (getCardProvision(a) || 0)
        case "name": return a.name.localeCompare(b.name)
        case "anime": return a.anime.localeCompare(b.anime)
        default: return 0
      }
    })

  return {
    user,
    sessionLoading,
    userCoins,
    dust,
    progress,
    dungeons,
    enemies,
    logs,
    collectedCards,
    selectedCards, // DECK
    setSelectedCards,
    selectedDungeon,
    setSelectedDungeon,
    leaderId,
    setLeaderId,
    formation,
    setFormation,
    battleState,
    setBattleState,
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
    showTeamBuilder,
    setShowTeamBuilder,
    teamSearch,
    setTeamSearch,
    selectedRole,
    setSelectedRole,
    sortBy,
    // Animation states and functions
    cardEffects,
    destroyingCards,
    modifierActivations,
    floatingTexts,
    triggerCardEffect,
    triggerCardDestruction,
    triggerModifierActivation,
    addFloatingText,
    setSortBy,
    error,
    setError,
    staminaTime,
    toggleCardSelection,
    startBattle,
    finishBattle,
    closeBattleResult,
    isFinishing,
    teamPower,
    filteredCards,
  }
}
