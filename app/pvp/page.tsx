"use client"

import { useState, useRef, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Navbar } from "@/components/layout/navbar"
import { Footer } from "@/components/layout/footer"
import { Swords, AlertCircle, X, RefreshCcw, Star, Crown, Lock, LogIn, Share, Sparkles } from "lucide-react"
import { useBattleData } from "@/app/battle/hooks/use-battle-data"
import { useAuth } from "@/components/auth/auth-provider"
import { AuthModal } from "@/components/auth/auth-modal"
import { GachaTutorial } from "@/components/gacha/gacha-tutorial"
import { StatsPanel, StatsPanelSkeleton } from "@/app/battle/components/StatsPanel"
import { SelectedTeamPanel, SelectedTeamPanelSkeleton } from "@/app/battle/components/SelectedTeamPanel"
import { BattleArena } from "@/app/battle/components/BattleArena"
import { BattleResultView } from "@/app/battle/components/BattleResultView"
import { TeamBuilderModal } from "@/app/battle/components/TeamBuilderModal"
import { AutoBuildConfirmModal } from "@/app/battle/components/AutoBuildConfirmModal"
import { PvPArena } from "@/app/battle/components/PvPArena"
import { Leaderboard } from "@/app/battle/components/Leaderboard"
import { usePvPBattle } from "@/app/battle/hooks/use-pvp-battle"
import { glassCard } from "@/app/battle/config"
import { computeDeckSynergies } from "@/app/battle/utils"
import { Card } from "@/app/battle/types"
import { rarityConfig } from "@/types/gacha"
import { getProxiedSrc } from "@/lib/image-loader"

const StatBar = ({ label, value, color }: { label: string; value: number; color: string }) => {
  const maxValue = 100
  const percentage = Math.min((value / maxValue) * 100, 100)
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <span className="text-[9px] sm:text-[10px] md:text-[11px] font-bold text-white/70 uppercase tracking-wider">{label}</span>
        <span className="text-[10px] sm:text-[11px] md:text-[12px] font-black text-white">{value}</span>
      </div>
      <div className="h-1.5 sm:h-2 bg-black/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  )
}

const statLabels = { hp: "Здоровье", atk: "Атака", def: "Защита", spd: "Скорость", luck: "Удача" }

