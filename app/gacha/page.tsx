"use client"

import { useRouter } from "next/navigation"
import { useState, useEffect, useCallback, useRef } from "react"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { Sparkles, Star, Heart, Loader2, X, ZoomIn, ExternalLink, RefreshCcw, Trash, Trash2, Crown, Package, Coins, Search, Database, Store, Share, Swords, Wrench, Move, Mail, Calendar, ChevronDown, Flame } from "lucide-react"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { ANIME_PACKS } from "@/lib/gacha-packs"
import type { AnimePack } from "@/lib/gacha-packs"
import { ModifierStyles, frameNames, coatingNames } from "@/components/gacha/card-modifiers"
import { GachaLoading } from "@/components/gacha/gacha-loading"
import { GachaAnimation } from "@/components/gacha/gacha-animation"
import { CollectionCardSkeleton } from "@/components/gacha/collection-skeleton"
import { PackCardSkeleton } from "@/components/gacha/pack-skeleton"
import { BannerSkeleton } from "@/components/gacha/banner-skeleton"
import { GachaErrorPopup } from "@/components/gacha/gacha-error-popup"
import { DismantleConfirmPopup } from "@/components/gacha/dismantle-confirm-popup"
import { DismantleSuccessPopup } from "@/components/gacha/dismantle-success-popup"
import { BulkDismantleFilterPopup } from "@/components/gacha/bulk-dismantle-filter-popup"
import { BulkDismantleConfirmPopup } from "@/components/gacha/bulk-dismantle-confirm-popup"
import { BulkDismantleSuccessPopup } from "@/components/gacha/bulk-dismantle-success-popup"
import { rarityConfig, getDismantleValue } from "@/types/gacha"
import { GachaMarketPanel } from "@/components/gacha/gacha-market-panel"
import { GachaSellMarketModal } from "@/components/gacha/gacha-sell-market-modal"
import { ChangeArtModal } from "@/components/gacha/change-art-modal"
import { ArtPositionModal } from "@/components/gacha/art-position-modal"
import { GachaTutorial } from "@/components/gacha/gacha-tutorial"
import { RollRecommendationModal } from "@/components/gacha/roll-recommendation-modal"
import { InboxPanel } from "@/components/gacha/inbox-panel"

// Newly created/extracted modular helpers
import { useGachaState } from "./hooks/use-gacha-state"
import { PackCard } from "./components/pack-card"
import { BannerCard, type Banner } from "./components/banner-card"
import { TopCard } from "./components/top-card"
import { CollectionCard } from "./components/collection-card"
import { InteractiveCard } from "./components/interactive-card"
import { statLabels } from "./config"
import { getOptimizedThumbSrc } from "./utils"
import { Card, Rarity } from "./types"

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

const RARITY_ORDER = ["trash", "common", "uncommon", "rare", "super_rare", "epic", "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"] as const

function useSpendAnimation(value: number) {
  const [flash, setFlash] = useState(false)
  const [delta, setDelta] = useState<number | null>(null)
  const prevRef = useRef<number | null>(null)

  useEffect(() => {
    if (prevRef.current !== null && value < prevRef.current) {
      setDelta(prevRef.current - value)
      prevRef.current = value
      setFlash(true)
      const t1 = setTimeout(() => setFlash(false), 600)
      const t2 = setTimeout(() => setDelta(null), 900)
      return () => {
        clearTimeout(t1)
        clearTimeout(t2)
      }
    }
    prevRef.current = value
  }, [value])

  return { flash, delta }
}

