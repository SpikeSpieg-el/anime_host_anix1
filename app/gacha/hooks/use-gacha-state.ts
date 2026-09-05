"use client"

import { useRouter, usePathname } from "next/navigation"
import { useState, useRef, useCallback, useEffect, useMemo } from "react"
import { flushSync } from "react-dom"
import { supabase } from "@/lib/supabase"
import {
  rollAnimeCharacter,
  rollFromAnimePack,
  rollFromBanner,
  searchGachaPacks,
  createCustomGachaPack,
  checkPackAvailability,
  updateUserPityAfterRoll,
  generateStatsForRarity
} from "../actions"
import {
  saveCardToDatabase,
  loadUserCards,
  deleteCardFromDatabase,
  queueCardForSync, 
  syncQueuedCards 
} from "../client-actions"
import { loadUserPity, type PityData } from "../pity-actions"
import { ANIME_PACKS, AnimePack, CustomAnimePack, createCustomPack, loadYearBasedPacks } from "@/lib/gacha-packs"
import { useCoins } from "@/hooks/use-coins"
import { useDust } from "@/hooks/use-dust"
import { useAuth } from "@/components/auth/auth-provider"
import { activityRecorder } from "@/components/providers/account-stats-recorder"
import { Card } from "../types"
import { rarityConfig, getDismantleValue, Rarity } from "@/types/gacha"
import { generateCardUniqueId, calculateCollectionRating, signCard, verifyCard } from "../utils"