const InteractiveCard = ({ card }: { card: Card }) => {
  const cardRef = useRef<HTMLDivElement>(null)
  const [rotation, setRotation] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isTouching, setIsTouching] = useState(false)
  const [isImageLoading, setIsImageLoading] = useState(true)
  const animationFrameRef = useRef<number | undefined>(undefined)

  useEffect(() => { setIsImageLoading(true) }, [card.imageUrl])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = undefined }
        setRotation({ x: 0, y: 0 }); setIsHovered(false)
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => { document.removeEventListener('visibilitychange', handleVisibilityChange) }
  },[])

  useEffect(() => {
    return () => { if (animationFrameRef.current) { cancelAnimationFrame(animationFrameRef.current); animationFrameRef.current = undefined } }
  },[])

  const handleMouseMove = useCallback((e: any) => {
    if (!cardRef.current) return
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = requestAnimationFrame(() => {
      const rect = cardRef.current?.getBoundingClientRect(); if (!rect) return
      const x = e.clientX - rect.left, y = e.clientY - rect.top
      setRotation({ x: ((y - rect.height/2) / (rect.height/2)) * -12, y: ((x - rect.width/2) / (rect.width/2)) * 12 })
      setIsHovered(true)
    })
  },[])

  const handleMouseLeave = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = requestAnimationFrame(() => { setRotation({ x: 0, y: 0 }); setIsHovered(false) })
  },[])

  const handleTouchStart = useCallback(() => { setIsTouching(true) },[])
  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (!cardRef.current || !isTouching) return
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = requestAnimationFrame(() => {
      const rect = cardRef.current?.getBoundingClientRect(); if (!rect) return
      const touch = e.touches[0]
      setRotation({ x: ((touch.clientY - rect.top - rect.height/2) / (rect.height/2)) * -12, y: ((touch.clientX - rect.left - rect.width/2) / (rect.width/2)) * 12 })
      setIsHovered(true)
    })
  }, [isTouching])

  const handleTouchEnd = useCallback(() => {
    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
    animationFrameRef.current = requestAnimationFrame(() => { setRotation({ x: 0, y: 0 }); setIsHovered(false); setIsTouching(false) })
  },[])

  const highlightX = -rotation.y * 1.2, highlightY = rotation.x * 1.2

  return (
    <div ref={cardRef} onMouseMove={handleMouseMove} onMouseLeave={handleMouseLeave} onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} onClick={() => setIsFlipped(!isFlipped)}
      className="relative w-[260px] sm:w-72 md:w-80 h-[380px] sm:h-[440px] md:h-[480px] max-w-[calc(100vw-2rem)] transition-transform duration-500 ease-out cursor-pointer"
      style={{ transform: `perspective(1000px) rotateX(${rotation.x}deg) rotateY(${rotation.y + (isFlipped ? 180 : 0)}deg)`, transformStyle: "preserve-3d", touchAction: isTouching ? 'none' : 'auto' }}>
      <div className={`absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] overflow-hidden ${rarityConfig[card.rarity].bg} ${rarityConfig[card.rarity].glow} border-2 border-white/10`} style={{ backfaceVisibility: "hidden" }}>
        <Image src={getProxiedSrc(card.imageUrl)} alt={card.name} unoptimized={true} className="absolute inset-0 w-full h-full object-cover scale-[1.02]" fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 40vw" quality={80} priority={true} referrerPolicy="no-referrer" style={card.artPosition ? { objectPosition: `${card.artPosition.x}% ${card.artPosition.y}%` } : undefined} onLoad={() => setIsImageLoading(false)} />
        {isImageLoading && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-20"><div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" /></div>}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/20 to-slate-950/20 pointer-events-none" />
        <div className="absolute inset-0 opacity-0 transition-opacity duration-300 pointer-events-none" style={{ background: `radial-gradient(circle at ${50 + highlightX}% ${50 + highlightY}%, rgba(255,255,255,0.15) 0%, transparent 50%)`, opacity: isHovered ? 1 : 0 }} />
        <div className="absolute top-3 sm:top-4 md:top-5 inset-x-3 sm:inset-x-4 md:inset-x-5 flex justify-between items-start pointer-events-none z-10">
          <div className="flex flex-col gap-1.5 sm:gap-2">
            <div className={`px-2.5 sm:px-3 py-1 rounded-full text-[9px] sm:text-[10px] font-black uppercase tracking-widest backdrop-blur-md bg-black/40 border border-white/20 shadow-xl w-fit`}><span className={`bg-gradient-to-r ${rarityConfig[card.rarity].color} bg-clip-text text-transparent`}>{rarityConfig[card.rarity].label}</span></div>
            {card.isMainCharacter && <div className="w-fit flex items-center gap-1 sm:gap-1.5 px-2 py-1 rounded-full text-[8px] sm:text-[9px] font-black uppercase tracking-wider bg-gradient-to-r from-yellow-400 to-amber-500 text-amber-950 shadow-lg border border-yellow-300"><Crown className="w-2.5 sm:w-3 h-2.5 sm:h-3" />Главный герой</div>}
          </div>
          <div className="flex items-center gap-1 bg-black/50 backdrop-blur-md px-2.5 sm:px-3 py-1 rounded-full border border-white/20 shadow-xl shrink-0"><Star className="w-3 h-3 text-yellow-400 fill-yellow-400" /><span className="text-[10px] sm:text-[11px] font-black text-white">{card.score?.toFixed(1) || '0'}</span></div>
        </div>
        <div className="absolute bottom-3 sm:bottom-4 md:bottom-5 inset-x-3 sm:inset-x-4 md:inset-x-5 pointer-events-none z-10">
          <div className="backdrop-blur-xl bg-slate-900/40 border border-white/10 rounded-xl sm:rounded-2xl p-3 sm:p-4 shadow-2xl relative overflow-hidden">
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b ${rarityConfig[card.rarity].color}`} />
            <h3 className="text-base sm:text-xl md:text-2xl font-black text-white uppercase leading-none drop-shadow-lg truncate mb-1">{card.name}</h3>
            <p className="text-[8px] sm:text-[10px] md:text-xs text-white/70 font-bold uppercase tracking-wider truncate">{card.anime}</p>
          </div>
        </div>
      </div>
      <div className={`absolute inset-0 rounded-[1.5rem] sm:rounded-[2rem] md:rounded-[2.5rem] p-5 sm:p-6 md:p-8 flex flex-col justify-between border-[3px] sm:border-4 ${rarityConfig[card.rarity].bg} ${rarityConfig[card.rarity].glow}`} style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)", borderColor: `rgba(${rarityConfig[card.rarity].rgb}, 0.5)` }}>
        <div className="relative z-10 space-y-3 sm:space-y-6">
          <div className="text-center pb-2.5 sm:pb-4 border-b border-white/10">
            <p className={`text-[8px] sm:text-[10px] md:text-[11px] font-black uppercase tracking-widest bg-gradient-to-r ${rarityConfig[card.rarity].color} bg-clip-text text-transparent mb-1`}>Характеристики</p>
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
          <div className="w-10 sm:w-14 h-10 sm:h-14 mx-auto rounded-full border-2 border-white/10 flex items-center justify-center bg-white/5 backdrop-blur-sm shadow-xl"><RefreshCcw className="w-4 sm:w-6 h-4 sm:h-6 text-white/40" /></div>
          <p className="text-[7px] sm:text-[9px] font-black text-white/40 uppercase tracking-widest leading-tight">Нажмите чтобы перевернуть</p>
        </div>
      </div>
    </div>
  )
}

export default function PvPPage() {
  const router = useRouter()
  const { user, sessionLoading } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showPvPArena, setShowPvPArena] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [viewedCard, setViewedCard] = useState<Card | null>(null)
  const [isPvPMode, setIsPvPMode] = useState(true)
  const [showBattleTutorial, setShowBattleTutorial] = useState(false)
  const [showAutoBuildConfirm, setShowAutoBuildConfirm] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const prevRoundResultsRef = useRef<any>(null)

  const {
    sessionLoading: battleSessionLoading,
    userCoins, coinsLoading, dust, dustLoading,
    progress, dungeons, enemies, logs,
    selectedCards, selectedDungeon, setSelectedDungeon,
    leaderId, setLeaderId, formation, setFormation,
    battleState, setBattleState, ccgState,
    placedThisRound, aiPlacedThisRound, isRoundConfirmed,
    playCardToZone, recallCard, reorganizeHand, moveCardBetweenZones,
    confirmRoundPlacement, nextRound, updateScores,
    showTeamBuilder, setShowTeamBuilder,
    teamSearch, setTeamSearch, selectedRole, setSelectedRole, sortBy, setSortBy,
    error, setError, staminaTime,
    toggleCardSelection, autoBuildDeck,
    startBattle, startPvPBattle, finishBattle, closeBattleResult,
    isFinishing, teamPower, filteredCards, opponentDeckContext,
    cardEffects, destroyingCards, modifierActivations, floatingTexts,
    triggerCardEffect, triggerCardDestruction, triggerModifierActivation, addFloatingText,
    updatePvPRound, resolvePvPRound, resolvePvPMatchEnd,
    isInitializing, loadBattleData, aiThinking,
  } = useBattleData()

  const isPlayer1Ref = useRef<boolean>(false)

  const { pvpState, resetPvP, joinQueue, leaveQueue, isConnected, placeCards, isPvPAvailable } = usePvPBattle({
    onRoundResolved: (results) => { resolvePvPRound(results, isPlayer1Ref.current) },
    onStartNewRound: (data) => { updatePvPRound(data.yourDeck, data.round) },
    onMatchEnded: (data) => { resolvePvPMatchEnd(data.winner, data.reason) },
  })

  useEffect(() => { if (pvpState.matchData) isPlayer1Ref.current = pvpState.matchData.isPlayer1 }, [pvpState.matchData])

  const handleBattleTutorialComplete = useCallback(() => { setShowBattleTutorial(false); localStorage.setItem("battle-tutorial-seen", "true") }, [])

  useEffect(() => { if (retryCount > 0 && user && !sessionLoading) loadBattleData() }, [retryCount, user, sessionLoading, loadBattleData])

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!user || sessionLoading) return
    const seen = localStorage.getItem("battle-tutorial-seen")
    if (!seen) { const timer = setTimeout(() => setShowBattleTutorial(true), 800); return () => clearTimeout(timer) }
  }, [user, sessionLoading])

  useEffect(() => {
    if (pvpState.status === 'matched' && pvpState.matchData && battleState === 'idle') {
      setShowPvPArena(false); setIsPvPMode(true); startPvPBattle(pvpState.matchData)
    }
  }, [pvpState.status, pvpState.matchData, battleState, startPvPBattle])

  useEffect(() => {
    if (battleState === 'idle' && isPvPMode) { setIsPvPMode(true); resetPvP() }
  }, [battleState, isPvPMode, resetPvP])

  const handleCardClick = (card: Card) => setViewedCard(card)

  const handleAutoBuildRequest = useCallback(() => {
    if (selectedCards.length === 0) {
      autoBuildDeck()
    } else {
      setShowAutoBuildConfirm(true)
    }
  }, [selectedCards.length, autoBuildDeck])

  const handleAutoBuildConfirm = useCallback((keepIds: string[]) => {
    setShowAutoBuildConfirm(false)
    autoBuildDeck(selectedCards.filter(c => keepIds.includes(c.uniqueId)))
  }, [selectedCards, autoBuildDeck])

  const handleSharePage = async () => {
    const shareText = `⚔️ WEEB-X PVP - Сражайся с реальными игроками в онлайн-арене! Поднимайся в рейтинге и докажи своё мастерство! Зарегистрируй аккаунт и начни бой! За первую регистрацию получи 10,000 монет бесплатно.`
    const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
    if (navigator.share) { try { await navigator.share({ title: 'WEEB-X PvP', text: shareText, url: shareUrl }) } catch (e) { console.error(e) } }
    else { try { await navigator.clipboard.writeText(`${shareText}\n${shareUrl}`); alert('Ссылка скопирована!') } catch (e) { alert('Не удалось скопировать') } }
  }

  const activeSynergies = computeDeckSynergies(selectedCards).active

  return (
    <div className={`min-h-screen bg-[#05050A] relative text-slate-100 font-sans selection:bg-indigo-500/30 ${battleState !== "idle" ? "overflow-hidden" : "overflow-x-hidden"}`}>
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-900/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-rose-900/10 blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute top-[30%] left-[50%] w-[30vw] h-[30vw] rounded-full bg-blue-900/10 blur-[100px]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50" />
      </div>

      {battleState === "idle" && <Navbar />}

      {!sessionLoading && !user && battleState === "idle" && (
        <div className="fixed inset-0 z-20 flex items-center justify-center p-4 bg-[#05050A]">
          <div className="max-w-md w-full text-center space-y-6 animate-in fade-in zoom-in-95">
            <div className="relative w-24 h-24 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full bg-orange-500/20 blur-xl animate-pulse" />
              <div className="relative w-full h-full rounded-full bg-white/5 border border-white/10 flex items-center justify-center"><Lock className="w-10 h-10 text-orange-500" /></div>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter text-white uppercase">Требуется <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-rose-500">Авторизация</span></h1>
            <p className="text-slate-400 text-sm md:text-base max-w-sm mx-auto">Для доступа к PvP арене необходимо войти в аккаунт</p>
            <button onClick={() => setShowAuthModal(true)} className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-black hover:bg-zinc-200 font-bold text-lg rounded-xl shadow-lg shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"><LogIn className="w-5 h-5" />Войти в аккаунт</button>
          </div>
        </div>
      )}

      {!sessionLoading && !user && <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />}

      <div className={`container mx-auto px-4 sm:px-6 relative z-10 ${battleState === "idle" ? "py-8 lg:py-12 max-w-[1400px]" : "py-1 sm:py-2.5 max-w-full"}`} style={{ display: !sessionLoading && !user && battleState === "idle" ? "none" : "block" }}>
        {battleState === "idle" && (
          <div className="text-center mb-6 lg:mb-8">
            <div className="inline-flex items-center justify-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-md mb-3 shadow-xl">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span></span>
              <span className="text-[10px] font-bold tracking-widest text-slate-300 uppercase">Арена</span>
            </div>
            <div className="flex items-center justify-center gap-3 mb-3">
              <h1 className="text-2xl md:text-4xl lg:text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 uppercase drop-shadow-sm">Битвы <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500">PvP</span></h1>
              <button onClick={handleSharePage} className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors border border-white/10" title="Поделиться"><Share className="w-5 h-5" /></button>
            </div>
            <p className="mt-2 text-slate-400 text-xs md:text-sm max-w-xl mx-auto font-medium">Собери колоду, сочетай КНБ роли и сражайся с реальными игроками на 3-х линиях!</p>
            <button onClick={() => router.push("/gacha")} className="mt-4 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 hover:border-indigo-500/40 font-bold text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"><Sparkles className="w-4 h-4" />Перейти в Гачу</button>
          </div>
        )}

        {battleState === "idle" && (battleSessionLoading || !progress ? <StatsPanelSkeleton /> : <StatsPanel progress={progress} userCoins={userCoins} coinsLoading={coinsLoading} dust={dust} dustLoading={dustLoading} staminaTime={staminaTime} />)}

        {battleState === "idle" && !isInitializing && !progress && user && (
          <div className="max-w-md mx-auto p-8 rounded-3xl bg-red-500/5 border border-red-500/20 text-center">
            <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-200 text-sm font-medium mb-4">Не удалось загрузить данные боя.</p>
            <button onClick={() => { setError(null); setRetryCount(c => c + 1) }} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white border border-white/10 font-bold text-sm transition-all"><RefreshCcw className="w-4 h-4" />Повторить загрузку</button>
          </div>
        )}

        {error && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 max-w-md mx-auto p-4 rounded-2xl bg-red-500/10 backdrop-blur-md border border-red-500/20 shadow-lg shadow-red-500/10 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-200 text-sm font-medium flex-1">{error}</p>
            <button onClick={() => setError(null)} className="p-1 rounded-md hover:bg-white/10 transition-colors"><X className="w-4 h-4 text-red-400" /></button>
          </div>
        )}

        {battleState === "loading" && (
          <div className={"max-w-md mx-auto p-12 rounded-3xl " + glassCard + " flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95"}>
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 border-4 border-purple-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
              <Swords className="absolute inset-0 m-auto w-8 h-8 text-purple-400 animate-pulse" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">Подключение к PvP Матчу</h3>
            <p className="text-sm text-slate-400">Синхронизация с противником и подготовка арены...</p>
          </div>
        )}

        {battleState === "battle" && (
          <BattleArena
            ccgState={ccgState} placedThisRound={placedThisRound} aiPlacedThisRound={aiPlacedThisRound} isRoundConfirmed={isRoundConfirmed}
            playCardToZone={playCardToZone} recallCard={recallCard} reorganizeHand={reorganizeHand} moveCardBetweenZones={moveCardBetweenZones}
            confirmRoundPlacement={confirmRoundPlacement} nextRound={nextRound} updateScores={updateScores}
            finishBattle={finishBattle} setBattleState={setBattleState}
            deckContext={{ deck: selectedCards, leaderId, formation }} opponentDeckContext={opponentDeckContext}
            onCardEffect={triggerCardEffect} onCardDestroy={triggerCardDestruction} onModifierActivate={triggerModifierActivation} onFloatingText={addFloatingText}
            isPvPMode={isPvPMode} pvpMatchId={pvpState.matchData?.matchId} placeCards={placeCards} aiThinking={aiThinking}
          />
        )}

        {battleState === "result" && (
          <BattleResultView ccgState={ccgState} finishBattle={finishBattle} closeBattleResult={closeBattleResult} isFinishing={isFinishing} isPvP={isPvPMode} mmrChange={isPvPMode ? pvpState.mmrChange : null} />
        )}

        {battleState === "idle" && (
          <div className="flex flex-col gap-4 pb-6 lg:items-center">
            <div className="w-full max-w-md lg:max-w-none">
              {sessionLoading || !progress ? <SelectedTeamPanelSkeleton /> : (
                <SelectedTeamPanel
                  selectedCards={selectedCards} toggleCardSelection={toggleCardSelection} setShowTeamBuilder={setShowTeamBuilder}
                  selectedDungeon={null} enemies={[]} teamPower={teamPower} progress={progress}
                  startBattle={() => setShowPvPArena(true)} logs={logs}
                  leaderId={leaderId} setLeaderId={setLeaderId} formation={formation} setFormation={setFormation}
                  onCardClick={handleCardClick} onOpenLocationSelector={() => setShowPvPArena(true)} onAutoBuild={handleAutoBuildRequest}
                  isPvPOnly
                />
              )}
            </div>
          </div>
        )}
      </div>

      {battleState === "idle" && <Footer />}

      {/* PvPArena Modal */}
      {showPvPArena && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0b14]/95 border border-white/10 rounded-3xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => { if (pvpState.status !== 'in_queue' && pvpState.status !== 'connecting') setShowPvPArena(false) }}
              className={`absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 text-slate-400 hover:text-white transition-colors border border-white/10 ${pvpState.status === 'in_queue' || pvpState.status === 'connecting' ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={pvpState.status === 'in_queue' || pvpState.status === 'connecting'}>
              <X className="w-5 h-5" />
            </button>
            <PvPArena selectedCards={selectedCards} leaderId={leaderId} formation={formation}
              onClose={() => { if (pvpState.status !== 'in_queue' && pvpState.status !== 'connecting') setShowPvPArena(false) }}
              pvpState={pvpState} joinQueue={joinQueue} leaveQueue={leaveQueue} isConnected={isConnected} onShowLeaderboard={() => setShowLeaderboard(true)}
            />
          </div>
        </div>
      )}

      {/* Leaderboard Modal */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#0b0b14]/95 border border-white/10 rounded-3xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
            <button onClick={() => setShowLeaderboard(false)} className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/5 text-slate-400 hover:text-white transition-colors border border-white/10"><X className="w-5 h-5" /></button>
            <Leaderboard onClose={() => setShowLeaderboard(false)} />
          </div>
        </div>
      )}

      {/* Team Builder Modal */}
      <TeamBuilderModal showTeamBuilder={showTeamBuilder} setShowTeamBuilder={setShowTeamBuilder} selectedCards={selectedCards} toggleCardSelection={toggleCardSelection}
        teamSearch={teamSearch} setTeamSearch={setTeamSearch} selectedRole={selectedRole} setSelectedRole={setSelectedRole} sortBy={sortBy} setSortBy={setSortBy}
        filteredCards={filteredCards} leaderId={leaderId} setLeaderId={setLeaderId} activeSynergies={activeSynergies} onCardClick={handleCardClick} onAutoBuild={handleAutoBuildRequest}
      />

      {/* Auto-build confirmation modal */}
      <AutoBuildConfirmModal isOpen={showAutoBuildConfirm} onClose={() => setShowAutoBuildConfirm(false)} selectedCards={selectedCards} onConfirm={handleAutoBuildConfirm} />

      {/* Viewed Card Modal */}
      {viewedCard && (
        <div className="fixed inset-0 z-[120] flex flex-col items-center justify-center p-4 sm:p-6 bg-slate-950/90 backdrop-blur-xl animate-in fade-in duration-200 overflow-y-auto" onClick={() => setViewedCard(null)}>
          <button onClick={() => setViewedCard(null)} className="fixed top-4 right-4 sm:top-6 sm:right-6 p-2.5 sm:p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors border border-white/10 z-[130] shadow-xl backdrop-blur-md"><X className="w-5 h-5 sm:w-6 sm:h-6" /></button>
          <div className="flex flex-col items-center justify-center min-h-full py-12 w-full" onClick={(e) => e.stopPropagation()}>
            <InteractiveCard card={viewedCard} />
          </div>
        </div>
      )}

      {showBattleTutorial && battleState === "idle" && <GachaTutorial onComplete={handleBattleTutorialComplete} tutorialType="battle" />}
    </div>
  )
}