export default function GachaPage() {
  const {
    isRolling,
    isPackLoading,
    revealedCard,
    collectedCards,
    showCard,
    setShowCard,
    viewedCard,
    setViewedCard,
    session,
    userCoins,
    coinsLoading,
    isDev,
    dust,
    dustLoading,
    refreshDust,
    refreshCoins,
    refreshCollectionMerge,
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
    showDismantleSuccess,
    setShowDismantleSuccess,
    dismantleCardData,
    isDismantling,
    dismantleReward,
    showBulkDismantleFilter,
    setShowBulkDismantleFilter,
    showBulkDismantleConfirm,
    showBulkDismantleSuccess,
    setShowBulkDismantleSuccess,
    selectedBulkRarity,
    excludeMainCharacters,
    isBulkDismantling,
    bulkDismantleReward,
    bulkDismantleProgress,
    gachaMainTab,
    setGachaMainTab,
    cardToSell,
    setCardToSell,
    cardToChangeArt,
    setCardToChangeArt,
    cardToPositionArt,
    setCardToPositionArt,
    handleArtPositionChanged,
    showDeleteConfirm,
    setShowDeleteConfirm,
    collectionRating,
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
    showArtWarning,
    setShowArtWarning,
    showArtLimitWarning,
    setShowArtLimitWarning,
    cardForArtLimitWarning,
    setCardForArtLimitWarning,
    isFixingCoins,
    isSavingCard,
    setIsRolling,
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
  } = useGachaState()

  const coinsAnim = useSpendAnimation(userCoins)
  const dustAnim = useSpendAnimation(dust)

  const router = useRouter()

  const [showTutorial, setShowTutorial] = useState(false)
  const [showMarketTutorial, setShowMarketTutorial] = useState(false)
  const [standardRollsCount, setStandardRollsCount] = useState(0)
  const [tutorialSeen, setTutorialSeen] = useState(false)
  const [showRollRecommendation, setShowRollRecommendation] = useState(false)
  const [recommendationTarget, setRecommendationTarget] = useState<"battle" | "market">("battle")
  const [showInbox, setShowInbox] = useState(false)
  const [unreadMailCount, setUnreadMailCount] = useState(0)
  const [banners, setBanners] = useState<Banner[]>([])
  const [bannersLoading, setBannersLoading] = useState(true)
  const [bannerInfoOpen, setBannerInfoOpen] = useState(false)
  const [eventsCollapsed, setEventsCollapsed] = useState(false)
  const [bannerPulls, setBannerPulls] = useState<Record<string, { pullCount: number; guaranteedClaimed: boolean; collectedGuaranteedCards?: number[] }>>({})

  useEffect(() => {
    fetch('/api/banners')
      .then(r => r.json())
      .then(data => setBanners(data.banners || []))
      .catch(() => setBanners([]))
      .finally(() => setBannersLoading(false))
  }, [])

  const fetchBannerPulls = useCallback(async () => {
    if (!session?.access_token) return
    try {
      const res = await fetch('/api/banners/pulls', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (res.ok && data.pulls) {
        setBannerPulls(data.pulls)
      }
    } catch (err) {
      console.error('Fetch banner pulls error:', err)
    }
  }, [session?.access_token])

  useEffect(() => {
    fetchBannerPulls()
  }, [fetchBannerPulls])

  const handleBannerSelect = (banner: Banner) => {
    const isDynamic = banner.bannerType === 'dynamic'
    const dynContent = banner.dynamicContent

    const packLike: AnimePack = {
      id: 'banner:' + banner.id,
      name: banner.name || (isDynamic && dynContent ? dynContent.featuredAnimeRussianName : 'Баннер'),
      description: banner.description || '',
      animeIds: isDynamic && dynContent ? dynContent.ongoingAnimeIds : (banner.featuredAnimeIds || []),
      price: banner.price ?? 100,
      color: banner.color || (isDynamic ? 'from-cyan-600 to-blue-700' : 'from-purple-600 to-pink-700'),
      bgImage: banner.imageUrl || undefined,
      guaranteedRarity: banner.boostedRarity || undefined,
    }
    setSelectedPack(packLike as any)

    if (isDynamic && dynContent) {
      // Dynamic banner: no manual cards, rolls come from ongoing anime pool
      setSelectedBannerCards([])
      // 3 GG characters as guaranteed pool
      const ggPool = dynContent.guaranteedCharacters.map((c: any) => ({
        ...c,
        rarity: 'legendary',
        name: c.characterName,
        characterName: c.characterName,
        animeName: c.animeName,
        anime: c.animeName,
        isMainCharacter: true,
      }))
      setSelectedBannerGuaranteedCard(null)
      setSelectedBannerGuaranteedPity(banner.guaranteedCardPity || 50)
      // Store the pool on the pack for rollFromBanner to use
      ;(packLike as any).guaranteedCardsPool = ggPool
      ;(packLike as any).userId = session?.user?.id
    } else {
      setSelectedBannerCards(banner.cards || [])
      setSelectedBannerGuaranteedCard(banner.guaranteedCardPayload || null)
      setSelectedBannerGuaranteedPity(banner.guaranteedCardPity || 0)
      // If banner has a guaranteed cards pool, pass it for multi-card pity mode
      if (banner.guaranteedCardsPool && banner.guaranteedCardsPool.length > 0) {
        const pool = banner.guaranteedCardsPool.map((c: any) => ({
          ...c,
          rarity: c.rarity || 'legendary',
          name: c.name || c.characterName,
          characterName: c.characterName || c.name,
          animeName: c.animeName || c.anime || '',
          anime: c.anime || c.animeName || '',
          isMainCharacter: c.isMainCharacter ?? true,
        }))
        ;(packLike as any).guaranteedCardsPool = pool
        ;(packLike as any).userId = session?.user?.id
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    if (typeof window === "undefined") return
    const seen = localStorage.getItem("gacha-tutorial-seen")
    setTutorialSeen(!!seen)
    if (!seen) {
      const timer = setTimeout(() => setShowTutorial(true), 800)
      return () => clearTimeout(timer)
    }
    // Load standard rolls count after tutorial is seen
    const rollsCount = localStorage.getItem("gacha-standard-rolls-count")
    setStandardRollsCount(rollsCount ? parseInt(rollsCount, 10) : 0)
  }, [])

  const fetchUnreadMailCount = useCallback(async () => {
    if (!session?.access_token) return
    try {
      const response = await fetch("/api/mail", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await response.json()
      if (response.ok && data.mail) {
        setUnreadMailCount(data.mail.filter((m: any) => !m.isRead).length)
      }
    } catch (err) {
      console.error("Fetch unread mail count error:", err)
    }
  }, [session?.access_token])

  useEffect(() => {
    fetchUnreadMailCount()
  }, [fetchUnreadMailCount])

  useEffect(() => {
    if (!showInbox) {
      fetchUnreadMailCount()
    }
  }, [showInbox, fetchUnreadMailCount])

  const handleMarketTutorialComplete = useCallback(() => {
    setShowMarketTutorial(false)
    localStorage.setItem("market-tutorial-seen", "true")
  }, [])

  const handleTutorialComplete = useCallback(() => {
    setShowTutorial(false)
    setTutorialSeen(true)
    localStorage.setItem("gacha-tutorial-seen", "true")
    localStorage.setItem("gacha-standard-rolls-count", "0")
  }, [])

  const handleRollWithTracking = async () => {
    await handleRoll()
    if (selectedPack?.id.startsWith('banner:')) {
      fetchBannerPulls()
    }
    if (!selectedPack) {
      const newCount = standardRollsCount + 1
      setStandardRollsCount(newCount)
      localStorage.setItem("gacha-standard-rolls-count", newCount.toString())
    }
  }

  const handleNavigateToBattle = () => {
    const tutorialSeen = localStorage.getItem("gacha-tutorial-seen")
    if (!tutorialSeen) {
      // Allow navigation if tutorial hasn't been seen yet
      router.push("/battle")
      return
    }

    if (collectedCards.length < 1) {
      setErrorPopupConfig({
        title: "Сначала сделай 1 крутку",
        message: "Сделай хотя бы одну стандартную крутку и сохрани карту, чтобы получить команду!",
        type: "info"
      })
      setShowErrorPopup(true)
      return
    }

    if (collectedCards.length < 8) {
      setRecommendationTarget("battle")
      setShowRollRecommendation(true)
      return
    }

    router.push("/battle")
  }

  const handleNavigateToMarket = () => {
    const tutorialSeen = localStorage.getItem("gacha-tutorial-seen")
    if (!tutorialSeen) {
      setGachaMainTab("market")
      return
    }

    if (collectedCards.length < 8) {
      setRecommendationTarget("market")
      setShowRollRecommendation(true)
      return
    }

    setGachaMainTab("market")
    const marketTutorialSeen = localStorage.getItem("market-tutorial-seen")
    if (!marketTutorialSeen) {
      setTimeout(() => setShowMarketTutorial(true), 600)
    }
  }

  const handleContinueToTarget = () => {
    setShowRollRecommendation(false)
    if (recommendationTarget === "battle") {
      router.push("/battle")
    } else {
      setGachaMainTab("market")
      const marketTutorialSeen = localStorage.getItem("market-tutorial-seen")
      if (!marketTutorialSeen) {
        setTimeout(() => setShowMarketTutorial(true), 600)
      }
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] relative text-slate-100 selection:bg-indigo-500/30 font-sans pb-24 overflow-x-hidden">
      <ModifierStyles />
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
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black text-white tracking-tight mb-3">Создать Кастомный набор</h2>
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
                        Создать набор ({selectedAnimeIds.size} аниме)
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
                  {userCoins < createdCustomPack.price ? "Недостаточно монет" : "Выбрать этот набор"}
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

                    unblacklistArt(revealedCard);
                    discardRevealedCard();
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
                    const officialCard: Card = {
                      ...cardForArtLimitWarning,
                      imageUrl: cardForArtLimitWarning.originalUrl,
                      isArtBlacklisted: true
                    };
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
                    discardRevealedCard();
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
            style={{ touchAction: 'none' }}
          >
            <InteractiveCard card={viewedCard} />
            
            {/* Modifier Badges */}
            <div className="flex flex-wrap items-center justify-center gap-2 mt-4 sm:mt-6">
              {viewedCard.frameModifier && (
                <div className="px-3 py-1.5 rounded-full bg-yellow-500/20 border border-yellow-500/30 flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-yellow-300">{frameNames[viewedCard.frameModifier]}</span>
                </div>
              )}
              {viewedCard.coatingModifier && (
                <div className="px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-bold text-cyan-300">{coatingNames[viewedCard.coatingModifier]}</span>
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4 sm:mt-10 w-full max-w-[260px] sm:max-w-3xl mx-auto">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-colors border border-red-500/20"
                title="Удалить из коллекции"
              >
                <Trash className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Удалить</span>
              </button>

              <button
                onClick={() => dismantleCard(viewedCard)}
                className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-colors border border-amber-500/20"
                title={`Распылить (+${getDismantleValue(viewedCard.rarity)} пыли)`}
              >
                <RefreshCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                <span className="truncate">Распылить</span>
              </button>

              {session?.user && (
                <button
                  type="button"
                  onClick={() => {
                    setCardToSell(viewedCard)
                  }}
                  className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-colors border border-cyan-500/30"
                  title="Продать на маркете"
                >
                  <Store className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Продать</span>
                </button>
              )}

              {session?.user && (
                <button
                  type="button"
                  onClick={() => {
                    setCardToChangeArt(viewedCard)
                    setViewedCard(null)
                  }}
                  className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-colors border border-purple-500/30"
                  title="Сменить арт"
                >
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Арт</span>
                </button>
              )}

              {session?.user && (
                <button
                  type="button"
                  onClick={() => {
                    setCardToPositionArt(viewedCard)
                    setViewedCard(null)
                  }}
                  className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-colors border border-cyan-500/30"
                  title="Изменить позицию арта"
                >
                  <Move className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Позиция</span>
                </button>
              )}

              {isDev && (
                <button
                  type="button"
                  onClick={() => {
                    sessionStorage.setItem('edit-card-data', JSON.stringify(viewedCard));
                    router.push('/admin/card-editor');
                  }}
                  className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-colors border border-amber-500/30"
                  title="Редактировать (Dev)"
                >
                  <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Ред.</span>
                </button>
              )}

              {viewedCard.isMainCharacter && viewedCard.isArtBlacklisted && (
                <button
                  onClick={() => unblacklistArt(viewedCard)}
                  className="px-3 py-2 sm:px-4 sm:py-2.5 rounded-lg sm:rounded-xl bg-green-500/10 hover:bg-green-500/20 text-green-400 font-bold text-[10px] sm:text-xs flex items-center justify-center gap-1.5 sm:gap-2 transition-colors border border-green-500/20"
                  title="Разблокировать арт"
                >
                  <RefreshCcw className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                  <span className="truncate">Разбл.</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTENT AREA */}
      <div className="container mx-auto px-4 sm:px-6 py-8 sm:py-12 lg:py-16 max-w-7xl relative z-10">
        
       {/* Header Section */}
        <div className="text-center mb-8 sm:mb-16">
          <div className="flex items-center justify-center gap-3 mb-3 sm:mb-4">
            <h1 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 uppercase drop-shadow-sm px-2">
              WEEB.<span className="text-indigo-500">X</span> ГАЧА
            </h1>
            <button
              onClick={handleSharePage}
              className="p-2 sm:p-2.5 rounded-full bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 transition-colors border border-indigo-500/30"
              title="Поделиться страницей"
            >
              <Share className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
          </div>
          <p className="text-slate-400 text-xs sm:text-base md:text-lg font-medium max-w-2xl mx-auto px-4">
            Призывай любимых персонажей и собирай уникальную коллекцию. Нажми на карту, чтобы увидеть характеристики.
          </p>
          
          <div className="flex flex-wrap justify-center items-center gap-2 sm:gap-4 mt-6 sm:mt-8 px-2 sm:px-0">
            <div data-tutorial="coins" className={`relative flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-xl shadow-yellow-500/5 transition-all duration-200 ${coinsAnim.flash ? 'ring-2 ring-red-500/70 ring-offset-2 ring-offset-slate-900' : ''}`}>
              <Coins className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-400" />
              {coinsLoading ? (
                <Loader2 className="w-4 h-4 sm:w-6 sm:h-6 text-yellow-400 animate-spin" />
              ) : (
                <span className={`text-lg sm:text-2xl font-black tracking-tight transition-colors duration-200 ${coinsAnim.flash ? 'text-red-500 animate-spend' : 'text-yellow-400'}`}>{userCoins.toLocaleString()}</span>
              )}
              {coinsAnim.delta !== null && (
                <span className="absolute -top-5 left-1/2 text-red-400 font-black text-xs animate-float-minus whitespace-nowrap pointer-events-none">
                  -{coinsAnim.delta.toLocaleString()}
                </span>
              )}
            </div>

            <div data-tutorial="dust" className={`relative flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-xl shadow-amber-500/5 transition-all duration-200 ${dustAnim.flash ? 'ring-2 ring-red-500/70 ring-offset-2 ring-offset-slate-900' : ''}`}>
              <Sparkles className="w-4 h-4 sm:w-6 sm:h-6 text-amber-400" />
              {dustLoading ? (
                <Loader2 className="w-4 h-4 sm:w-6 sm:h-6 text-amber-400 animate-spin" />
              ) : (
                <span className={`text-lg sm:text-2xl font-black tracking-tight transition-colors duration-200 ${dustAnim.flash ? 'text-red-500 animate-spend' : 'text-amber-400'}`}>{dust.toLocaleString()}</span>
              )}
              {dustAnim.delta !== null && (
                <span className="absolute -top-5 left-1/2 text-red-400 font-black text-xs animate-float-minus whitespace-nowrap pointer-events-none">
                  -{dustAnim.delta.toLocaleString()}
                </span>
              )}
            </div>

            <button
              onClick={() => setShowInbox(true)}
              className="relative flex items-center gap-2 px-3 py-2 sm:px-5 sm:py-2.5 rounded-xl sm:rounded-2xl bg-slate-900/80 backdrop-blur-md border border-slate-800 shadow-xl shadow-indigo-500/5 hover:bg-slate-800/80 transition-colors"
              title="Почта"
            >
              <Mail className="w-4 h-4 sm:w-6 sm:h-6 text-indigo-400" />
              {unreadMailCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {unreadMailCount}
                </span>
              )}
            </button>

            {/* Sync indicator and manual sync button */}
            {(pendingSyncCount > 0 || isSyncingCards) && (
              <button
                onClick={async () => {
                  const result = await syncQueuedCards(session);
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
        {/* Selected Pack / Banner Indicator */}
        {selectedPack && (() => {
          const isBanner = selectedPack.id.startsWith("banner:")
          const bannerId = isBanner ? selectedPack.id.replace("banner:", "") : null
          const pullInfo = bannerId ? bannerPulls[bannerId] : null
          const pool = (selectedPack as any).guaranteedCardsPool
          const hasPool = pool && pool.length > 0
          const hasSingleGuarantee = !!selectedBannerGuaranteedCard && selectedBannerGuaranteedPity > 0
          const effectivePity = selectedBannerGuaranteedPity || 0
          const remainingPity = pullInfo && effectivePity > 0 && !pullInfo.guaranteedClaimed
            ? Math.max(0, effectivePity - pullInfo.pullCount)
            : undefined
          const collectedCount = pullInfo?.collectedGuaranteedCards ? (pullInfo.collectedGuaranteedCards as number[]).length : 0
          const showPity = isBanner && (hasPool || hasSingleGuarantee) && effectivePity > 0
          return (
            <div className="mb-8 sm:mb-12 text-center animate-in fade-in slide-in-from-top-4">
              <div className={`inline-flex items-center gap-3 bg-slate-900/80 backdrop-blur-md px-5 py-3 rounded-2xl border shadow-lg ${isBanner ? "border-pink-500/40 shadow-pink-500/10" : "border-indigo-500/30 shadow-indigo-500/10"}`}>
                {isBanner ? (
                  <Calendar className="w-5 h-5 text-pink-400" />
                ) : (
                  <Package className="w-5 h-5 text-indigo-400" />
                )}
                <span className="text-white font-bold text-sm sm:text-base">
                  {isBanner ? "Ивент: " : "Набор: "}
                  <span className={isBanner ? "text-pink-300" : "text-indigo-300"}>{selectedPack.name}</span>
                </span>
                {showPity && (
                  <>
                    <div className="w-px h-5 bg-white/10 mx-1" />
                    <div className="inline-flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-amber-300" />
                      <span className="text-xs font-bold text-amber-200">
                        {hasPool
                          ? pullInfo?.guaranteedClaimed
                            ? 'Гарант получен'
                            : remainingPity !== undefined
                              ? `Гарант: ${collectedCount}/${pool.length} карт через ${remainingPity} круток`
                              : `Гарант: 1 из ${pool.length} карт через ${effectivePity} круток`
                          : pullInfo?.guaranteedClaimed
                            ? 'Гарант получен'
                            : remainingPity !== undefined
                              ? `Гарант-карта через ${remainingPity} круток`
                              : `Гарант-карта через ${effectivePity} круток`}
                      </span>
                    </div>
                  </>
                )}
                <div className="w-px h-5 bg-white/10 mx-2" />
                <button
                  onClick={() => setSelectedPack(null)}
                  className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )
        })()}

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
                data-tutorial="roll-button"
                onClick={handleRollWithTracking}
                disabled={coinsLoading || userCoins < (selectedPack ? selectedPack.price : 50)}
                className={`group relative w-[260px] sm:w-72 md:w-80 h-[380px] sm:h-[420px] md:h-[480px] rounded-[2rem] sm:rounded-[2.5rem] border-2 border-dashed backdrop-blur-md flex flex-col items-center justify-center transition-all duration-300 overflow-hidden shadow-2xl ${
                  coinsLoading || userCoins < (selectedPack ? selectedPack.price : 50)
                    ? 'border-red-500/50 bg-red-900/40 cursor-not-allowed opacity-60'
                    : 'border-slate-700/50 bg-slate-900/40 hover:bg-slate-800/60 hover:border-indigo-500/50'
                }`}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-transparent to-indigo-500/5 group-hover:to-indigo-500/10 transition-colors" />
                {coinsLoading ? (
                  <Loader2 className="w-8 h-8 sm:w-12 sm:h-12 text-slate-400 mb-4 sm:mb-5 animate-spin" />
                ) : userCoins < (selectedPack ? selectedPack.price : 50) ? (
                  <Coins className="w-8 h-8 sm:w-12 sm:h-12 text-red-400 mb-4 sm:mb-5" />
                ) : (
                  <Sparkles className="w-8 h-8 sm:w-12 sm:h-12 text-indigo-500/70 group-hover:text-indigo-400 mb-4 sm:mb-5 animate-pulse" />
                )}
                <span className={`font-black uppercase tracking-widest text-xs sm:text-base text-center px-4 relative z-10 ${
                  coinsLoading || userCoins < (selectedPack ? selectedPack.price : 50)
                    ? 'text-red-400'
                    : 'text-slate-400 group-hover:text-indigo-300'
                }`}>
                  {coinsLoading
                    ? 'Загрузка...'
                    : userCoins < (selectedPack ? selectedPack.price : 50)
                    ? `Недостаточно монет (нужно ${selectedPack ? selectedPack.price : 50})`
                    : (selectedPack ? `Призвать (${selectedPack.price})` : "Призвать (50)")
                  }
                </span>
              </button>

              {/* Tutorial Progress Indicator */}
              {tutorialSeen && collectedCards.length < 8 && !selectedPack && (
                <div className="mt-4 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl max-w-[260px] sm:max-w-full text-center">
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                    <Swords className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400" />
                    <span className="text-amber-300 font-semibold text-xs sm:text-sm truncate">
                      Рекомендуется: {collectedCards.length}/8 карт
                    </span>
                    <Swords className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400" />
                  </div>
                  <div className="mt-1.5 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                      style={{ width: `${(collectedCards.length / 8) * 100}%` }}
                    />
                  </div>
                  <div className="text-center mt-1 text-[10px] sm:text-xs text-amber-200">
                    {collectedCards.length === 0
                      ? "Сделай хотя бы 1 крутку для доступа к битвам"
                      : `Рекомендуется ещё ${8 - collectedCards.length} карт для туториала битв`
                    }
                  </div>
                </div>
              )}

              {/* Pity System Indicator */}
              {pityData && pityData.bad_luck_streak > 0 && (
                <div className="mt-4 px-3 py-1.5 sm:px-4 sm:py-2 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl max-w-[260px] sm:max-w-full text-center">
                  <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                    <Star className="w-3 h-3 sm:w-4 sm:h-4 text-amber-400" />
                    <span className="text-amber-300 font-semibold text-xs sm:text-sm truncate">
                      Заряд удачи: {pityData.bad_luck_streak}
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

              {/* Dev: Force Rarity Selector */}
              {isDev && (
                <div className="mt-4 px-3 py-2 bg-purple-900/30 border border-purple-500/30 rounded-xl max-w-[260px] sm:max-w-full">
                  <div className="text-purple-300 text-[10px] font-bold uppercase tracking-wider mb-1.5 text-center">
                    DEV: Подкрутить редкость
                  </div>
                  <div className="flex flex-wrap gap-1 justify-center">
                    <button
                      onClick={() => setDevForcedRarity(null)}
                      className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${!devForcedRarity ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                    >
                      Случайно
                    </button>
                    {RARITY_ORDER.map(r => (
                      <button
                        key={r}
                        onClick={() => setDevForcedRarity(r)}
                        className={`px-2 py-1 rounded text-[10px] font-bold transition-all ${devForcedRarity === r ? 'bg-purple-500 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mt-4 sm:mt-8 w-full max-w-[260px] sm:max-w-full">
                <button
                  data-tutorial="select-pack"
                  onClick={() => setShowPacks(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl transition-all shadow-lg text-xs sm:text-base w-full"
                >
                  <Package className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-400 shrink-0" />
                  Выбрать набор
                </button>

                <button
                  data-tutorial="create-pack"
                  onClick={() => setShowCustomPackCreator(true)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 sm:py-3.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white font-bold rounded-xl transition-all shadow-lg text-xs sm:text-base w-full"
                >
                  <Search className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400 shrink-0" />
                  Создать набор
                </button>
              </div>
            </div>
          )}

          {/* Rolling State */}
          {isRolling && (
            <div className="flex flex-col items-center justify-center w-full animate-in fade-in duration-500">
              <GachaAnimation 
                isRolling={isRolling} 
                revealedCard={revealedCard} 
                onComplete={() => {
                  setShowCard(true);
                  setIsRolling(false);
                }} 
              />
            </div>
          )}

          {/* Revealed Card State */}
          {showCard && revealedCard && (
            <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-700 w-full">
              <InteractiveCard card={revealedCard} />

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-8 sm:mt-10 w-full max-w-xs sm:max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
                <button
                  data-tutorial="save-card"
                  onClick={() => {
                    saveCard(revealedCard);
                  }}
                  disabled={isSavingCard}
                  className="flex-1 px-4 sm:px-6 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black uppercase tracking-wider rounded-xl sm:rounded-2xl transition-all text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/25 border border-indigo-400/50 relative group"
                >
                  {isSavingCard ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin relative z-10" />
                      <span className="relative z-10">Сохранение...</span>
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
                      discardRevealedCard();
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

        {/* Events / Banners Section */}
        {bannersLoading && banners.length === 0 ? (
          <section className="mb-12 sm:mb-16">
            <button
              className="flex items-center gap-3 mb-6 sm:mb-8 w-full group opacity-50 cursor-not-allowed"
              disabled
            >
              <div className="w-6 h-6 sm:w-7 sm:h-7 bg-slate-700 rounded-lg animate-pulse flex-shrink-0" />
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">Ивенты</h2>
              <div className="flex-1" />
            </button>
            <BannerSkeleton count={6} />
          </section>
        ) : (
          banners.length > 0 && (
            <section className="mb-12 sm:mb-16">
              <button
                onClick={() => setEventsCollapsed(!eventsCollapsed)}
                className="flex items-center gap-3 mb-6 sm:mb-8 w-full group"
              >
                <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-pink-400 flex-shrink-0" />
                <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight text-left">Ивенты</h2>
                <span className="px-3 py-1 rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-300 text-xs font-bold uppercase tracking-wider flex-shrink-0">Активно</span>
                <div className="flex-1" />
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-white/40 font-bold hidden sm:block">{eventsCollapsed ? 'Показать' : 'Скрыть'}</span>
                  <div className={`w-8 h-8 flex items-center justify-center rounded-lg bg-slate-800/80 border border-white/10 text-white/60 group-hover:text-white group-hover:bg-slate-700 transition-all ${eventsCollapsed ? '' : 'rotate-180'}`}>
                    <ChevronDown className="w-5 h-5" />
                  </div>
                </div>
              </button>
              {!eventsCollapsed && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 lg:gap-6">
                  {banners.map(banner => {
                    const pullInfo = bannerPulls[banner.id]
                    const remainingPity = pullInfo && banner.guaranteedCardPity > 0 && !pullInfo.guaranteedClaimed
                      ? Math.max(0, banner.guaranteedCardPity - pullInfo.pullCount)
                      : undefined
                    return (
                      <BannerCard
                        key={banner.id}
                        banner={banner}
                        onSelect={handleBannerSelect}
                        userCoins={userCoins}
                        onInfoOpenChange={setBannerInfoOpen}
                        remainingPity={remainingPity}
                        pityClaimed={pullInfo?.guaranteedClaimed}
                        sessionToken={session?.access_token}
                        collectedGGs={pullInfo?.collectedGuaranteedCards}
                      />
                    )
                  })}
                </div>
              )}
            </section>
          )
        )}

        {/* Collection Section */}
        {!isLoaded ? (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-5">
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
              
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 lg:gap-5">
                <CollectionCardSkeleton count={12} />
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col gap-5">
              
              {/* Collection Header */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div data-tutorial="collection" className="flex items-center gap-3">
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

                  <button
                    data-tutorial="filters"
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-all border ${showFilters ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'bg-slate-800 border-slate-700 hover:bg-slate-700 text-white'}`}
                  >
                    <Search className="w-4 h-4" />
                    Фильтры
                    {showFilters ? <X className="w-4 h-4 ml-1" /> : null}
                  </button>
                </div>
              </div>

              {/* Filter Panel */}
              {showFilters && (
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
                        <option value="all">Все типа</option>
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
            {filteredAndSortedCards.length !== collectedCards.length && (
              <div className="text-sm font-bold text-slate-400">
                Показано <span className="text-white">{filteredAndSortedCards.length}</span> из {collectedCards.length} карт
              </div>
            )}

            {/* Grid */}
            {filteredAndSortedCards.length === 0 ? (
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
                    onClick={() => setDisplayedCardsCount(prev => prev + 10)}
                    className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold rounded-xl transition-all shadow-lg border border-white/10 flex items-center gap-2"
                  >
                    <Sparkles className="w-5 h-5" />
                    Открыть ещё 10
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
          dust={dust}
          refreshDust={refreshDust}
        />
      )}

      {cardToPositionArt && (
        <ArtPositionModal
          card={cardToPositionArt}
          onClose={() => setCardToPositionArt(null)}
          onPositionChanged={handleArtPositionChanged}
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
        <AlertDialogContent className="bg-slate-900 border-slate-700/50 w-[90vw] max-w-[90vw] sm:max-w-md rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl">
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
      <div className={`fixed bottom-4 sm:bottom-6 left-1/2 -translate-x-1/2 z-40 w-[92%] max-w-[400px] md:hidden pb-[env(safe-area-inset-bottom)] transition-opacity duration-200 ${bannerInfoOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl shadow-black/40 flex items-center justify-between p-1.5 h-[64px] sm:h-[72px]">
          <button
            type="button"
            onClick={() => setGachaMainTab("gacha")}
            className={`flex flex-col items-center justify-center gap-1 w-1/3 h-full rounded-xl transition-all duration-300 ${
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
            onClick={handleNavigateToMarket}
            className={`flex flex-col items-center justify-center gap-1 w-1/3 h-full rounded-xl transition-all duration-300 ${
              gachaMainTab === "market"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-inner"
                : "text-slate-400 hover:text-slate-300 hover:bg-white/5 active:scale-95"
            }`}
          >
            <Store className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] sm:text-xs font-bold tracking-wide">Маркет</span>
          </button>
          <button
            type="button"
            data-tutorial="nav-battle"
            onClick={handleNavigateToBattle}
            className="flex flex-col items-center justify-center gap-1 w-1/3 h-full rounded-xl transition-all duration-300 text-slate-400 hover:text-slate-300 hover:bg-white/5 active:scale-95"
          >
            <Swords className="w-5 h-5 sm:w-6 sm:h-6" />
            <span className="text-[10px] sm:text-xs font-bold tracking-wide">Битвы</span>
          </button>
        </div>
      </div>
      
      {/* Desktop Tab Buttons (Fixed at bottom) */}
      <div className={`hidden md:flex fixed bottom-6 lg:bottom-8 left-1/2 -translate-x-1/2 z-40 transition-opacity duration-200 ${bannerInfoOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
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
            onClick={handleNavigateToMarket}
            className={`flex items-center gap-2.5 px-8 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 ${
              gachaMainTab === "market"
                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10"
                : "text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
            }`}
          >
            <Store className="w-5 h-5" />
            Маркет
          </button>
          <button
            type="button"
            data-tutorial="nav-battle"
            onClick={handleNavigateToBattle}
            className="flex items-center gap-2.5 px-8 py-3 rounded-xl text-sm font-black uppercase tracking-wider transition-all duration-300 text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent"
          >
            <Swords className="w-5 h-5" />
            Битвы
          </button>
        </div>
      </div>

      {showTutorial && (
        <GachaTutorial
          onComplete={handleTutorialComplete}
          gachaState={{
            isRolling,
            showCard,
            revealedCard,
            collectedCardsCount: collectedCards.length,
          }}
        />
      )}

      {showMarketTutorial && (
        <GachaTutorial
          onComplete={handleMarketTutorialComplete}
          tutorialType="marketplace"
        />
      )}

      {showRollRecommendation && (
        <RollRecommendationModal
          isOpen={showRollRecommendation}
          onClose={() => setShowRollRecommendation(false)}
          onContinue={handleContinueToTarget}
          target={recommendationTarget}
          currentCards={collectedCards.length}
        />
      )}

      <InboxPanel
        open={showInbox}
        onOpenChange={setShowInbox}
        session={session}
        onClaimed={(claimedType) => {
          // Refresh balances + collection so the user sees the claimed reward
          if (claimedType === "coins") {
            refreshCoins?.()
          } else if (claimedType === "dust") {
            refreshDust?.()
          } else if (claimedType === "card_gift") {
            refreshCollectionMerge?.()
          } else {
            // event_reward or unknown — refresh everything
            refreshCoins?.()
            refreshDust?.()
            refreshCollectionMerge?.()
          }
        }}
      />

      <Footer />
    </div>
  )
}