export function useGachaState() {
  const router = useRouter()
  const pathname = usePathname()
  
  const [isRolling, setIsRolling] = useState(false)
  const isRollingRef = useRef(false)
  const [devForcedRarity, setDevForcedRarity] = useState<Rarity | null>(null)
  const [isPackLoading, setIsPackLoading] = useState(true)
  const [isCustomPackLoading, setIsCustomPackLoading] = useState(false)
  const [revealedCard, setRevealedCard] = useState<Card | null>(null)
  const [collectedCards, setCollectedCards] = useState<Card[]>([])
  const [showCard, setShowCard] = useState(false)
  const [viewedCard, setViewedCard] = useState<Card | null>(null)

  const usedCharacterIds = useMemo(() => new Set(collectedCards.map(c => c.characterId)), [collectedCards])
  
  const { user: authUser, session, sessionLoading } = useAuth()
  const { coins: userCoins, loading: coinsLoading, spendCoins, addCoins, forceSync, fixOverflow, refresh: refreshCoins } = useCoins()

  const isDev = process.env.NODE_ENV === 'development'
  const { dust, loading: dustLoading, addDust, refresh: refreshDust } = useDust()
  const [selectedPack, setSelectedPack] = useState<AnimePack | CustomAnimePack | null>(null)
  const [selectedBannerCards, setSelectedBannerCards] = useState<any[] | null>(null)
  const [selectedBannerGuaranteedCard, setSelectedBannerGuaranteedCard] = useState<any | null>(null)
  const [selectedBannerGuaranteedPity, setSelectedBannerGuaranteedPity] = useState<number>(0)
  const [showPacks, setShowPacks] = useState(false)
  const [packSearchQuery, setPackSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<AnimePack[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showCustomPackCreator, setShowCustomPackCreator] = useState(false)
  const [customPackQuery, setCustomPackQuery] = useState("")
  const [isCreatingCustomPack, setIsCreatingCustomPack] = useState(false)
  const [createdCustomPack, setCreatedCustomPack] = useState<CustomAnimePack | null>(null)
  const [customPackSearchResults, setCustomPackSearchResults] = useState<Array<{
    id: number
    name: string
    russian: string | null
    score: number | null
    imageUrl: string
  }>>([])
  const [selectedAnimeIds, setSelectedAnimeIds] = useState<Set<number>>(new Set())
  const [blacklistedUrls, setBlacklistedUrls] = useState<string[]>([])
  const [expandPoolForCharacters, setExpandPoolForCharacters] = useState<Set<number>>(new Set())
  const [showArtWarning, setShowArtWarning] = useState(false)
  const [showArtLimitWarning, setShowArtLimitWarning] = useState(false)
  const [cardForArtLimitWarning, setCardForArtLimitWarning] = useState<Card | null>(null)
  const [isFixingCoins, setIsFixingCoins] = useState(false)
  const [isSavingCard, setIsSavingCard] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [displayedCardsCount, setDisplayedCardsCount] = useState(10)
  const [isSyncingCards, setIsSyncingCards] = useState(false)
  const [pendingSyncCount, setPendingSyncCount] = useState(0)
  const [prioritizeMainCharacters, setPrioritizeMainCharacters] = useState(false)
  const [pityData, setPityData] = useState<PityData | null>(null)

  // Ref for tracking operation start time
  const operationStartTime = useRef<number | null>(null)

  // Ref for tracking if component is mounted
  const isMounted = useRef(true)

  // Refs for pending card persistence (restore after refresh/page exit)
  const hasRestoredPendingCard = useRef(false)
  const hasPersistedOnce = useRef(false)
  const prevShowCardRef = useRef(false)

  const ART_BAN_LIMIT = 10

  const bannedArtsByCharacter = useMemo(() => {
    const acc: Record<number, number> = {}
    blacklistedUrls.forEach(url => {
      const card = collectedCards.find(c => c.imageUrl === url || c.originalUrl === url)
      if (card) {
        acc[card.characterId] = (acc[card.characterId] || 0) + 1
      }
    })
    if (revealedCard && blacklistedUrls.includes(revealedCard.imageUrl)) {
      acc[revealedCard.characterId] = (acc[revealedCard.characterId] || 0) + 1
    }
    return acc
  }, [blacklistedUrls, collectedCards, revealedCard])
  
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedRarity, setSelectedRarity] = useState<Rarity | "all">("all")
  const [sortBy, setSortBy] = useState<"date" | "rarity" | "score" | "name" | "anime">("date")
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")
  const [selectedPackFilter, setSelectedPackFilter] = useState<string | "all">("all")
  const [selectedMainCharacterFilter, setSelectedMainCharacterFilter] = useState<"all" | "main" | "supporting">("all")
  const [showFilters, setShowFilters] = useState(false)
  const [showRatingModal, setShowRatingModal] = useState(false)
  const [showErrorPopup, setShowErrorPopup] = useState(false)
  const [errorPopupConfig, setErrorPopupConfig] = useState<{
    title: string
    message: string
    type?: "error" | "warning" | "info"
    packName?: string
    collectedCount?: number
    availableCount?: number
    totalCharacters?: number
  } | null>(null)
  const [showDismantleConfirm, setShowDismantleConfirm] = useState(false)
  const [showDismantleSuccess, setShowDismantleSuccess] = useState(false)
  const [dismantleCardData, setDismantleCardData] = useState<Card | null>(null)
  const [isDismantling, setIsDismantling] = useState(false)
  const [dismantleReward, setDismantleReward] = useState(0)
  
  // Bulk dismantle states
  const [showBulkDismantleFilter, setShowBulkDismantleFilter] = useState(false)
  const [showBulkDismantleConfirm, setShowBulkDismantleConfirm] = useState(false)
  const [showBulkDismantleSuccess, setShowBulkDismantleSuccess] = useState(false)
  const [selectedBulkRarity, setSelectedBulkRarity] = useState<Rarity | "all">("all")
  const [excludeMainCharacters, setExcludeMainCharacters] = useState(false)
  const [isBulkDismantling, setIsBulkDismantling] = useState(false)
  const [bulkDismantleReward, setBulkDismantleReward] = useState(0)
  const [bulkDismantleProgress, setBulkDismantleProgress] = useState({ processed: 0, total: 0 })

  const [gachaMainTab, setGachaMainTab] = useState<"gacha" | "market">("gacha")
  const [cardToSell, setCardToSell] = useState<Card | null>(null)
  const [listedCardIds, setListedCardIds] = useState<Set<string>>(new Set())
  const [cardToChangeArt, setCardToChangeArt] = useState<Card | null>(null)
  const [cardToPositionArt, setCardToPositionArt] = useState<Card | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("tab") === "market") {
      setGachaMainTab("market")
    }
  }, [])

  const collectionRating = useMemo(() => calculateCollectionRating(collectedCards), [collectedCards])

  const loadListedCards = useCallback(async () => {
    if (!authUser?.id) return

    const { supabase } = await import("@/lib/supabase")

    try {
      const { data, error } = await supabase
        .from("market_listings")
        .select("unique_id")
        .eq("seller_id", authUser.id)

      if (error) throw error
      setListedCardIds(new Set(data?.map((item: { unique_id: string }) => item.unique_id) || []))
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[loadListedCards] Request aborted (expected behavior)')
        return
      }
      console.error("Error loading listed cards:", error)
    }
  }, [authUser?.id])

  const refreshCollectionMerge = useCallback(async () => {
    if (!authUser?.id) return

    try {
      const dbCards = await loadUserCards({ user: authUser, session })
      let localCollection: Card[] = []
      try {
        const raw = localStorage.getItem("gacha-collection")
        if (raw) localCollection = JSON.parse(raw)
      } catch {
        /* ignore */
      }

      // Deduplicate database cards first
      const seenDbIds = new Set<string>()
      const deduplicatedDbCards = dbCards.filter((card) => {
        if (seenDbIds.has(card.uniqueId)) {
          console.log('[refreshCollectionMerge] Skipping duplicate DB card:', card.uniqueId)
          return false
        }
        seenDbIds.add(card.uniqueId)
        return true
      })

      const dbIds = new Set(deduplicatedDbCards.map((c) => c.uniqueId))

      // Находим потерянные локальные карты (которых нет в БД)
      const seenLocalIds = new Set<string>()
      const lostLocalCards = localCollection.filter((c) => {
        if (dbIds.has(c.uniqueId) || seenLocalIds.has(c.uniqueId)) {
          return false
        }
        seenLocalIds.add(c.uniqueId)
        return true
      })

      const dbCardsWithOrder = deduplicatedDbCards.map((card, idx) => ({
        ...card,
        orderIndex: idx,
      }))

      const mergedCollection = [
        ...dbCardsWithOrder,
        ...lostLocalCards
          .map((card, i) => ({
            ...card,
            orderIndex: deduplicatedDbCards.length + i,
          })),
      ]

      const seenFinalIds = new Set<string>()
      const merged = mergedCollection.filter(card => {
        if (seenFinalIds.has(card.uniqueId)) {
          console.log('[refreshCollectionMerge] Skipping duplicate in merged collection:', card.uniqueId)
          return false
        }
        seenFinalIds.add(card.uniqueId)
        return true
      })

      setCollectedCards(merged)
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('[refreshCollectionMerge] Request aborted (expected behavior)')
        return
      }
      console.error("Error refreshing collection:", error)
    }
  }, [authUser?.id, session])

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

  const handleArtPositionChanged = useCallback((artPosition: { x: number; y: number }) => {
    setCollectedCards(prev => prev.map(card =>
      card.uniqueId === cardToPositionArt?.uniqueId
        ? { ...card, artPosition }
        : card
    ))
    try {
      const localData = localStorage.getItem('gacha-collection')
      if (localData) {
        const localCards: Card[] = JSON.parse(localData)
        const updated = localCards.map(c =>
          c.uniqueId === cardToPositionArt?.uniqueId
            ? { ...c, artPosition }
            : c
        )
        localStorage.setItem('gacha-collection', JSON.stringify(updated))
      }
    } catch (e) {
      console.error('[handleArtPositionChanged] Error updating localStorage:', e)
    }
  }, [cardToPositionArt?.uniqueId])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        if ((isRolling || isSavingCard) && operationStartTime.current) {
          const elapsed = Date.now() - operationStartTime.current
          if (elapsed > 15000) {
            console.warn('[Gacha] Операция затянулась в фоне. Сброс состояния.')
            setIsRolling(false); isRollingRef.current = false
            setIsSavingCard(false)
            operationStartTime.current = null
          }
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isRolling, isSavingCard])

  useEffect(() => {
    let isMountedLocal = true

    console.log('[loadSavedCards useEffect] authUser:', authUser?.id, 'sessionLoading:', sessionLoading, 'isLoaded:', isLoaded)

    const loadSavedCards = async () => {
      console.log('[loadSavedCards] Starting load...')

      try {
        let finalCollection: Card[] = []
        let localCards: Card[] = []

        try {
          const savedPriority = localStorage.getItem('gacha-prioritize-main-characters')
          if (savedPriority) {
            setPrioritizeMainCharacters(JSON.parse(savedPriority))
          }
        } catch (e) { console.error(e) }

        try {
          const localData = localStorage.getItem('gacha-collection')
          console.log('[loadSavedCards] LocalStorage cards:', localData ? JSON.parse(localData).length : 0)
          if (localData) {
            localCards = JSON.parse(localData)
            localCards = localCards.map((card: Card, index: number) => ({
              ...card,
              orderIndex: localCards.length - 1 - index
            }))
          }
        } catch (e) { console.error(e) }

        if (sessionLoading) {
          console.log('[loadSavedCards] Session still loading, waiting...')
          return
        }

        console.log('[loadSavedCards] authUser check:', !!authUser)
        if (authUser) {
          try {
            console.log('[loadSavedCards] Calling loadUserCards...')
            
            const dbCards = await Promise.race([
              loadUserCards({ user: authUser, session }),
              new Promise<Card[]>((_, reject) => 
                setTimeout(() => reject(new Error('DB load timeout')), 20000)
              )
            ])
            
            console.log('[loadSavedCards] DB cards loaded:', dbCards.length)

            if (!Array.isArray(dbCards)) {
              console.error('[loadSavedCards] Invalid DB response, using local data')
              if (isMountedLocal) {
                setCollectedCards(localCards)
                setIsLoaded(true)
              }
              return
            }

            const seenDbIds = new Set<string>()
            const deduplicatedDbCards = dbCards.filter((card: Card) => {
              if (seenDbIds.has(card.uniqueId)) {
                console.log('[loadSavedCards] Skipping duplicate DB card:', card.uniqueId)
                return false
              }
              seenDbIds.add(card.uniqueId)
              return true
            })

            const dbCardsWithOrder = deduplicatedDbCards.map((card: Card, index: number) => ({
              ...card,
              orderIndex: index
            }))

            const dbIds = new Set(dbCardsWithOrder.map(c => c.uniqueId))
            const seenLostIds = new Set<string>()
            const lostCards = localCards.filter(c => {
              if (dbIds.has(c.uniqueId) || seenLostIds.has(c.uniqueId)) {
                return false
              }
              seenLostIds.add(c.uniqueId)
              return true
            })

            console.log('[loadSavedCards] Found lost cards:', lostCards.length)

            if (lostCards.length > 0) {
              console.log('[loadSavedCards] Syncing lost cards to DB...')
              for (const card of lostCards) {
                try {
                  const result = await saveCardToDatabase(card, session)
                  if (!result.success && !result.isAbort) {
                    queueCardForSync(card)
                  }
                } catch (error) {
                  console.error('[loadSavedCards] Failed to sync lost card:', card.uniqueId, error)
                  queueCardForSync(card)
                }
              }
            }

            const mergedCollection = [
              ...dbCardsWithOrder,
              ...lostCards.map((card, index) => ({
                ...card,
                orderIndex: dbCardsWithOrder.length + index
              }))
            ]

            const seenFinalIds = new Set<string>()
            finalCollection = mergedCollection.filter(card => {
              if (seenFinalIds.has(card.uniqueId)) {
                console.log('[loadSavedCards] Skipping duplicate in final collection:', card.uniqueId)
                return false
              }
              seenFinalIds.add(card.uniqueId)
              return true
            })

            console.log('[loadSavedCards] Final collection size:', finalCollection.length)

            if (isMountedLocal) {
              setCollectedCards(finalCollection)
              console.log('[loadSavedCards] Collection set. Unblocking UI...')
              setIsLoaded(true) 
              console.log('[loadSavedCards] Calling loadListedCards in background...')
              loadListedCards().catch(e => console.error('[loadListedCards] Background error:', e))
            }

            const queue = JSON.parse(localStorage.getItem('gacha-sync-queue') || '[]')
            if (queue.length > 0) {
              if (isMountedLocal) setIsSyncingCards(true)
              const syncResult = await syncQueuedCards(session)
              if (isMountedLocal) {
                setIsSyncingCards(false)
                setPendingSyncCount(syncResult.remaining)
              }
            }
          } catch (dbError: any) {
            if (dbError.name !== 'AbortError') {
              console.error('[loadSavedCards] DB error:', dbError)
              console.log('[loadSavedCards] DB unavailable, using local data')
              if (isMountedLocal) {
                setCollectedCards(localCards)
                setIsLoaded(true)
              }
            }
          }
        } else {
          console.log('[loadSavedCards] No authUser (guest user), using local data only')
          if (isMountedLocal) {
            setCollectedCards(localCards)
            setIsLoaded(true)
          }
          return
        }

      } catch (error: any) {
        if (error.name === 'AbortError') return
        console.error('[loadSavedCards] Critical Error:', error)
      }
    }

    loadSavedCards()

    return () => {
      isMountedLocal = false
    }
  }, [authUser?.id, sessionLoading, session, loadListedCards])

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
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem('gacha-prioritize-main-characters', JSON.stringify(prioritizeMainCharacters))
    } catch (e) { console.error(e) }
  }, [prioritizeMainCharacters])

  useEffect(() => {
    if (packSearchQuery.trim().length < 1) {
      setSearchResults([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    const debounce = setTimeout(async () => {
      try {
        const results = await searchGachaPacks(packSearchQuery.trim())
        setSearchResults(results)
      } catch (error) {
        console.error("Pack search error:", error)
        setSearchResults([])
      } finally {
        setIsSearching(false)
      }
    }, 200)

    return () => clearTimeout(debounce)
  }, [packSearchQuery])

  useEffect(() => {
    isMounted.current = true

    // Сбрасываем счётчик гостевых круток при входе в аккаунт
    if (authUser) {
      localStorage.removeItem('gacha-guest-rolls')
    }

    const loadPityData = async () => {
      try {
        const data = await loadUserPity(session)
        if (isMounted.current) {
          setPityData(data)
        }
      } catch (error) {
        if (isMounted.current) {
          console.error('[loadPityData] Error:', error)
        }
      }
    }

    loadPityData()

    return () => {
      isMounted.current = false
    }
  }, [session, authUser])

  useEffect(() => {
    setRevealedCard(null)
    setShowCard(false)
    setIsRolling(false); isRollingRef.current = false
    setViewedCard(null)
    setIsSavingCard(false)
    operationStartTime.current = null
    setSearchQuery("")
    setShowPacks(false)
    if (!selectedPack || !selectedPack.id.startsWith('banner:')) {
      setSelectedBannerCards(null)
      setSelectedBannerGuaranteedCard(null)
      setSelectedBannerGuaranteedPity(0)
    }
  }, [selectedPack])

  // Restore pending card on mount (if user refreshed/exited after rolling but before saving/discarding)
  useEffect(() => {
    try {
      const pending = localStorage.getItem('gacha-pending-card')
      if (pending) {
        const { card, sig } = JSON.parse(pending) as { card: Card; sig: string }
        if (card && sig && verifyCard(card, sig)) {
          console.log('[restorePendingCard] Found valid pending card:', card.name)
          setRevealedCard(card)
          setShowCard(true)
          setIsRolling(false); isRollingRef.current = false
          prevShowCardRef.current = true
        } else {
          console.warn('[restorePendingCard] Card signature mismatch, discarding tampered card')
          localStorage.removeItem('gacha-pending-card')
        }
      }
    } catch (e) {
      console.error('[restorePendingCard] Error:', e)
      localStorage.removeItem('gacha-pending-card')
    }
    hasRestoredPendingCard.current = true
  }, [])

  // Persist/clear pending card to localStorage
  useEffect(() => {
    if (!hasRestoredPendingCard.current) return

    // Only clear after the first persist run (avoids clearing before restore state is applied)
    if (hasPersistedOnce.current) {
      // Clear when card is null (new roll/reset) or user took action (showCard went true→false)
      if (!revealedCard || (prevShowCardRef.current && !showCard)) {
        try {
          localStorage.removeItem('gacha-pending-card')
        } catch (e) { console.error(e) }
      }
    }

    // Save card to localStorage whenever it's set (even during animation)
    if (revealedCard) {
      try {
        const payload = JSON.stringify({ card: revealedCard, sig: signCard(revealedCard) })
        localStorage.setItem('gacha-pending-card', payload)
      } catch (e) { console.error(e) }
    }

    hasPersistedOnce.current = true
    prevShowCardRef.current = showCard
  }, [showCard, revealedCard])

  const handleEmptyResult = async () => {
    setIsRolling(false); isRollingRef.current = false
    if (!selectedPack) return
    
    setErrorPopupConfig({
      title: "набор пуст или персонаж не найден",
      message: "Похоже, вы собрали всех доступных героев из этого набора.",
      type: "info"
    })
    setShowErrorPopup(true)

    try {
      await checkPackAvailability(selectedPack as AnimePack, Array.from(usedCharacterIds))
    } catch (e) {}
  }

  const GUEST_ROLL_LIMIT = 10

  const handleRoll = async () => {
    console.log('[handleRoll] Called, isRollingRef:', isRollingRef.current)
    if (isRollingRef.current) return
    isRollingRef.current = true

    // Гости могут крутить только 10 раз
    if (!authUser) {
      const guestRolls = parseInt(localStorage.getItem('gacha-guest-rolls') || '0', 10)
      if (guestRolls >= GUEST_ROLL_LIMIT) {
        setErrorPopupConfig({
          title: "Время войти в аккаунт",
          message: `Вы использовали все ${GUEST_ROLL_LIMIT} бесплатных круток. Войдите в аккаунт, чтобы продолжить играть и сохранить свою коллекцию!`,
          type: "warning"
        })
        setShowErrorPopup(true)
        window.dispatchEvent(new Event('open-auth-modal'))
        isRollingRef.current = false
        return
      }
    }

    const rollCost = selectedPack ? selectedPack.price : 50
    if (userCoins < rollCost) {
      setErrorPopupConfig({
        title: "Недостаточно монет",
        message: `Нужно ${rollCost} монет, у вас есть ${userCoins}. Пополните баланс и попробуйте снова!`,
        type: "error"
      })
      setShowErrorPopup(true)
      isRollingRef.current = false
      return
    }

    try {
      setIsRolling(true)
      operationStartTime.current = Date.now()
      setRevealedCard(null)
      setShowCard(false)
      setIsSavingCard(false)

      // SECURE: Spend coins BEFORE rolling to prevent getting cards without paying
      if (authUser) {
        const spendSuccess = await spendCoins(rollCost)
        if (!spendSuccess) {
          setErrorPopupConfig({
            title: "Недостаточно монет",
            message: `Не удалось списать ${rollCost} монет. Проверьте баланс и попробуйте снова!`,
            type: "error"
          })
          setShowErrorPopup(true)
          setIsRolling(false); isRollingRef.current = false
          operationStartTime.current = null
          return
        }
      }

      const currentBadLuckStreak = pityData?.bad_luck_streak || 0

      const isBannerRoll = selectedPack && selectedPack.id.startsWith('banner:') && (selectedBannerCards || (selectedPack as any).guaranteedCardsPool)

      const rollPromise = isBannerRoll
        ? rollFromBanner(
            {
              id: (selectedPack as AnimePack).id.replace('banner:', ''),
              name: (selectedPack as AnimePack).name,
              featuredAnimeIds: (selectedPack as AnimePack).animeIds,
              boostedRarity: (selectedPack as AnimePack).guaranteedRarity || null,
              cards: selectedBannerCards || [],
              guaranteedCardPayload: selectedBannerGuaranteedCard,
              guaranteedCardPity: selectedBannerGuaranteedPity,
              guaranteedCardsPool: (selectedPack as any).guaranteedCardsPool || null,
              userId: authUser?.id,
            } as any,
            Array.from(usedCharacterIds),
            blacklistedUrls,
            currentBadLuckStreak
          )
        : selectedPack
          ? rollFromAnimePack(selectedPack, Array.from(usedCharacterIds), blacklistedUrls, Array.from(expandPoolForCharacters), currentBadLuckStreak)
          : rollAnimeCharacter(Array.from(usedCharacterIds), blacklistedUrls, Array.from(expandPoolForCharacters), currentBadLuckStreak)

      const result = await Promise.race([
        rollPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), 15000))
      ]) as any

      if (result) {
        try {
          activityRecorder.recordActivity({ eventType: 'gacha_roll', category: 'activity' })

          if (authUser) {
            // Обновляем статистику аккаунта
            const { updateAccountStats } = await import('@/lib/supabase')
            const { data: currentStats } = await supabase
              .from('account_stats')
              .select('gacha_rolls')
              .eq('user_id', authUser.id)
              .single()
            const currentCount = currentStats?.gacha_rolls ?? 0
            await updateAccountStats(authUser.id, { gachaRolls: currentCount + 1 })
            window.dispatchEvent(new CustomEvent('account-stats-updated'))

            const pityUpdate = await updateUserPityAfterRoll(authUser.id, result)
            setPityData(prev => prev ? {
              ...prev,
              bad_luck_streak: pityUpdate.newStreak
            } : {
              bad_luck_streak: pityUpdate.newStreak
            })

            if (result.pityData?.pity_bonus_applied) {
              console.log(`[Pity System] Pity bonus applied! New streak: ${pityUpdate.newStreak}`)
            }
          }
        } catch (error) {
          console.error('[handleRoll] Pity update error:', error)
        }

        if (result.allFanArtBanned) {
          setErrorPopupConfig({
            title: "Персонаж найден, но...",
            message: "Все доступные арты для этого героя вами отклонены. Попробуйте другой наборет!",
            type: "info"
          })
          setShowErrorPopup(true)
          setIsRolling(false); isRollingRef.current = false
          // Refund coins since no card was obtained
          if (authUser) {
            await addCoins(rollCost).catch(e => console.error('[handleRoll] Refund failed:', e))
          }
          return 
        }

        if (!result.imageUrl) {
          console.error('[handleRoll] No imageUrl in result:', result)
          setErrorPopupConfig({
            title: "Ошибка загрузки арта",
            message: "Не удалось загрузить изображение персонажа. Попробуйте еще раз!",
            type: "error"
          })
          setShowErrorPopup(true)
          setIsRolling(false); isRollingRef.current = false
          // Refund coins since no card was obtained
          if (authUser) {
            await addCoins(rollCost).catch(e => console.error('[handleRoll] Refund failed:', e))
          }
          return
        }

        let finalRarity = result.rarity as Rarity
        let finalStats = result.stats

        if (devForcedRarity) {
          finalRarity = devForcedRarity
          finalStats = await generateStatsForRarity(finalRarity)
          console.log(`[DEV] Forced rarity: ${finalRarity}`)
        }

        const newCard: Card = {
          id: Date.now(),
          uniqueId: generateCardUniqueId(result.characterId, result.packId),
          serialId: result.characterId.toString(),
          name: result.characterName,
          anime: result.animeName,
          rarity: finalRarity,
          imageUrl: result.imageUrl || '',
          originalUrl: result.originalUrl || '',
          score: result.score,
          shikiId: result.shikiId,
          characterId: result.characterId,
          stats: finalStats,
          isMainCharacter: result.isMainCharacter || false,
          packId: result.packId,
          packName: result.packName,
          frameModifier: result.frameModifier,
          coatingModifier: result.coatingModifier,
          isArtBlacklisted: result.isMainCharacter && blacklistedUrls.includes(result.imageUrl || '')
        }

        setRevealedCard(newCard)

        // Увеличиваем счётчик круток для гостей
        if (!authUser) {
          const currentGuestRolls = parseInt(localStorage.getItem('gacha-guest-rolls') || '0', 10)
          localStorage.setItem('gacha-guest-rolls', String(currentGuestRolls + 1))
        }

        console.log('[handleRoll] Roll result ready, waiting for animation:', newCard.name)
      } else {
        // No result - refund coins
        if (authUser) {
          await addCoins(rollCost).catch(e => console.error('[handleRoll] Refund failed:', e))
        }
        await handleEmptyResult() 
      }

    } catch (error: any) {
      console.error("Gacha error:", error)
      setIsRolling(false); isRollingRef.current = false
      // Refund coins on error if we already spent them
      if (authUser) {
        await addCoins(rollCost).catch(e => console.error('[handleRoll] Refund failed:', e))
      }
      setErrorPopupConfig({
        title: "Ошибка",
        message: error.message === "TIMEOUT" ? "Сервер не ответил вовремя. Попробуйте еще раз!" : "Не удалось призвать персонажа.",
        type: "error"
      })
      setShowErrorPopup(true)
    } finally {
      operationStartTime.current = null
    }
  }

  const saveCard = async (card: Card) => {
    if (isSavingCard) return
    
    const isAlreadyIn = collectedCards.some(c => c.uniqueId === card.uniqueId)
    if (isAlreadyIn) {
      setShowCard(false)
      setRevealedCard(null)
      return
    }
    
    let cardWithOrder = card

    const minOrderIndex = collectedCards.length > 0
      ? Math.min(...collectedCards.map(c => c.orderIndex ?? 0))
      : 0
    cardWithOrder = { ...card, orderIndex: minOrderIndex - 1 }
    setCollectedCards(prev => [cardWithOrder, ...prev])

    try {
      const localSaved = JSON.parse(localStorage.getItem('gacha-collection') || '[]')
      if (!localSaved.some((c: Card) => c.uniqueId === card.uniqueId)) {
        localStorage.setItem('gacha-collection', JSON.stringify([cardWithOrder, ...localSaved]))
      }
    } catch (e) {
      console.error("Local storage backup failed", e)
    }

    setShowCard(false)
    setRevealedCard(null)
    setIsSavingCard(true)
    operationStartTime.current = Date.now()

    try {
      if (authUser) {
        const result = await saveCardToDatabase(card, session)
        if (!result.success) {
          queueCardForSync(card)
        } else {
          console.log("Card persisted to DB")
        }
      }
    } catch (e) {
      console.error("Critical save error:", e)
      queueCardForSync(card)
    } finally {
      setIsSavingCard(false)
      operationStartTime.current = null
    }
  }

  const discardRevealedCard = useCallback(() => {
    setShowCard(false)
    setRevealedCard(null)
  }, [])

  const handlePackSelect = async (pack: AnimePack) => {
    if (userCoins >= pack.price) {
      setIsPackLoading(true)
      await new Promise(resolve => setTimeout(resolve, 300))
      setSelectedPack(pack)
      setShowPacks(false)
      setIsPackLoading(false)
    }
  }

  const handleRandomRoll = () => {
    setSelectedPack(null)
    setShowPacks(false)
  }

  const handleCreateCustomPack = async () => {
    if (!customPackQuery.trim() || isCreatingCustomPack) return
    
    setIsCreatingCustomPack(true)
    setCreatedCustomPack(null)
    setSelectedAnimeIds(new Set()) 
    
    try {
      const result = await createCustomGachaPack(customPackQuery.trim())
      
      if (result) {
        setCustomPackSearchResults(result.foundAnime)
      } else {
        alert("Аниме по запросу не найдено. Попробуйте другое название.")
      }
    } catch (error) {
      console.error("Custom gacha pack action error:", error)
      alert("Ошибка при создании набора. Попробуйте снова.")
    } finally {
      setIsCreatingCustomPack(false)
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
      alert("Выберите хотя бы одно аниме для создания набора")
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
      alert("Ошибка при создании набора. Попробуйте снова.")
    } finally {
      setIsCreatingCustomPack(false)
    }
  }

  const handleSelectCustomPack = async (pack: CustomAnimePack) => {
    if (userCoins >= pack.price) {
      setIsCustomPackLoading(true)
      await new Promise(resolve => setTimeout(resolve, 300))
      setSelectedPack(pack)
      setShowCustomPackCreator(false)
      setCreatedCustomPack(null)
      setCustomPackQuery("")
      setIsCustomPackLoading(false)
    }
  }

  const unblacklistArt = (card: Card) => {
    setBlacklistedUrls(prev => prev.filter(url => url !== card.imageUrl))
    setCollectedCards(prev => prev.map(c => 
      c.uniqueId === card.uniqueId ? { ...c, isArtBlacklisted: false } : c
    ))
  }

  const handleSharePage = async () => {
    const shareText = gachaMainTab === "market"
      ? `🎲 WEEB-X ГАЧА - Крути гачу, продавай и покупай карты на маркете! Собери коллекцию любимых героев аниме!`
      : `🎲 WEEB-X ГАЧА - Призывай любимых персонажей, крути гачу и находи любых героев аниме! Зарегистрируй аккаунт и начни коллекцию! За первую регистрацию получи 10,000 монет бесплатно.`
    const shareUrl = typeof window !== 'undefined' ? window.location.href : ''

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'WEEB-X ГАЧА',
          text: shareText,
          url: shareUrl
        })
      } catch (error) {
        console.error('[Share] Error sharing:', error)
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`)
        alert('Ссылка скопирована в буфер обмена!')
      } catch (error) {
        console.error('[Share] Error copying to clipboard:', error)
        alert('Не удалось скопировать ссылку')
      }
    }
  }

  const removeCard = useCallback(async (cardToRemove: Card, clearViewedCard: boolean = true) => {
    try {
      console.log('[removeCard] Starting removal for card:', cardToRemove.uniqueId)
      
      if (authUser) {
        console.log('[removeCard] User authenticated, attempting database delete')
        const result = await deleteCardFromDatabase(cardToRemove.uniqueId, session)
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
      
      if (clearViewedCard) {
        setViewedCard(null)
      }
      
      console.log('[removeCard] Card removal completed')
    } catch (error) {
      console.error('[removeCard] Error:', error)
      alert('Ошибка при удалении карты')
    }
  }, [authUser, session, collectedCards.length])

  const dismantleCard = async (card: Card) => {
    setDismantleCardData(card)
    setDismantleReward(getDismantleValue(card.rarity))
    setShowDismantleConfirm(true)
  }

  const confirmDismantle = async () => {
    if (!dismantleCardData) return
    
    flushSync(() => {
      setIsDismantling(true)
    })
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      const reward = getDismantleValue(dismantleCardData.rarity)
      const success = await addDust(reward)
      
      if (success) {
        await refreshDust()
      }
      
      if (!success) {
        setErrorPopupConfig({
          title: 'Ошибка распыления',
          message: 'Не удалось начислить пыль. Попробуйте еще раз.',
          type: 'error'
        })
        setShowErrorPopup(true)
        setShowDismantleConfirm(false)
        return
      }

      await removeCard(dismantleCardData) 
      setViewedCard(null)
      setDismantleReward(reward)
      setShowDismantleConfirm(false)
      setShowDismantleSuccess(true)
      setIsDismantling(false)
    } catch (e) {
      console.error("Dismantle failed", e)
      setErrorPopupConfig({
        title: 'Ошибка распыления',
        message: 'Произошла ошибка при распылении карты. Попробуйте еще раз.',
        type: 'error'
      })
      setShowErrorPopup(true)
      setShowDismantleConfirm(false)
      setIsDismantling(false)
    } finally {
      setDismantleCardData(null)
    }
  }

  const cancelDismantle = () => {
    setShowDismantleConfirm(false)
    setDismantleCardData(null)
    setDismantleReward(0)
  }

  const openBulkDismantleFilter = () => {
    setShowBulkDismantleFilter(true)
  }

  const selectBulkRarity = (rarity: Rarity | "all", excludeMain: boolean) => {
    setSelectedBulkRarity(rarity)
    setExcludeMainCharacters(excludeMain)
    setShowBulkDismantleFilter(false)
    
    let cardsToDismantle = rarity === "all" 
      ? [...collectedCards] 
      : collectedCards.filter(card => card.rarity === rarity)
    
    if (excludeMain) {
      cardsToDismantle = cardsToDismantle.filter(card => !card.isMainCharacter)
    }
    
    const totalDust = cardsToDismantle.reduce((total, card) => total + getDismantleValue(card.rarity), 0)
    setBulkDismantleReward(totalDust)
    setShowBulkDismantleConfirm(true)
  }

  const confirmBulkDismantle = async () => {
    console.log('[confirmBulkDismantle] Starting bulk dismantle')
    
    await new Promise(resolve => setTimeout(resolve, 10))
    setIsBulkDismantling(true)
    console.log('[confirmBulkDismantle] Set isBulkDismantling to true')
    
    await new Promise(resolve => setTimeout(resolve, 50))

    try {
      let cardsToDismantle = selectedBulkRarity === "all" 
        ? [...collectedCards] 
        : collectedCards.filter(card => card.rarity === selectedBulkRarity)
      
      if (excludeMainCharacters) {
        cardsToDismantle = cardsToDismantle.filter(card => !card.isMainCharacter)
      }
      
      if (cardsToDismantle.length === 0) {
        throw new Error("Нет карт для распыления")
      }

      console.log('[confirmBulkDismantle] Initializing progress for', cardsToDismantle.length, 'cards')
      setBulkDismantleProgress({ processed: 0, total: cardsToDismantle.length })

      const totalDust = cardsToDismantle.reduce((total, card) => total + getDismantleValue(card.rarity), 0)
      console.log('[confirmBulkDismantle] Total dust to add:', totalDust)
      
      const success = await addDust(totalDust)
      console.log('[confirmBulkDismantle] Dust addition success:', success)
      
      if (success) {
        await refreshDust()
      }
      
      if (!success) {
        throw new Error("Не удалось начислить пыль")
      }

      const batchSize = 5
      let processedCount = 0
      
      for (let i = 0; i < cardsToDismantle.length; i += batchSize) {
        const batch = cardsToDismantle.slice(i, i + batchSize)
        console.log(`[confirmBulkDismantle] Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(cardsToDismantle.length/batchSize)} with ${batch.length} cards`)
        
        await Promise.all(
          batch.map(async (card) => {
            await removeCard(card, false)
            processedCount++
            console.log(`[confirmBulkDismantle] Processed ${processedCount}/${cardsToDismantle.length} cards`)
            setBulkDismantleProgress(prev => ({ ...prev, processed: processedCount }))
          })
        )
        
        if (i + batchSize < cardsToDismantle.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      console.log('[confirmBulkDismantle] All cards processed successfully')
      
      if (viewedCard && cardsToDismantle.some(c => c.uniqueId === viewedCard.uniqueId)) {
        setViewedCard(null)
      }
      
      setBulkDismantleProgress({ processed: 0, total: 0 })
      setBulkDismantleReward(totalDust)
      
      console.log('[confirmBulkDismantle] Closing confirmation modal and opening success modal')
      setShowBulkDismantleConfirm(false)
      setShowBulkDismantleSuccess(true)
    } catch (e) {
      console.error('[confirmBulkDismantle] Bulk dismantle failed', e)
      setErrorPopupConfig({
        title: 'Ошибка массового распыления',
        message: 'Произошла ошибка при массовом распылении карт. Попробуйте еще раз.',
        type: 'error'
      })
      setShowErrorPopup(true)
      setBulkDismantleProgress({ processed: 0, total: 0 })
      setShowBulkDismantleConfirm(false)
    } finally {
      console.log('[confirmBulkDismantle] Finally block - setting isBulkDismantling to false')
      setIsBulkDismantling(false)
      setSelectedBulkRarity("all")
      setExcludeMainCharacters(false)
    }
  }

  const cancelBulkDismantle = () => {
    setShowBulkDismantleConfirm(false)
    setSelectedBulkRarity("all")
    setExcludeMainCharacters(false)
    setBulkDismantleReward(0)
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
          const aIsMain = a.isMainCharacter ? 1 : 0
          const bIsMain = b.isMainCharacter ? 1 : 0
          if (aIsMain !== bIsMain) return bIsMain - aIsMain
        }
        const aOrder = a.orderIndex ?? Infinity
        const bOrder = b.orderIndex ?? Infinity
        return sortOrder === "desc" ? aOrder - bOrder : bOrder - aOrder
      } else {
        let comparison = 0
        switch (sortBy) {
          case "rarity":
            const rarityOrder = ["trash", "common", "uncommon", "rare", "super_rare", "epic", "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"]
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
          const aIsMain = a.isMainCharacter ? 1 : 0
          const bIsMain = b.isMainCharacter ? 1 : 0
          if (aIsMain !== bIsMain) return bIsMain - aIsMain
        }
        return sortOrder === "desc" ? -comparison : comparison
      }
    })

    return result
  }, [collectedCards, listedCardIds, searchQuery, selectedRarity, selectedPackFilter, selectedMainCharacterFilter, sortBy, sortOrder, prioritizeMainCharacters])

  const wrappedSetIsRolling = useCallback((value: boolean | ((prev: boolean) => boolean)) => {
    const resolved = typeof value === 'function' ? value(false) : value
    setIsRolling(resolved)
    isRollingRef.current = resolved
  }, [])

  return {
    router,
    pathname,
    isRolling,
    setIsRolling: wrappedSetIsRolling,
    isPackLoading,
    isCustomPackLoading,
    revealedCard,
    setRevealedCard,
    collectedCards,
    setCollectedCards,
    showCard,
    setShowCard,
    viewedCard,
    setViewedCard,
    usedCharacterIds,
    authUser,
    session,
    sessionLoading,
    userCoins,
    coinsLoading,
    spendCoins,
    addCoins,
    forceSync,
    fixOverflow,
    refreshCoins,
    isDev,
    dust,
    dustLoading,
    addDust,
    refreshDust,
    selectedPack,
    setSelectedPack,
    selectedBannerCards,
    setSelectedBannerCards,
    selectedBannerGuaranteedCard,
    setSelectedBannerGuaranteedCard,
    selectedBannerGuaranteedPity,
    setSelectedBannerGuaranteedPity,
    showPacks,
    setShowPacks,
    packSearchQuery,
    setPackSearchQuery,
    searchResults,
    isSearching,
    showCustomPackCreator,
    setShowCustomPackCreator,
    customPackQuery,
    setCustomPackQuery,
    isCreatingCustomPack,
    createdCustomPack,
    setCreatedCustomPack,
    customPackSearchResults,
    selectedAnimeIds,
    setSelectedAnimeIds,
    blacklistedUrls,
    setBlacklistedUrls,
    expandPoolForCharacters,
    setExpandPoolForCharacters,
    showArtWarning,
    setShowArtWarning,
    showArtLimitWarning,
    setShowArtLimitWarning,
    cardForArtLimitWarning,
    setCardForArtLimitWarning,
    isFixingCoins,
    isSavingCard,
    isLoaded,
    displayedCardsCount,
    setDisplayedCardsCount,
    isSyncingCards,
    pendingSyncCount,
    setPendingSyncCount,
    prioritizeMainCharacters,
    setPrioritizeMainCharacters,
    pityData,
    ART_BAN_LIMIT,
    bannedArtsByCharacter,
    searchQuery,
    setSearchQuery,
    selectedRarity,
    setSelectedRarity,
    sortBy,
    setSortBy,
    sortOrder,
    setSortOrder,
    selectedPackFilter,
    setSelectedPackFilter,
    selectedMainCharacterFilter,
    setSelectedMainCharacterFilter,
    showFilters,
    setShowFilters,
    showRatingModal,
    setShowRatingModal,
    showErrorPopup,
    setShowErrorPopup,
    errorPopupConfig,
    setErrorPopupConfig,
    showDismantleConfirm,
    setShowDismantleConfirm,
    showDismantleSuccess,
    setShowDismantleSuccess,
    dismantleCardData,
    setDismantleCardData,
    isDismantling,
    dismantleReward,
    showBulkDismantleFilter,
    setShowBulkDismantleFilter,
    showBulkDismantleConfirm,
    setShowBulkDismantleConfirm,
    showBulkDismantleSuccess,
    setShowBulkDismantleSuccess,
    selectedBulkRarity,
    setSelectedBulkRarity,
    excludeMainCharacters,
    setExcludeMainCharacters,
    isBulkDismantling,
    bulkDismantleReward,
    bulkDismantleProgress,
    gachaMainTab,
    setGachaMainTab,
    cardToSell,
    setCardToSell,
    listedCardIds,
    cardToChangeArt,
    setCardToChangeArt,
    cardToPositionArt,
    setCardToPositionArt,
    handleArtPositionChanged,
    showDeleteConfirm,
    setShowDeleteConfirm,
    collectionRating,
    loadListedCards,
    refreshCollectionMerge,
    syncQueuedCards,
    handleListedOnMarket,
    handleTradeComplete,
    handleMarketNotify,
    handleArtChanged,
    handleRoll,
    devForcedRarity,
    setDevForcedRarity,
    saveCard,
    discardRevealedCard,
    handlePackSelect,
    handleRandomRoll,
    handleCreateCustomPack,
    toggleAnimeSelection,
    selectAllAnime,
    deselectAllAnime,
    handleCreateCustomPackFromSelected,
    handleSelectCustomPack,
    unblacklistArt,
    handleSharePage,
    removeCard,
    dismantleCard,
    confirmDismantle,
    cancelDismantle,
    openBulkDismantleFilter,
    selectBulkRarity,
    confirmBulkDismantle,
    cancelBulkDismantle,
    handleFixCoins,
    resetFilters,
    getUniquePacks,
    filteredAndSortedCards
  }
}
