import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { useCoins } from "@/hooks/use-coins"
import { useDust } from "@/hooks/use-dust"
import { arrayMove } from "@dnd-kit/sortable"
import { Card, Dungeon, Enemy, BattleProgress, BattleLog, CCGBattleState, BattleZone, ZoneCard, CardRole, DeckContext } from "../types"
import { getCardRole, getCardProvision, calculateCardPowerOnZone, getCardBasePower, computeDeckSynergies, buildAutoDeck } from "../utils"
import { PROVISION_LIMIT, DECK_SIZE, TERRITORY_MODIFIERS, FormationId, MAX_CARDS_PER_SIDE } from "../config"
import { Rarity } from "@/types/gacha"
import { getAIDeckForDungeon, getRandomMarketDeck, generateAdaptiveAIDeck } from "../ai-decks"
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
  const { coins: userCoins, loading: coinsLoading, addCoins, refresh: refreshCoins } = useCoins()
  const { dust, loading: dustLoading, addDust, refresh: refreshDust } = useDust()

  const [progress, setProgress] = useState<BattleProgress | null>(null)
  const [dungeons, setDungeons] = useState<Dungeon[]>([])
  const [enemies, setEnemies] = useState<Enemy[]>([])
  const [logs, setLogs] = useState<BattleLog[]>([])

  const [collectedCards, setCollectedCards] = useState<Card[]>([])
  const [selectedCards, setSelectedCards] = useState<Card[]>([]) // This is the player's DECK (max DECK_SIZE cards)
  const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null)
  const [leaderId, setLeaderId] = useState<string | null>(null)
  const [formation, setFormation] = useState<FormationId>("balance")
  const [isInitializing, setIsInitializing] = useState(true)

  // Refs to avoid re-creating saveDeckToAPI on every state change (prevents save spam)
  const selectedCardsRef = useRef<Card[]>([])
  const leaderIdRef = useRef<string | null>(null)
  const formationRef = useRef<FormationId>("balance")
  const saveDeckTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => { selectedCardsRef.current = selectedCards }, [selectedCards])
  useEffect(() => { leaderIdRef.current = leaderId }, [leaderId])
  useEffect(() => { formationRef.current = formation }, [formation])

  const [battleState, setBattleState] = useState<"idle" | "loading" | "battle" | "result">("idle")
  
  // CCG Match State
  const [ccgState, setCcgState] = useState<CCGBattleState | null>(null)
  const [placedThisRound, setPlacedPlacedThisRound] = useState<{ cardId: string; zoneId: string; isSecret: boolean }[]>([])
  const [aiPlacedThisRound, setAiPlacedThisRound] = useState<{ cardId: string; zoneId: string; isSecret: boolean }[]>([])
  const [isRoundConfirmed, setIsRoundConfirmed] = useState(false)
  const [placementCounter, setPlacementCounter] = useState(0) // Track actual placement count
  const usedCardIdsRef = useRef<Set<string>>(new Set()) // Track all cards used across all rounds (ref for immediate updates)
  
  // PvP opponent deck context for calculating formation/synergy bonuses
  const [opponentDeckContext, setOpponentDeckContext] = useState<DeckContext | null>(null)
  const [isPvPMode, setIsPvPMode] = useState(false)

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
  const battleTokenRef = useRef<string | null>(null)

  // AI Engine instance
  const aiEngineRef = useRef<ReturnType<typeof createAI> | null>(null)

  const loadBattleData = useCallback(async () => {
    if (!user) return

    const abortController = new AbortController()
    const timeoutId = setTimeout(() => {
      abortController.abort()
      console.error('[BattlePage] loadBattleData timeout after 15 seconds')
    }, 15000)

    try {
      const accessToken = session?.access_token
      if (!accessToken) return
      console.log('[BattlePage] Loading battle data...')
      const res = await fetch('/api/battle?mode=all', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: abortController.signal
      })
      if (res.ok) {
        const data = await res.json()
        setProgress(data.progress)
        setDungeons(data.dungeons || [])
        setEnemies(data.enemies)
        setLogs(data.logs || [])
      }

      // Load saved deck
      const deckRes = await fetch('/api/battle/deck', {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: abortController.signal
      })
      if (deckRes.ok) {
        const deckData = await deckRes.json()
        console.log('[BattlePage] Loaded deck from API:', deckData)
        if (deckData.formation) {
          setFormation(deckData.formation)
        }
        if (deckData.leader_id) {
          setLeaderId(deckData.leader_id)
        }
        // Cards will be loaded separately and matched with saved IDs
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        console.error('[BattlePage] loadBattleData was aborted (timeout)')
        setError("Не удалось загрузить данные боя. Проверьте соединение и обновите страницу.")
      } else {
        console.error('[BattlePage] Error loading battle data:', err)
      }
    } finally {
      clearTimeout(timeoutId)
      setIsInitializing(false)
    }
  }, [user, session])

  const loadUserCards = useCallback(async () => {
    if (!user) return
    try {
      let rawCards: any[] = []

      // Primary: use /api/cards with explicit session token (reliable during client-side navigation)
      const accessToken = session?.access_token
      if (accessToken) {
        try {
          const res = await fetch('/api/cards', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          })
          if (res.ok) {
            const data = await res.json()
            if (data.cards && Array.isArray(data.cards)) {
              rawCards = data.cards.map((c: any) => ({
                unique_id: c.uniqueId,
                name: c.name,
                anime: c.anime,
                rarity: c.rarity,
                image_url: c.imageUrl,
                stats_hp: c.stats?.hp ?? 0,
                stats_atk: c.stats?.atk ?? 0,
                stats_def: c.stats?.def ?? 0,
                stats_spd: c.stats?.spd ?? 0,
                stats_luck: c.stats?.luck ?? 0,
                is_main_character: c.isMainCharacter || false,
                score: c.score,
                art_position: c.artPosition || null,
              }))
            }
          }
        } catch (apiErr) {
          console.error('[BattlePage] /api/cards fetch failed, falling back to supabase.rpc:', apiErr)
        }
      }

      // Fallback: use supabase.rpc if API didn't return cards
      if (rawCards.length === 0) {
        const { supabase } = await import("@/lib/supabase")
        const { data, error } = await supabase.rpc('get_battle_available_cards', {
          p_user_id: user.id
        })

        if (!error && data) {
          rawCards = data
        } else {
          const { data: fallbackData } = await supabase
            .from('user_cards')
            .select('unique_id, name, anime, rarity, image_url, stats_hp, stats_atk, stats_def, stats_spd, stats_luck, is_main_character, score, art_position')
            .eq('user_id', user.id)
          if (fallbackData) rawCards = fallbackData
        }
      }

      const mapped = rawCards.map((c: any) => {
        const mappedCard: Card = {
          uniqueId: c.unique_id, name: c.name, anime: c.anime, rarity: c.rarity as Rarity, imageUrl: c.image_url,
          stats: { hp: c.stats_hp, atk: c.stats_atk, def: c.stats_def, spd: c.stats_spd, luck: c.stats_luck },
          isMainCharacter: c.is_main_character || false, score: c.score,
          artPosition: c.art_position || undefined,
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
        // Fallback: auto-build deck from collected cards
        const { deck: autoDeck, leaderId: autoLeader, totalProvision: autoProv } = buildAutoDeck(mapped)

        if (autoDeck.length > 0) {
          autoDeck.forEach((c: Card) => {
            c.provisionCost = getCardProvision(c)
            c.role = getCardRole(c)
          })
          setSelectedCards(autoDeck)
          if (autoLeader) {
            setLeaderId(autoLeader)
          }
          if (autoProv > PROVISION_LIMIT) {
            console.warn('[BattlePage] Auto-deck exceeds provision limit:', autoProv, '/', PROVISION_LIMIT)
          }
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

  // Save deck to API — debounced and using refs to keep callback identity stable
  const saveDeckToAPI = useCallback(async (cardIds?: string[], currentLeaderId?: string | null, currentFormation?: FormationId) => {
    if (!user || !session || isInitializing) return

    const cardsToSave = cardIds || selectedCardsRef.current.map(c => c.uniqueId)
    const leaderToSave = currentLeaderId !== undefined ? currentLeaderId : leaderIdRef.current
    const formationToSave = currentFormation !== undefined ? currentFormation : formationRef.current

    // Debounce: clear previous timer and set a new one
    if (saveDeckTimerRef.current) clearTimeout(saveDeckTimerRef.current)
    saveDeckTimerRef.current = setTimeout(async () => {
      try {
        console.log('[BattlePage] Saving deck to API:', { leaderId: leaderToSave, formation: formationToSave, cardCount: cardsToSave.length })
        const res = await fetch('/api/battle/deck', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            card_ids: cardsToSave,
            leader_id: leaderToSave,
            formation: formationToSave
          })
        })
        if (!res.ok) {
          const error = await res.json()
          console.error('[BattlePage] API Error saving deck:', error)
        } else {
          console.log('[BattlePage] Deck saved successfully')
        }
      } catch (err) {
        console.error('[BattlePage] Error saving deck to API:', err)
      }
    }, 800)
  }, [user, session, isInitializing])

  useEffect(() => {
    if (user && !isInitializing) {
      if (leaderId) {
        localStorage.setItem(`battle_leader_${user.id}`, leaderId)
      } else {
        localStorage.removeItem(`battle_leader_${user.id}`)
      }
      saveDeckToAPI(undefined, leaderId, undefined)
    }
  }, [leaderId, user, isInitializing, saveDeckToAPI])

  useEffect(() => {
    if (user && !isInitializing) {
      localStorage.setItem(`battle_formation_${user.id}`, formation)
      saveDeckToAPI(undefined, undefined, formation)
    }
  }, [formation, user, isInitializing, saveDeckToAPI])

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

  // Update PvP round with new cards from server
  const updatePvPRound = useCallback((newDeck: Card[], newRound?: number) => {
    if (!ccgState) return
    
    console.log('[Battle] Updating PvP round with new deck:', newDeck.length, 'round:', newRound)
    
    // Process new deck to ensure roles and provision costs are set
    const processedDeck = newDeck.map(c => ({
      ...c,
      role: c.role || getCardRole(c),
      provisionCost: c.provisionCost || getCardProvision(c)
    }))
    
    // Exclude cards that have been used in previous rounds
    const availableDeck = processedDeck.filter(card => !usedCardIdsRef.current.has(card.uniqueId))
    
    // Draw 4 cards for hand (initial or after each round)
    const newHand = availableDeck.slice(0, 4)
    const remainingDeck = availableDeck.slice(4)
    
    setCcgState(prev => {
      if (!prev) return null
      return {
        ...prev,
        round: newRound ?? prev.round,
        hand: newHand,
        deck: remainingDeck,
        phase: 'placement'
      }
    })
    
    setPlacedPlacedThisRound([])
    setAiPlacedThisRound([])
    setPlacementCounter(0)
    setIsRoundConfirmed(false)
  }, [ccgState])

  // Resolve PvP round using results from server
  const resolvePvPRound = useCallback((results: any, isPlayer1: boolean) => {
    if (!ccgState) return

    console.log('[Battle] Resolving PvP round with results:', results, 'isPlayer1:', isPlayer1)
    console.log('[Battle] Current zones before resolve:', ccgState.zones.map(z => ({
      id: z.id,
      playerCards: z.playerCards.map(zc => ({ id: zc.card.uniqueId, name: zc.card.name })),
      aiCards: z.aiCards.map(zc => ({ id: zc.card.uniqueId, name: zc.card.name }))
    })))

    const userPlacements = isPlayer1 ? results.player1Placements : results.player2Placements
    const opponentPlacements = isPlayer1 ? results.player2Placements : results.player1Placements

    console.log('[Battle] User placements this round:', userPlacements?.map((p: any) => ({ cardId: p.cardId, zoneId: p.zoneId, isSecret: p.isSecret })))
    console.log('[Battle] Opponent placements this round:', opponentPlacements?.map((p: any) => ({ cardId: p.cardId, zoneId: p.zoneId, isSecret: p.isSecret })))

    const currentRoundPlacedIds = (userPlacements || []).map((p: any) => p.cardId)
    const currentRoundOpponentPlacedIds = (opponentPlacements || []).map((p: any) => p.cardId)

    // Add only player's placed cards to usedCardIds set (not opponent's cards)
    currentRoundPlacedIds.forEach((id: string) => usedCardIdsRef.current.add(id))

    const nextZones = ccgState.zones.map((zone, idx) => {
      const zoneResult = results.zoneResults[idx]
      const serverPlayerCards = isPlayer1 ? zoneResult.player1Cards : zoneResult.player2Cards
      const serverOpponentCards = isPlayer1 ? zoneResult.player2Cards : zoneResult.player1Cards

      // Keep existing cards from previous rounds, add/update with server data
      const existingPlayerCards = zone.playerCards.filter(zc => !currentRoundPlacedIds.includes(zc.card.uniqueId))
      const existingOpponentCards = zone.aiCards.filter(zc => !currentRoundOpponentPlacedIds.includes(zc.card.uniqueId))

      const newPlayerCards = (serverPlayerCards || []).map((item: any) => {
        return {
          card: item.card,
          isSecret: false, // All cards are revealed after round resolution
          wasSecret: item.wasSecret,
          powerAfterModifier: item.powerAfterModifier,
          placementOrder: item.placementOrder ?? 0,
          isPlayer: true,
          roleMatchupBonus: item.roleMatchupBonus,
          synergyBonus: item.synergyBonus
        }
      })

      const newOpponentCards = (serverOpponentCards || []).map((item: any) => {
        return {
          card: item.card,
          isSecret: false, // All cards are revealed after round resolution
          wasSecret: item.wasSecret,
          powerAfterModifier: item.powerAfterModifier,
          placementOrder: item.placementOrder ?? 0,
          isPlayer: false,
          roleMatchupBonus: item.roleMatchupBonus,
          synergyBonus: item.synergyBonus
        }
      })

      return {
        ...zone,
        playerCards: [...existingPlayerCards, ...newPlayerCards],
        aiCards: [...existingOpponentCards, ...newOpponentCards]
      }
    })

    // Determine zone owners from server scores
    const nextZonesWithOwners = nextZones.map((zone, idx) => {
      const zoneResult = results.zoneResults[idx]
      const p1Power = zoneResult?.player1Power ?? 0
      const p2Power = zoneResult?.player2Power ?? 0
      const playerPower = isPlayer1 ? p1Power : p2Power
      const opponentPower = isPlayer1 ? p2Power : p1Power
      const owner: 'player' | 'ai' | 'none' = playerPower > opponentPower ? 'player' : opponentPower > playerPower ? 'ai' : 'none'
      return {
        ...zone,
        playerScore: playerPower,
        aiScore: opponentPower,
        owner
      }
    })

    console.log('[Battle] Zones after resolve with cards:', nextZonesWithOwners.map(z => ({
      id: z.id,
      playerCards: z.playerCards.map(zc => ({ id: zc.card.uniqueId, name: zc.card.name })),
      aiCards: z.aiCards.map(zc => ({ id: zc.card.uniqueId, name: zc.card.name }))
    })))

    const placedIds = (userPlacements || []).map((p: any) => p.cardId)
    const nextHand = ccgState.hand.filter(c => !placedIds.includes(c.uniqueId))

    setCcgState(prev => {
      if (!prev) return null
      return {
        ...prev,
        zones: nextZonesWithOwners,
        hand: nextHand,
        phase: "reveal",
        roundHistory: [
          ...prev.roundHistory,
          {
            round: prev.round,
            playerActions: (userPlacements || []).map((p: any) => {
              const c = prev.hand.find(card => card.uniqueId === p.cardId)
              return { zoneId: p.zoneId, cardName: c?.name || "Герой", isSecret: p.isSecret }
            }),
            aiActions: (opponentPlacements || []).map((p: any) => {
              const zc = nextZones.find(z => z.id === p.zoneId)
              const cardInZone = zc?.aiCards.find((ac: any) => ac.card.uniqueId === p.cardId)?.card
              return { zoneId: p.zoneId, cardName: cardInZone?.name || "Противник", isSecret: p.isSecret }
            })
          }
        ]
      }
    })

    setPlacedPlacedThisRound([])
    setAiPlacedThisRound([])
    setPlacementCounter(0)
    setIsRoundConfirmed(false)
    setError(null)
  }, [ccgState])

  // Resolve PvP match end using winner from server
  const resolvePvPMatchEnd = useCallback((winnerId: string, reason?: string) => {
    if (!user) return
    const isWinner = winnerId === user.id
    console.log('[Battle] Resolving PvP match end, winner:', winnerId, 'isUserWinner:', isWinner, 'reason:', reason)
    
    // Set victory flag and transition to finalizing phase.
    setCcgState(prev => {
      if (!prev) return null
      return {
        ...prev,
        victory: isWinner,
        phase: "finalizing",
        endReason: reason || 'normal'
      }
    })

    // In PvP, we might want to refresh profile for MMR updates immediately
    refreshCoins()
  }, [user, refreshCoins])

  const autoBuildDeck = useCallback((keepCards?: Card[]) => {
    if (collectedCards.length === 0) {
      setError("У вас нет карт! Получите карты в гаче.")
      return
    }

    const { deck, leaderId: autoLeader, totalProvision } = buildAutoDeck(collectedCards, keepCards)

    if (deck.length === 0) {
      setError("Не удалось собрать колоду.")
      return
    }

    // Ensure roles and provision costs are set
    deck.forEach((c: Card) => {
      c.provisionCost = getCardProvision(c)
      c.role = getCardRole(c)
    })

    setSelectedCards(deck)
    setLeaderId(autoLeader)
    setFormation("balance")

    // Save to localStorage and API
    if (user) {
      const cardIds = deck.map(c => c.uniqueId)
      localStorage.setItem(`battle_deck_${DECK_SIZE}_${user.id}`, JSON.stringify(cardIds))
      if (autoLeader) {
        localStorage.setItem(`battle_leader_${user.id}`, autoLeader)
      }
      localStorage.setItem(`battle_formation_${user.id}`, "balance")
      saveDeckToAPI(cardIds, autoLeader, "balance")
    }

    if (totalProvision > PROVISION_LIMIT) {
      setError(`Автосборка: вес ${totalProvision}/${PROVISION_LIMIT}. Замените тяжёлые карты на более лёгкие.`)
    } else {
      setError(null)
    }
  }, [collectedCards, user, saveDeckToAPI])

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
          // Save to API with current card IDs (only if deck is not empty)
          if (next.length > 0) {
            saveDeckToAPI(next.map(c => c.uniqueId))
          }
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
        // Save to API with current card IDs
        saveDeckToAPI(next.map(c => c.uniqueId))
      }
      return next
    })
  }

  // CCG GAMEPLAY ACTIONS
  // Start PvP Battle with match data from server
  const startPvPBattle = (matchData: any) => {
    console.log('[Battle] Starting PvP battle with match data:', matchData)
    
    try {
      setError(null)
      setPlacedPlacedThisRound([])
      setAiPlacedThisRound([])
      setPlacementCounter(0)
      setIsRoundConfirmed(false)
      usedCardIdsRef.current = new Set()

      if (matchData.opponentDeck) {
        const opponentDeck = matchData.opponentDeck.map((c: any) => ({
          ...c,
          role: c.role || getCardRole(c),
          provisionCost: c.provisionCost || getCardProvision(c)
        }))
        setOpponentDeckContext({
          deck: opponentDeck,
          leaderId: matchData.opponentLeaderId,
          formation: matchData.opponentFormation
        })
      }

      const zones: BattleZone[] = matchData.territories.map((t: any, idx: number) => ({
        id: `zone-${idx + 1}`,
        name: t.name || `Линия ${idx + 1}`,
        nameRu: t.nameRu || `Линия ${idx + 1}`,
        modifier: {
          id: t.id,
          name: t.name,
          nameRu: t.nameRu,
          description: t.description
        },
        playerCards: [],
        aiCards: [],
        playerScore: 0,
        aiScore: 0,
        owner: "none"
      }))

      const playerDeck = matchData.yourDeck.map((c: any) => ({
        ...c,
        role: c.role || getCardRole(c),
        provisionCost: c.provisionCost || getCardProvision(c)
      }))

      const hand = playerDeck.slice(0, 4)
      const deck = playerDeck.slice(4)

      setCcgState({
        round: 1,
        zones,
        hand,
        deck,
        aiHand: [],
        aiDeck: [],
        phase: "placement",
        victory: null,
        roundHistory: []
      })

      setBattleState("battle")
      setIsPvPMode(true)
    } catch (error) {
      console.error('[Battle] Error in startPvPBattle:', error)
      setError('Ошибка инициализации PvP боя')
      setBattleState("idle")
    }
  }

  const startBattle = async () => {
    console.log('[Battle] startBattle called')
    console.log('[Battle] selectedCards length:', selectedCards.length)
    console.log('[Battle] selectedDungeon:', selectedDungeon?.id)
    console.log('[Battle] progress stamina:', progress?.current_stamina)
    
    if (selectedCards.length !== DECK_SIZE) {
      console.log('[Battle] Deck size validation failed')
      return setError(`Колода должна содержать ровно ${DECK_SIZE} карт! Сейчас: ${selectedCards.length}`)
    }
    const totalProv = selectedCards.reduce((acc: number, c: Card) => acc + (c.provisionCost || getCardProvision(c)), 0)
    if (totalProv > PROVISION_LIMIT) {
      console.log('[Battle] Provision limit validation failed')
      return setError(`Превышен лимит веса колоды (${totalProv}/${PROVISION_LIMIT} очков)!`)
    }
    if (!selectedDungeon) {
      console.log('[Battle] No dungeon selected')
      return setError("Выберите подземелье!")
    }
    if (progress && progress.current_stamina < selectedDungeon.energy_cost) {
      console.log('[Battle] Insufficient stamina')
      return setError("Недостаточно энергии!")
    }
    // Validate leader is in deck
    if (leaderId && !selectedCards.some(c => c.uniqueId === leaderId)) {
      console.log('[Battle] Leader not in deck')
      return setError("Лидер должен быть в колоде!")
    }

    console.log('[Battle] All validations passed, setting battleState to loading')
    setError(null)
    setBattleState("loading")
    setPlacedPlacedThisRound([])
    setAiPlacedThisRound([])
    setPlacementCounter(0)
    setIsRoundConfirmed(false)

    try {
      console.log('[Battle] Entering try block')
      const token = session?.access_token
      console.log('[Battle] Token check:', !!token)
      if (!token) return setError("Необходима авторизация")

      console.log('[Battle] Creating AbortController')
      // Create AbortController for timeout
      const abortController = new AbortController()
      const timeoutId = setTimeout(() => {
        abortController.abort()
        console.error('[Battle] API request timeout after 10 seconds')
      }, 10000)

      console.log('[Battle] About to call API /api/battle')
      console.log('[Battle] Request body:', {
        action: 'start_battle',
        dungeonId: selectedDungeon.id,
        playerCardsCount: selectedCards.length
      })
      
      // Call API to spend stamina and register battle
      const spendRes = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          action: 'start_battle',
          dungeonId: selectedDungeon.id,
          playerCards: selectedCards.slice(0, 3).map(c => ({ uniqueId: c.uniqueId, name: c.name, stats: c.stats, rarity: c.rarity })) // Old payload compatibility
        }),
        signal: abortController.signal
      })

      console.log('[Battle] API call completed, response status:', spendRes.status)
      clearTimeout(timeoutId)

      if (!spendRes.ok) {
        const data = await spendRes.json()
        console.error('[Battle] API Error:', data)
        setError(data.message || "Ошибка списания энергии")
        setBattleState("idle")
        return
      }

      // Check for abort (timeout)
      if (abortController.signal.aborted) {
        console.error('[Battle] Request was aborted (timeout)')
        setError("Превышено время ожидания ответа сервера. Проверьте соединение.")
        setBattleState("idle")
        return
      }

      // Store battle session token for anti-replay protection
      const spendData = await spendRes.json()
      battleTokenRef.current = spendData.battleToken || null
      console.log('[Battle] Battle token stored:', !!battleTokenRef.current)

      // Generate AI Deck from pre-defined deck for this dungeon
      console.log('[Battle] Generating AI deck for dungeon:', selectedDungeon.id)
      let predefinedDeck: Card[]
      if (selectedDungeon.id?.startsWith('daily-market-')) {
        // Use random market deck for daily market battles
        console.log('[Battle] Using random market deck')
        predefinedDeck = getRandomMarketDeck()
      } else {
        const dungeonTheme = selectedDungeon.is_daily ? 'daily' : selectedDungeon.theme
        console.log('[Battle] Getting AI deck for theme:', dungeonTheme)
        predefinedDeck = getAIDeckForDungeon(dungeonTheme)
      }
      console.log('[Battle] AI deck generated, size:', predefinedDeck.length)

      const serverAIConfig = (spendData.aiConfig || {}) as Partial<AIConfig> & { counterPickStrength?: number }
      const playerCardUsage = selectedCards.map(card => ({
        cardId: card.uniqueId,
        cardName: card.name,
        anime: card.anime,
        rarity: card.rarity,
        role: card.role || getCardRole(card),
        usageCount: 1,
        lastUsed: Date.now(),
        winRate: 0,
        totalBattles: 0,
        wins: 0,
      }))
      predefinedDeck = generateAdaptiveAIDeck(
        playerCardUsage,
        predefinedDeck,
        PROVISION_LIMIT,
        serverAIConfig.counterPickStrength
      )

      // Initialize AI Engine with strategic strategy and adaptive learning
      console.log('[Battle] Initializing AI engine')
      aiEngineRef.current = createAI({
        strategy: "adaptive",
        enableLogging: false, // Disable logging in production
        logLevel: "none",
        aggressiveness: 0.6,
        defensiveness: 0.4,
        bluffChance: 0.3,
        ...serverAIConfig,
      })
      console.log('[Battle] AI engine initialized')
      
      console.log('[Battle] Processing AI deck')
      // Deduplicate by name + anime to prevent identical characters in AI deck
      const seenChars = new Set<string>()
      const dedupedPredefined = predefinedDeck.filter(c => {
        const key = `${c.name}|${c.anime}`
        if (seenChars.has(key)) return false
        seenChars.add(key)
        return true
      })
      const aiDeck = dedupedPredefined
        .slice()
        .sort(() => Math.random() - 0.5)
        .slice(0, DECK_SIZE)
        .map((c, idx) => ({
          ...c,
          uniqueId: `ai-card-${idx}-${Date.now()}`,
          role: getCardRole(c),
          provisionCost: getCardProvision(c)
        }))
      console.log('[Battle] AI deck processed, size:', aiDeck.length)

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
      console.log('[Battle] Hands drawn, player hand:', hand.length, 'AI hand:', aiHand.length)

      console.log('[Battle] Setting CCG state')
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
      console.log('[Battle] CCG state set')

      console.log('[Battle] Setting battleState to "battle"')
      setBattleState("battle")
      setIsPvPMode(false)
    } catch (err: any) {
      console.error('[Battle] Error in startBattle:', err)
      
      if (err.name === 'AbortError') {
        setError("Превышено время ожидания ответа сервера. Проверьте соединение.")
      } else {
        setError(err.message || "Ошибка соединения с сервером")
      }
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

    // Check max cards per side limit (4 cards per zone)
    const zone = ccgState.zones.find(z => z.id === zoneId)
    if (zone) {
      const playerCardsInZone = zone.playerCards.length
      const pendingInZone = placedThisRound.filter(p => p.zoneId === zoneId).length
      const totalInZone = playerCardsInZone + pendingInZone
      
      if (totalInZone >= MAX_CARDS_PER_SIDE) {
        return setError(`На этой зоне уже ${totalInZone}/${MAX_CARDS_PER_SIDE} карт!`)
      }
    }

    setError(null)
    // 1st card in the round is OPEN (false isSecret), 2nd card is SECRET (true isSecret)
    // Use placementCounter to track actual placement order, not array length
    const isSecret = placementCounter === 1

    setPlacedPlacedThisRound(prev => [...prev, { cardId, zoneId, isSecret }])
    setPlacementCounter(prev => prev + 1)

    // In PvP mode, we don't need AI responses
    if (isPvPMode) return

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
      
      // Inject already placed AI cards in this round into the context zones for the evaluation logic
      context.zones = context.zones.map(zone => {
        const pendingForZone = aiPlacedThisRound.filter(p => p.zoneId === zone.id)
        if (pendingForZone.length > 0) {
          const pendingCards: ZoneCard[] = pendingForZone.map(p => {
            const card = ccgState.aiHand.find(c => c.uniqueId === p.cardId)
            const basePower = getCardBasePower(card!)
            return {
              card: card!,
              isSecret: p.isSecret,
              powerAfterModifier: basePower, // Evaluation logic uses basePower internally if it needs to
            }
          })
          return {
            ...zone,
            aiCards: [...zone.aiCards, ...pendingCards]
          }
        }
        return zone
      })

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
  const confirmRoundPlacement = (isPvP?: boolean, pvpMatchId?: string, placeCards?: (matchId: string, placements: any[]) => void) => {
    if (!ccgState || placedThisRound.length < 2) {
      return setError("Вы должны разместить 2 карты!")
    }

    // In PvP mode, validate cards haven't been used before sending to server
    if (isPvP) {
      const duplicateCards = placedThisRound.filter(p => usedCardIdsRef.current.has(p.cardId))
      if (duplicateCards.length > 0) {
        return setError("Эти карты уже были использованы в предыдущих раундах!")
      }
    }

    // In PvP mode, send placements to server and wait for opponent
    if (isPvP && pvpMatchId && placeCards) {
      console.log('[Battle] Sending PvP placements to server:', placedThisRound.map(p => ({ cardId: p.cardId, zoneId: p.zoneId, isSecret: p.isSecret })))
      console.log('[Battle] Placement counter:', placementCounter)
      placeCards(pvpMatchId, placedThisRound)
      setIsRoundConfirmed(true)
      setError("Ожидание хода противника...")
      return
    }

    // PvE mode - check AI placements
    if (aiPlacedThisRound.length < 2) {
      return setError("Оба игрока должны разместить по 2 карты!")
    }

    setError(null)
    setIsRoundConfirmed(true) // Блокируем изменения после подтверждения
    // Deep copy zones to prevent mutation of original state
    const nextZones = ccgState.zones.map(z => ({ 
      ...z, 
      playerCards: z.playerCards.map(zc => ({ ...zc, card: { ...zc.card } })),
      aiCards: z.aiCards.map(zc => ({ ...zc, card: { ...zc.card } }))
    }))

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
            placementOrder: currentOrder,
            isPlayer: true
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
            placementOrder: currentOrder,
            isPlayer: false
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
    setPlacementCounter(0)
  }

  // Calculates card powers and zone scores without transitioning to next round
  const calculateRoundScores = () => {
    if (!ccgState) return null

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

      // Reveal all secret cards - deep copy to prevent mutation of original state
      const playerCards = zone.playerCards.map(zc => ({ 
        ...zc, 
        isSecret: false,
        card: { ...zc.card } // deep copy card object
      }))
      const aiCards = zone.aiCards.map(zc => ({ 
        ...zc, 
        isSecret: false,
        card: { ...zc.card } // deep copy card object
      }))

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

    // Cross-zone modifiers: gravity_well and overdrive (APPLIED BEFORE zone ownership calculation)
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
        // Recalculate scores but DON'T set owner yet - will be calculated after all modifiers
        zone.playerScore = zone.playerCards.reduce((acc, c) => acc + c.powerAfterModifier, 0)
        zone.aiScore = zone.aiCards.reduce((acc, c) => acc + c.powerAfterModifier, 0)
        console.log(`[Battle Round ${ccgState.round}] Gravity well after:`, {
          afterPlayerScore: zone.playerScore,
          afterAiScore: zone.aiScore
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

    // Final zone ownership calculation after all modifiers (including cross-zone)
    console.log(`[Battle Round ${ccgState.round}] Final zone ownership calculation...`)
    nextZones.forEach(zone => {
      if (zone.modifier.id === "reversal_gate") {
        // In Paradox Gate, the side with LOWER score wins
        zone.owner = zone.playerScore < zone.aiScore ? "player" : zone.aiScore < zone.playerScore ? "ai" : "none"
      } else {
        zone.owner = zone.playerScore > zone.aiScore ? "player" : zone.aiScore > zone.playerScore ? "ai" : "none"
      }
      console.log(`[Battle Round ${ccgState.round}] Zone ${zone.id} final ownership:`, {
        playerScore: zone.playerScore,
        aiScore: zone.aiScore,
        owner: zone.owner
      })
    })

    // Return calculated zones without transitioning
    return nextZones
  }

  // Updates state with calculated scores without transitioning to next round
  const updateScores = useCallback(() => {
    if (!ccgState) return

    const nextZones = calculateRoundScores()
    if (!nextZones) return

    setCcgState(prev => {
      if (!prev) return null
      return {
        ...prev,
        zones: nextZones,
      }
    })
  }, [ccgState])

  // Evaluates end-of-round scores with actual matchups and transitions to next round/results
  const nextRound = () => {
    if (!ccgState) return

    // Calculate scores first
    const nextZones = calculateRoundScores()
    if (!nextZones) return

    const isMatchEnded = ccgState.round === 3

    if (!isMatchEnded) {
      // Draw remaining cards to Hand (Draw 2 cards up to max of 4)
      const nextRoundNum = ccgState.round + 1
      const cardsToDraw = 2

      const drawnPlayerCards = ccgState.deck.slice(0, cardsToDraw)
      const remainingDeck = ccgState.deck.slice(cardsToDraw)
      // Add new cards to remaining hand (2 cards left + 2 new = 4 cards total)
      const nextHand = [...ccgState.hand, ...drawnPlayerCards]

      const drawnAICards = ccgState.aiDeck.slice(0, cardsToDraw)
      const remainingAIDeck = ccgState.aiDeck.slice(cardsToDraw)
      // Add new cards to remaining AI hand (2 cards left + 2 new = 4 cards total)
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
      setPlacementCounter(0)
      setIsRoundConfirmed(false)
      setError(null)
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

      // Trigger animations for final round bonuses
      console.log('[Battle Round 3] Triggering final round animations...')
      nextZones.forEach(zone => {
        triggerModifierActivation(zone.id)
        zone.playerCards.forEach(zc => {
          if ((zc.roleMatchupBonus || 0) > 0) {
            triggerCardEffect(zc.card.uniqueId, 'knb-win')
          } else if ((zc.roleMatchupBonus || 0) < 0) {
            triggerCardEffect(zc.card.uniqueId, 'knb-loss')
          }
          if ((zc.synergyBonus || 0) > 0) {
            triggerCardEffect(zc.card.uniqueId, 'synergy')
          }
        })
        zone.aiCards.forEach(zc => {
          if ((zc.roleMatchupBonus || 0) > 0) {
            triggerCardEffect(zc.card.uniqueId, 'knb-win')
          } else if ((zc.roleMatchupBonus || 0) < 0) {
            triggerCardEffect(zc.card.uniqueId, 'knb-loss')
          }
          if ((zc.synergyBonus || 0) > 0) {
            triggerCardEffect(zc.card.uniqueId, 'synergy')
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

      // Automatically call finishBattle to process rewards on server
      // Pass the results directly to avoid closure issues with stale state
      const dungeonIdToSave = selectedDungeon?.id
      const isVictoryToSave = victory
      setTimeout(async () => {
        console.log('[Battle] Triggering automatic finishBattle with result:', isVictoryToSave ? 'win' : 'loss', 'Dungeon:', dungeonIdToSave)
        await finishBattle(false, isVictoryToSave ? 'win' : 'loss', dungeonIdToSave)
      }, 800)
    }
  }

  const finishBattle = async (isPvPMode: boolean = false, overrideResult?: 'win' | 'loss', overrideDungeonId?: string) => {
    if (isFinishing) return
    setIsFinishing(true)
    
    // Use provided data or fallback to state
    const dungeonIdToFinish = overrideDungeonId || selectedDungeon?.id
    const resultToFinish = overrideResult || (ccgState?.victory ? 'win' : 'loss')
    
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

      // In PvP mode, transition to result state immediately
      if (isPvPMode) {
        setBattleState("result")
      }

      // Process rewards and API calls in background
      if (!isPvPMode) {
        const token = session?.access_token
        console.log('[Battle] Processing victory rewards. Dungeon:', dungeonIdToFinish, 'Token:', !!token)
        if (token) {
          try {
            if (!isPvPMode) {
              // Send PvE result log to the server with battle token
              const finishRes = await fetch('/api/battle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                  action: 'finish_battle',
                  dungeonId: dungeonIdToFinish,
                  result: resultToFinish,
                  battleToken: battleTokenRef.current,
                  turns: 3
                })
              })

              console.log('[Battle] Finish API response status:', finishRes.status)

              // Use server-returned reward values
              if (finishRes.ok) {
                const finishData = await finishRes.json()
                console.log('[Battle] Reward data from server:', finishData)
                if (finishData.success && finishData.coinsEarned !== undefined) {
                  // Update displayed rewards with server-calculated values
                  setCcgState(prev => {
                    if (!prev) return null
                    return {
                      ...prev,
                      coinsEarned: finishData.coinsEarned,
                      dustEarned: finishData.dustEarned,
                      xpEarned: finishData.xpEarned,
                    }
                  })
                }
              }

              battleTokenRef.current = null
              await refreshCoins()
              await refreshDust()
            } else {
              // In PvP, we already refreshed MMR/coins in resolvePvPMatchEnd
              // But we can do one more refresh to be safe
              await refreshCoins()
            }
          } catch (e) {
            console.error("Failed to post battle logs", e)
          }
        }
      }
      await loadBattleData()
    } finally {
      setIsFinishing(false)
    }
  }

  const closeBattleResult = () => {
    setBattleState("idle")
    setCcgState(null)
    setIsPvPMode(false)
    battleTokenRef.current = null
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
    coinsLoading,
    dust,
    dustLoading,
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
    updateScores,
    showTeamBuilder,
    setShowTeamBuilder,
    teamSearch,
    setTeamSearch,
    selectedRole,
    setSelectedRole,
    sortBy,
    opponentDeckContext,
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
    autoBuildDeck,
    startBattle,
    startPvPBattle,
    finishBattle,
    closeBattleResult,
    isFinishing,
    teamPower,
    filteredCards,
    updatePvPRound,
    resolvePvPRound,
    resolvePvPMatchEnd,
    isInitializing,
    loadBattleData,
  }
}
