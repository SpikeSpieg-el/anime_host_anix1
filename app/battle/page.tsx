"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Navbar } from "@/components/navbar"
import { useAuth } from "@/components/auth-provider"
import { useCoins } from "@/hooks/use-coins"
import { useDust } from "@/hooks/use-dust"
import { Rarity, rarityConfig } from "@/types/gacha"
import { calculateTeamPower, calculateEnemyTeamPower, getCardPower, type BattleResult } from "@/lib/battle-engine"
import {
  Swords, Shield, Zap, Crown, Star, Coins, Sparkles,
  Heart, Target, Skull, Trophy, ChevronRight, Loader2,
  Swords as SwordsIcon, ShieldHalf, ArrowRight, X,
  Flame, Mountain, Waves, Castle, FlameKindling,
  Timer, AlertCircle, CheckCircle2, XCircle, RotateCcw,
  Info
} from "lucide-react"

// ==========================================
// TYPES
// ==========================================

interface Card {
  uniqueId: string
  name: string
  anime: string
  rarity: Rarity
  imageUrl: string
  stats: { hp: number; atk: number; def: number; spd: number; luck: number }
  isMainCharacter?: boolean
  score?: number
}

interface Dungeon {
  id: string
  name: string
  name_ru: string
  description?: string
  theme: string
  difficulty: number
  required_level: number
  energy_cost: number
  coins_reward_base: number
  dust_reward_base: number
  xp_reward_base: number
  image_url?: string
  enemy_ids?: string[]
  is_daily?: boolean
}

interface Enemy {
  id: string
  name: string
  name_ru: string
  anime?: string
  image_url?: string
  level: number
  tier: "normal" | "elite" | "boss" | "legendary"
  stats_hp: number
  stats_atk: number
  stats_def: number
  stats_spd: number
  stats_luck: number
  special_ability?: string
  special_desc?: string
}

interface BattleProgress {
  level: number
  xp: number
  xp_to_next: number
  current_stamina: number
  max_stamina: number
  total_battles: number
  total_wins: number
  total_losses: number
  highest_dungeon_cleared: number
  daily_battles_today: number
  staminaRefillMs?: number
}

interface BattleLog {
  id: string
  result: "win" | "loss"
  coins_earned: number
  dust_earned: number
  xp_earned: number
  battle_turns: number
  created_at: string
  battle_data?: {
    mvp?: { name: string; totalDamageDealt: number; anime: string }
  }
}

// ==========================================
// THEME CONFIG
// ==========================================

const THEME_CONFIG: Record<string, { icon: typeof Flame; color: string; bg: string; border: string; gradient: string }> = {
  dark_forest: { icon: Mountain, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20", gradient: "from-emerald-900/20 to-transparent" },
  volcano: { icon: Flame, color: "text-orange-400", bg: "bg-orange-500/10", border: "border-orange-500/20", gradient: "from-red-900/20 to-transparent" },
  ocean: { icon: Waves, color: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20", gradient: "from-blue-900/20 to-transparent" },
  sky_castle: { icon: Castle, color: "text-violet-400", bg: "bg-violet-500/10", border: "border-violet-500/20", gradient: "from-purple-900/20 to-transparent" },
  demon_realm: { icon: FlameKindling, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", gradient: "from-red-950/30 to-transparent" },
  tournament: { icon: Swords, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", gradient: "from-amber-900/20 to-transparent" },
  daily: { icon: Timer, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", gradient: "from-blue-900/20 to-transparent" },
  boss_raid: { icon: Skull, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20", gradient: "from-rose-950/30 to-transparent" },
}

const TIER_CONFIG: Record<string, { color: string; label: string; bg: string }> = {
  normal: { color: "text-slate-300", label: "Обычный", bg: "bg-slate-800/80" },
  elite: { color: "text-blue-300", label: "Элитный", bg: "bg-blue-900/80" },
  boss: { color: "text-purple-300", label: "Босс", bg: "bg-purple-900/80" },
  legendary: { color: "text-amber-300", label: "Легендарный", bg: "bg-amber-900/80" },
}

// Утилита для Glassmorphism
const glassCard = "bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)]"
const glassButton = "bg-white/[0.05] hover:bg-white/[0.1] backdrop-blur-md border border-white/10 transition-all duration-300 active:scale-95"

// ==========================================
// MAIN PAGE
// ==========================================

export default function BattlePage() {
  const { user, session, sessionLoading } = useAuth()
  const { coins: userCoins, addCoins, refresh: refreshCoins } = useCoins()
  const { dust, addDust } = useDust()

  const [progress, setProgress] = useState<BattleProgress | null>(null)
  const [dungeons, setDungeons] = useState<Dungeon[]>([])
  const [enemies, setEnemies] = useState<Enemy[]>([])
  const [logs, setLogs] = useState<BattleLog[]>([])

  const [collectedCards, setCollectedCards] = useState<Card[]>([])
  const [selectedCards, setSelectedCards] = useState<Card[]>([])
  const [selectedDungeon, setSelectedDungeon] = useState<Dungeon | null>(null)

  const [battleState, setBattleState] = useState<"idle" | "loading" | "battle" | "result">("idle")
  const [battleResult, setBattleResult] = useState<BattleResult | null>(null)
  const [battleActionIndex, setBattleActionIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  const [battleSpeed, setBattleSpeed] = useState<1 | 2>(1)

  const [showTeamBuilder, setShowTeamBuilder] = useState(false)
  const [teamSearch, setTeamSearch] = useState("")
  const [sortBy, setSortBy] = useState<"power" | "rarity" | "hp" | "atk">("power")

  const [error, setError] = useState<string | null>(null)
  const isLoadingRef = useRef(false)

  // ==========================================
  // LOAD DATA
  // ==========================================

  const loadBattleData = useCallback(async () => {
    if (!user || isLoadingRef.current) return
    isLoadingRef.current = true
    
    try {
      const accessToken = session?.access_token
      if (!accessToken) return
      console.log('[BattlePage] Loading battle data...')
      const res = await fetch('/api/battle?mode=all', { headers: { 'Authorization': `Bearer ${accessToken}` } })
      if (res.ok) {
        const data = await res.json()
        console.log('[BattlePage] Dungeons count:', data.dungeons?.length || 0)
        
        setProgress(data.progress)
        setDungeons(data.dungeons || [])
        setEnemies(data.enemies)
        setLogs(data.logs || [])

        if (data.progress && data.dungeons) {
          const today = new Date().toISOString().split('T')[0]
          const dailyDungeonId = 'daily-' + today
          const dailyDungeon = data.dungeons.find((d: any) => d.id === dailyDungeonId)
          if (dailyDungeon) {
            const todayWinLog = data.logs?.find((log: any) => log.dungeon_id === dailyDungeonId && log.result === 'win')
            setProgress(prev => prev ? { ...prev, daily_battles_today: todayWinLog ? 1 : 0 } : null)
          }
        }
        console.log('[BattlePage] Battle data loaded successfully')
      }
    } catch (err) {
      console.error('[BattlePage] Error loading battle data:', err)
    } finally {
      isLoadingRef.current = false
    }
  }, [user, session])

  const loadUserCards = useCallback(async () => {
    if (!user) return
    try {
      const { supabase } = await import("@/lib/supabase")
      // Use RPC to exclude cards that are listed on market
      const { data, error } = await supabase.rpc('get_battle_available_cards', {
        p_user_id: user.id
      })

      if (!error && data) {
        setCollectedCards(data.map((c: any) => ({
          uniqueId: c.unique_id, name: c.name, anime: c.anime, rarity: c.rarity, imageUrl: c.image_url,
          stats: { hp: c.stats_hp, atk: c.stats_atk, def: c.stats_def, spd: c.stats_spd, luck: c.stats_luck },
          isMainCharacter: c.is_main_character || false, score: c.score,
        })))
      } else {
        // Fallback to regular query if RPC doesn't exist
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('user_cards')
          .select('unique_id, name, anime, rarity, image_url, stats_hp, stats_atk, stats_def, stats_spd, stats_luck, is_main_character, score')

        if (!fallbackError && fallbackData) {
          setCollectedCards(fallbackData.map((c: any) => ({
            uniqueId: c.unique_id, name: c.name, anime: c.anime, rarity: c.rarity, imageUrl: c.image_url,
            stats: { hp: c.stats_hp, atk: c.stats_atk, def: c.stats_def, spd: c.stats_spd, luck: c.stats_luck },
            isMainCharacter: c.is_main_character || false, score: c.score,
          })))
        }
      }
    } catch (err) {
      console.error('[BattlePage] Error loading cards:', err)
    }
  }, [user])

  useEffect(() => {
    if (user && !sessionLoading) { 
      loadBattleData(); 
      loadUserCards()
      // Reset battle state on page load to prevent showing old results
      setBattleState("idle")
      setBattleResult(null)
      setBattleActionIndex(0)
      setIsAutoPlaying(false)
    }
  }, [user, sessionLoading])

  useEffect(() => {
    if (!isAutoPlaying || !battleResult) return
    const speedMs = battleSpeed === 1 ? 1200 : 500
    const timer = setInterval(() => {
      setBattleActionIndex(prev => {
        if (prev >= battleResult.actions.length - 1) {
          setIsAutoPlaying(false); setBattleState("result"); return prev
        }
        return prev + 1
      })
    }, speedMs)
    return () => clearInterval(timer)
  }, [isAutoPlaying, battleResult, battleSpeed])

  // ==========================================
  // TEAM SELECTION
  // ==========================================

  const toggleCardSelection = (card: Card) => {
    setSelectedCards(prev => {
      if (prev.some(c => c.uniqueId === card.uniqueId)) return prev.filter(c => c.uniqueId !== card.uniqueId)
      if (prev.length >= 3) return prev
      return [...prev, card]
    })
  }

  const teamPower = calculateTeamPower(selectedCards)

  const filteredCards = collectedCards
    .filter(c => !teamSearch.trim() || c.name.toLowerCase().includes(teamSearch.toLowerCase()) || c.anime.toLowerCase().includes(teamSearch.toLowerCase()))
    .sort((a, b) => {
      const getP = (c: Card) => c.stats.hp + c.stats.atk * 2 + c.stats.def + c.stats.spd + c.stats.luck
      switch (sortBy) {
        case "power": return getP(b) - getP(a)
        case "rarity":
          const r = ["trash", "common", "uncommon", "rare", "super_rare", "epic", "mythic", "legendary", "ancient", "divine", "transcendent", "omnipotent"]
          return r.indexOf(a.rarity) - r.indexOf(b.rarity)
        case "hp": return b.stats.hp - a.stats.hp
        case "atk": return b.stats.atk - a.stats.atk
        default: return 0
      }
    })

  const getDungeonEnemyPower = (dungeon: Dungeon) => {
    let dungeonEnemies: Enemy[] = []
    if (dungeon.enemy_ids && dungeon.enemy_ids.length > 0) {
      dungeonEnemies = enemies.filter(enemy => dungeon.enemy_ids!.includes(enemy.id))
    } else {
      const map: Record<string, number> = { normal: 1, elite: 3, boss: 5, legendary: 7 }
      const appropriate = enemies.filter(e => Math.abs((map[e.tier] || 1) - dungeon.difficulty) <= 1)
      const count = Math.min(3, Math.max(1, Math.ceil(dungeon.difficulty / 2)))
      dungeonEnemies = appropriate.sort(() => Math.random() - 0.5).slice(0, count)
    }
    if (dungeonEnemies.length === 0) return { totalPower: 0, avgPower: 0, rating: "F", ratingColor: "from-stone-500 to-stone-700" }

    const mapped = dungeonEnemies.map(e => ({
      id: e.id, name: e.name, nameRu: e.name_ru, anime: e.anime, imageUrl: e.image_url, level: e.level, tier: e.tier,
      stats: { hp: e.stats_hp, atk: e.stats_atk, def: e.stats_def, spd: e.stats_spd, luck: e.stats_luck },
      specialAbility: e.special_ability, specialDesc: e.special_desc,
    }))
    return calculateEnemyTeamPower(mapped)
  }

  // ==========================================
  // ACTIONS
  // ==========================================

  const startBattle = async () => {
    if (selectedCards.length === 0 || !selectedDungeon) return setError("Выберите карты и подземелье!")
    setError(null); setBattleState("loading"); setBattleActionIndex(0); setIsAutoPlaying(false); setBattleResult(null)

    try {
      const token = session?.access_token
      if (!token) return setError("Необходима авторизация")

      const res = await fetch('/api/battle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          action: 'start_battle',
          dungeonId: selectedDungeon.id,
          playerCards: selectedCards.map(c => ({
            uniqueId: c.uniqueId, name: c.name, anime: c.anime, rarity: c.rarity, imageUrl: c.imageUrl,
            stats: { hp: c.stats.hp, atk: c.stats.atk, def: c.stats.def, spd: c.stats.spd, luck: c.stats.luck },
            isMainCharacter: c.isMainCharacter,
          })),
        }),
      })

      const data = await res.json()
      if (!res.ok) { setError(data.message || "Ошибка боя"); setBattleState("idle"); setBattleResult(null); setBattleActionIndex(0); setIsAutoPlaying(false); return }
      if (data.success) {
        setBattleResult(data.battle)
        setBattleState("battle")
        setTimeout(() => setIsAutoPlaying(true), 1500)
      }
    } catch (err) {
      setError("Ошибка соединения"); setBattleState("idle"); setBattleResult(null); setBattleActionIndex(0); setIsAutoPlaying(false)
    }
  }

  const finishBattle = async () => {
    if (battleResult?.victory) { await refreshCoins(); await loadBattleData() }
    setBattleState("idle"); setBattleResult(null); setBattleActionIndex(0); setIsAutoPlaying(false)
  }

  const currentAction = battleResult?.actions[battleActionIndex]

  const [staminaTime, setStaminaTime] = useState("")
  useEffect(() => {
    if (!progress?.staminaRefillMs || progress.current_stamina >= progress.max_stamina) { setStaminaTime("Полная"); return }
    const update = () => {
      const ms = progress.staminaRefillMs || 0
      const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000)
      setStaminaTime(`${m}:${s.toString().padStart(2, "0")}`)
    }
    update(); const t = setInterval(update, 1000); return () => clearInterval(t)
  }, [progress])

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="min-h-screen bg-[#05050A] relative text-slate-100 font-sans pb-24 overflow-x-hidden selection:bg-indigo-500/30">
      
      {/* Мягкий космический / стеклянный фон */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-900/20 blur-[120px] animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-rose-900/10 blur-[120px] animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute top-[30%] left-[50%] w-[30vw] h-[30vw] rounded-full bg-blue-900/10 blur-[100px]" />
        {/* Паттерн точек для текстуры */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50" />
      </div>

      <Navbar />

      <div className="container mx-auto px-4 sm:px-6 py-8 lg:py-12 max-w-[1400px] relative z-10">
        
        {/* Заголовок */}
        <div className="text-center mb-10 lg:mb-14">
          <div className="inline-flex items-center justify-center gap-3 px-4 py-1.5 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-md mb-6 shadow-2xl">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <span className="text-xs font-bold tracking-widest text-slate-300 uppercase">Режим Арены</span>
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-br from-white via-slate-200 to-slate-500 uppercase drop-shadow-sm">
            Битвы <span className="text-transparent bg-clip-text bg-gradient-to-r from-rose-400 to-orange-500">PVE</span>
          </h1>
          <p className="mt-4 text-slate-400 text-sm md:text-base max-w-2xl mx-auto font-medium">
            Собери сильнейший отряд, покоряй опасные подземелья и добывай монеты для призыва новых героев.
          </p>
        </div>

        {/* Плавающая панель статистики (Glass) */}
        {progress && (
          <div className="flex overflow-x-auto pb-4 md:pb-0 mb-8 md:mb-12 snap-x scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:justify-center gap-3">
            
            <div className={`shrink-0 snap-center flex flex-col justify-center px-5 py-3 rounded-2xl ${glassCard} min-w-[140px]`}>
              <div className="flex items-center gap-2 mb-1.5 text-slate-400">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Уровень</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-2xl font-black text-white">{progress.level}</span>
              </div>
              <div className="w-full h-1.5 bg-black/50 rounded-full mt-2 overflow-hidden border border-white/5">
                <div className="h-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${Math.min(100, (progress.xp / progress.xp_to_next) * 100)}%` }} />
              </div>
            </div>

            <div className={`shrink-0 snap-center flex flex-col justify-center px-5 py-3 rounded-2xl ${glassCard} min-w-[140px]`}>
              <div className="flex items-center gap-2 mb-1.5 text-slate-400">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Энергия</span>
              </div>
              <div className="flex items-end gap-2">
                <span className="text-2xl font-black text-yellow-400">{progress.current_stamina}</span>
                <span className="text-sm font-bold text-slate-500 mb-1">/ {progress.max_stamina}</span>
              </div>
              {progress.current_stamina < progress.max_stamina && (
                <span className="text-[10px] text-yellow-500/70 font-mono mt-1">{staminaTime}</span>
              )}
            </div>

            <div className={`shrink-0 snap-center flex flex-col justify-center px-5 py-3 rounded-2xl ${glassCard} min-w-[140px]`}>
              <div className="flex items-center gap-2 mb-1.5 text-slate-400">
                <Coins className="w-4 h-4 text-yellow-500" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Монеты</span>
              </div>
              <span className="text-2xl font-black text-white">{userCoins.toLocaleString()}</span>
            </div>

            <div className={`shrink-0 snap-center flex flex-col justify-center px-5 py-3 rounded-2xl ${glassCard} min-w-[140px]`}>
              <div className="flex items-center gap-2 mb-1.5 text-slate-400">
                <Timer className="w-4 h-4 text-blue-400" />
                <span className="text-[10px] font-bold uppercase tracking-widest">Дейлики</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl font-black text-blue-400">{progress.daily_battles_today}</span>
                <span className="text-sm font-bold text-slate-500 mb-1">/ 1</span>
              </div>
            </div>

          </div>
        )}

        {/* Уведомление об ошибке */}
        {error && (
          <div className="max-w-md mx-auto mb-8 p-4 rounded-2xl bg-red-500/10 backdrop-blur-md border border-red-500/20 shadow-lg shadow-red-500/10 flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
            <p className="text-red-200 text-sm font-medium flex-1">{error}</p>
            <button onClick={() => setError(null)} className="p-1 rounded-md hover:bg-white/10 transition-colors">
              <X className="w-4 h-4 text-red-400" />
            </button>
          </div>
        )}

        {/* ==========================================
            СОСТОЯНИЕ ЗАГРУЗКИ БОЯ
        ========================================== */}
        {battleState === "loading" && (
          <div className={`max-w-md mx-auto p-12 rounded-3xl ${glassCard} flex flex-col items-center justify-center text-center animate-in fade-in zoom-in-95`}>
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 border-4 border-rose-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
              <Swords className="absolute inset-0 m-auto w-8 h-8 text-rose-400 animate-pulse" />
            </div>
            <h3 className="text-xl font-black text-white uppercase tracking-wider mb-2">Синхронизация Арены</h3>
            <p className="text-sm text-slate-400">Подготовка противников и расчет вероятностей...</p>
          </div>
        )}

        {/* ==========================================
            ЭКРАН БОЯ (АНИМАЦИЯ)
        ========================================== */}
        {battleState === "battle" && battleResult && (
          <div className={`w-full max-w-6xl mx-auto rounded-3xl ${glassCard} overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col`}>
            
            {/* Панель управления боем */}
            <div className="bg-white/[0.02] border-b border-white/5 p-4 flex flex-wrap gap-4 items-center justify-between backdrop-blur-md relative z-20">
              <div className="flex items-center gap-4">
                <div className="px-4 py-1.5 rounded-full bg-black/40 border border-white/10 shadow-inner">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Ход</span>
                  <span className="text-sm font-black text-white">{battleActionIndex + 1}</span>
                  <span className="text-xs text-slate-500 ml-1">/ {battleResult.actions.length}</span>
                </div>
                <button
                  onClick={() => setBattleSpeed(prev => prev === 1 ? 2 : 1)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all border ${
                    battleSpeed === 2 
                      ? "bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]" 
                      : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
                  }`}
                >
                  Ускорение x{battleSpeed}
                </button>
              </div>
              <button
                onClick={() => { setIsAutoPlaying(false); setBattleState("result") }}
                className="text-xs px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl transition-all flex items-center gap-2 font-medium"
              >
                Пропустить <ArrowRight className="w-3 h-3" />
              </button>
            </div>

            {/* Боевая Арена */}
            <div className="p-6 md:p-10 relative flex flex-col lg:grid lg:grid-cols-3 gap-8 lg:gap-12 bg-gradient-to-b from-transparent to-black/40">
              
              {/* === ИГРОК (Лево / Низ на моб) === */}
              <div className="order-3 lg:order-1 flex flex-col gap-4">
                <div className="text-center lg:text-left">
                  <span className="inline-flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
                    <Shield className="w-3 h-3" /> Твой отряд
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {battleResult.playerUnits.map((unit, i) => {
                    const card = selectedCards[i]
                    const isAttacker = currentAction?.attackerId === unit.uniqueId
                    const isTarget = currentAction?.defenderId === unit.uniqueId && !currentAction.isPlayerAttack
                    const hpPercent = Math.max(0, (unit.hpRemaining / unit.maxHp) * 100)
                    const isDead = unit.hpRemaining <= 0

                    return (
                      <div key={unit.uniqueId} className={`relative rounded-2xl p-3 flex items-center gap-4 transition-all duration-300 ${
                        isDead ? "opacity-40 grayscale bg-black/40 border border-white/5" :
                        isAttacker ? "scale-[1.02] bg-indigo-900/30 border border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.2)] lg:translate-x-4" :
                        isTarget ? "bg-rose-900/20 border border-rose-500/40 lg:-translate-x-2" :
                        "bg-white/[0.03] border border-white/10"
                      }`}>
                        <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10">
                          <img src={card?.imageUrl} className="w-full h-full object-cover" alt={unit.name} />
                          {isDead && <div className="absolute inset-0 bg-red-950/80 flex items-center justify-center"><Skull className="w-6 h-6 text-red-500" /></div>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-black text-white truncate drop-shadow-md">{unit.name}</div>
                          <div className="text-[10px] text-indigo-300 font-bold mb-2">Ур. {progress?.level || 1}</div>
                          {/* Неоновый HP бар */}
                          <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                            <div className={`h-full transition-all duration-500 shadow-[0_0_10px_currentColor] ${
                              hpPercent > 50 ? "bg-emerald-400 text-emerald-400" : hpPercent > 25 ? "bg-amber-400 text-amber-400" : "bg-rose-500 text-rose-500"
                            }`} style={{ width: `${hpPercent}%` }} />
                          </div>
                          <div className="text-[9px] font-mono text-slate-400 mt-1 text-right">{Math.max(0, unit.hpRemaining)} / {unit.maxHp}</div>
                        </div>
                        {isTarget && currentAction?.damage > 0 && (
                          <div className="absolute -right-2 lg:-right-6 top-1/2 -translate-y-1/2 text-xl font-black text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-in slide-in-from-top-4 fade-in duration-300">
                            -{currentAction.damage}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* === ЦЕНТР: ДЕЙСТВИЕ === */}
              <div className="order-2 lg:order-2 flex items-center justify-center min-h-[250px] relative z-10">
                {currentAction ? (
                  <div className="w-full max-w-sm relative flex flex-col items-center text-center p-6 lg:p-8 rounded-[2rem] bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl">
                    <div className={`absolute inset-0 rounded-[2rem] opacity-20 transition-all duration-500 ${
                      currentAction.isPlayerAttack ? "bg-gradient-to-r from-indigo-500 to-transparent" : "bg-gradient-to-l from-rose-500 to-transparent"
                    }`} />
                    
                    <div className="relative z-10 w-full flex flex-col items-center">
                      <div className={`text-xs font-black uppercase tracking-widest mb-1 ${currentAction.isPlayerAttack ? "text-indigo-400" : "text-rose-400"}`}>
                        {currentAction.attackerName}
                      </div>
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-300 bg-white/5 px-3 py-1 rounded-full mb-6 border border-white/5">
                        <SwordsIcon className="w-3 h-3 text-slate-400" />
                        {currentAction.abilityUsed || "Базовая атака"}
                      </div>

                      <div className="h-24 flex items-center justify-center mb-4">
                        {currentAction.isDodged ? (
                          <div className="animate-in zoom-in duration-300 flex flex-col items-center">
                            <span className="text-3xl mb-1">💨</span>
                            <span className="text-xl font-black text-slate-400 uppercase tracking-widest drop-shadow-lg">Промах</span>
                          </div>
                        ) : (
                          <div className="animate-in zoom-in scale-110 duration-300 flex flex-col items-center">
                            <span className={`text-5xl lg:text-6xl font-black drop-shadow-[0_0_20px_currentColor] ${
                              currentAction.isPlayerAttack ? "text-white" : "text-rose-500"
                            }`}>
                              -{currentAction.damage}
                            </span>
                            {currentAction.isCritical && (
                              <span className="text-xs font-black text-amber-400 uppercase tracking-widest mt-2 animate-pulse drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                Критический!
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="w-full pt-4 border-t border-white/10 flex flex-col items-center">
                        <span className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Цель</span>
                        <span className={`text-sm font-black truncate max-w-full ${currentAction.isPlayerAttack ? "text-rose-400" : "text-indigo-400"}`}>
                          {currentAction.defenderName}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-slate-600 font-black text-xl uppercase tracking-widest animate-pulse">Анализ...</div>
                )}
              </div>

              {/* === ВРАГ (Право / Верх на моб) === */}
              <div className="order-1 lg:order-3 flex flex-col gap-4">
                <div className="text-center lg:text-right">
                  <span className="inline-flex items-center gap-2 text-[10px] font-black text-rose-400 uppercase tracking-widest bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
                    Враги <Skull className="w-3 h-3" />
                  </span>
                </div>
                <div className="flex flex-col gap-3">
                  {battleResult.enemyUnits.map((unit, i) => {
                    const enemy = enemies[i]
                    const isAttacker = currentAction?.attackerId === unit.uniqueId
                    const isTarget = currentAction?.defenderId === unit.uniqueId && currentAction.isPlayerAttack
                    const hpPercent = Math.max(0, (unit.hpRemaining / unit.maxHp) * 100)
                    const isDead = unit.hpRemaining <= 0

                    return (
                      <div key={unit.uniqueId} className={`relative rounded-2xl p-3 flex flex-row-reverse lg:flex-row items-center gap-4 transition-all duration-300 ${
                        isDead ? "opacity-40 grayscale bg-black/40 border border-white/5" :
                        isAttacker ? "scale-[1.02] bg-rose-900/30 border border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.2)] lg:-translate-x-4" :
                        isTarget ? "bg-indigo-900/20 border border-indigo-500/40 lg:translate-x-2" :
                        "bg-white/[0.03] border border-white/10"
                      }`}>
                        <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black">
                          {enemy?.image_url ? <img src={enemy.image_url} className="w-full h-full object-cover" alt={unit.name} /> : <div className="w-full h-full flex items-center justify-center text-2xl">👹</div>}
                          {isDead && <div className="absolute inset-0 bg-red-950/80 flex items-center justify-center"><Skull className="w-6 h-6 text-red-500" /></div>}
                        </div>
                        <div className="flex-1 min-w-0 text-right lg:text-left">
                          <div className="text-sm font-black text-white truncate drop-shadow-md">{unit.name}</div>
                          <div className="text-[10px] text-rose-400 font-bold mb-2">Ур. {enemy?.level || 1}</div>
                          <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5 transform rotate-180 lg:rotate-0">
                            <div className={`h-full transition-all duration-500 shadow-[0_0_10px_currentColor] ${
                              hpPercent > 50 ? "bg-rose-500 text-rose-500" : hpPercent > 25 ? "bg-orange-500 text-orange-500" : "bg-red-700 text-red-700"
                            }`} style={{ width: `${hpPercent}%` }} />
                          </div>
                          <div className="text-[9px] font-mono text-slate-400 mt-1 text-left lg:text-right">{Math.max(0, unit.hpRemaining)} / {unit.maxHp}</div>
                        </div>
                        {isTarget && currentAction?.damage > 0 && (
                          <div className="absolute -left-2 lg:-left-6 top-1/2 -translate-y-1/2 text-xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-in slide-in-from-top-4 fade-in duration-300">
                            -{currentAction.damage}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            ЭКРАН РЕЗУЛЬТАТОВ БОЯ
        ========================================== */}
        {battleState === "result" && battleResult && battleResult.actions && battleResult.actions.length > 0 && (
          <div className="max-w-3xl mx-auto relative animate-in fade-in zoom-in-95 duration-700">
            {/* Декоративное свечение позади */}
            <div className={`absolute -inset-4 rounded-3xl blur-2xl opacity-50 ${battleResult.victory ? "bg-emerald-500/20" : "bg-rose-500/20"}`} />
            
            <div className={`relative rounded-3xl p-8 md:p-12 backdrop-blur-2xl border flex flex-col items-center text-center shadow-2xl ${
              battleResult.victory ? "bg-emerald-950/40 border-emerald-500/30" : "bg-rose-950/40 border-rose-500/30"
            }`}>
              
              <div className="mb-8">
                <div className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 shadow-2xl ${
                  battleResult.victory ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/50" : "bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/50"
                }`}>
                  {battleResult.victory ? <Trophy className="w-12 h-12 text-white" /> : <Skull className="w-12 h-12 text-white" />}
                </div>
                <h2 className={`text-4xl md:text-5xl font-black uppercase tracking-widest drop-shadow-lg ${battleResult.victory ? "text-emerald-300" : "text-rose-300"}`}>
                  {battleResult.victory ? "Победа" : "Поражение"}
                </h2>
                <p className="text-slate-400 mt-2 font-medium">Сражение завершено за {battleResult.turns} ходов</p>
              </div>

              {/* Награды */}
              {battleResult.victory && (
                <div className="grid grid-cols-3 gap-3 md:gap-6 w-full max-w-md mb-10">
                  <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/40 border border-yellow-500/20 shadow-inner">
                    <Coins className="w-6 h-6 text-yellow-400 mb-2 drop-shadow-md" />
                    <span className="text-2xl font-black text-yellow-400">+{battleResult.coinsEarned}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold mt-1">Монеты</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/40 border border-amber-500/20 shadow-inner">
                    <Sparkles className="w-6 h-6 text-amber-400 mb-2 drop-shadow-md" />
                    <span className="text-2xl font-black text-amber-400">+{battleResult.dustEarned}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold mt-1">Пыль</span>
                  </div>
                  <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/40 border border-blue-500/20 shadow-inner">
                    <Star className="w-6 h-6 text-blue-400 mb-2 drop-shadow-md" />
                    <span className="text-2xl font-black text-blue-400">+{battleResult.xpEarned}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-bold mt-1">Опыт</span>
                  </div>
                </div>
              )}

              {/* MVP */}
              {battleResult.victory && battleResult.mvpCard && (
                <div className="w-full max-w-md mb-10 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-transparent to-purple-500/10 border border-white/10 backdrop-blur-md">
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Crown className="w-4 h-4 text-amber-400" />
                    <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">MVP Матча</span>
                  </div>
                  <div className="text-xl font-black text-white mb-1">{battleResult.mvpCard.name}</div>
                  <div className="text-sm font-medium text-amber-200 bg-black/30 inline-block px-3 py-1 rounded-full border border-white/5">
                    Нанесено урона: {battleResult.mvpCard.totalDamageDealt.toLocaleString()}
                  </div>
                </div>
              )}

              <button
                onClick={finishBattle}
                className="w-full max-w-sm py-4 bg-white text-black hover:bg-slate-200 font-black uppercase tracking-widest rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2"
              >
                <RotateCcw className="w-5 h-5" />
                Продолжить
              </button>
            </div>
          </div>
        )}

        {/* ==========================================
            ГЛАВНЫЙ ЭКРАН (IDLE)
        ========================================== */}
        {battleState === "idle" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-6 xl:gap-8 items-start">
            
            {/* === ЛЕВАЯ ЧАСТЬ: ПОДЗЕМЕЛЬЯ === */}
            <div className="xl:col-span-8 flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2">
                <h2 className="text-2xl font-black text-white flex items-center gap-3 drop-shadow-sm">
                  <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30"><Mountain className="w-5 h-5" /></span>
                  Выбор Локации
                </h2>
                {selectedDungeon && (
                  <span className="text-xs font-bold text-slate-400 bg-white/5 px-3 py-1.5 rounded-full border border-white/10">
                    Мин. уровень: <span className="text-white">{selectedDungeon.required_level}</span>
                  </span>
                )}
              </div>

              <div className="max-h-[600px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pr-2 max-sm:max-h-[270px]">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-max">
                  {dungeons.slice().map(dungeon => {
                  const theme = THEME_CONFIG[dungeon.theme] || THEME_CONFIG.dark_forest
                  const ThemeIcon = theme.icon
                  const isLocked = progress ? progress.level < dungeon.required_level : true
                  const isSelected = selectedDungeon?.id === dungeon.id
                  const isDaily = dungeon.id?.startsWith('daily-')
                  const isDailyCompleted = isDaily && progress ? progress.daily_battles_today >= 1 : false

                  return (
                    <button
                      key={dungeon.id}
                      onClick={() => !isLocked && !isDailyCompleted && setSelectedDungeon(dungeon)}
                      disabled={isLocked || isDailyCompleted}
                      className={`relative text-left rounded-[1.5rem] p-5 overflow-hidden transition-all duration-300 group ${
                        isLocked || isDailyCompleted
                          ? "opacity-50 cursor-not-allowed bg-black/40 border border-white/5"
                          : isSelected
                            ? `bg-white/[0.05] ring-2 ring-indigo-500 shadow-[0_0_30px_rgba(99,102,241,0.15)] border-transparent scale-[1.02]`
                            : `bg-white/[0.02] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 hover:scale-[1.01]`
                      } backdrop-blur-md`}
                    >
                      {/* Градиентный фон темы */}
                      <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-50`} />
                      
                      {/* Декоративные бейджи */}
                      {isDaily && !isDailyCompleted && (
                        <div className="absolute top-0 right-0 bg-blue-500 text-white text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl shadow-lg z-10">
                          Ежедневное
                        </div>
                      )}
                      {isDailyCompleted && (
                        <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-300 border-b border-l border-emerald-500/30 text-[9px] font-black uppercase px-3 py-1 rounded-bl-xl z-10 flex items-center gap-1 backdrop-blur-md">
                          <CheckCircle2 className="w-3 h-3" /> Пройдено
                        </div>
                      )}

                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`p-2.5 rounded-xl ${theme.bg} ${theme.border} border backdrop-blur-sm shadow-inner`}>
                            <ThemeIcon className={`w-5 h-5 ${theme.color}`} />
                          </div>
                          <div className="flex items-center gap-1.5 bg-black/40 px-2.5 py-1 rounded-lg border border-white/5">
                            <Zap className="w-3.5 h-3.5 text-yellow-400" />
                            <span className="text-xs font-black text-yellow-400">{dungeon.energy_cost}</span>
                          </div>
                        </div>

                        <div className="mb-auto">
                          <h3 className="text-lg font-black text-white mb-1 drop-shadow-md">{dungeon.name_ru}</h3>
                          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2">
                            Уровень угрозы {dungeon.difficulty}
                          </div>
                          {dungeon.description && (
                            <p className="text-xs text-slate-400/80 line-clamp-2 leading-relaxed mb-4">{dungeon.description}</p>
                          )}
                        </div>

                        {/* Награды */}
                        <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5">
                            <Coins className="w-3.5 h-3.5 text-yellow-500" />
                            <span className="text-[10px] font-bold text-slate-300">~{dungeon.coins_reward_base}</span>
                          </div>
                          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5">
                            <Star className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[10px] font-bold text-slate-300">~{dungeon.xp_reward_base}</span>
                          </div>
                          {dungeon.dust_reward_base > 0 && (
                            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/40 border border-white/5">
                              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                              <span className="text-[10px] font-bold text-slate-300">~{dungeon.dust_reward_base}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {isLocked && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-[2px]">
                          <div className="bg-black/80 px-4 py-2 rounded-xl border border-white/10 flex items-center gap-2">
                            <span className="text-lg">🔒</span>
                            <span className="text-xs font-bold text-slate-300">Требуется ур. {dungeon.required_level}</span>
                          </div>
                        </div>
                      )}
                    </button>
                  )}
                )}
              </div>
              </div>
            </div>

            {/* === ПРАВАЯ ЧАСТЬ: КОМАНДА === */}
            <div className="xl:col-span-4 sticky top-24 flex flex-col gap-6">
              
              <div className={`rounded-[2rem] p-6 ${glassCard} flex flex-col`}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black text-white flex items-center gap-2">
                    <Shield className="w-5 h-5 text-indigo-400" />
                    Твой Отряд
                  </h2>
                  <span className={`text-xl font-black bg-gradient-to-r ${teamPower.ratingColor} bg-clip-text text-transparent drop-shadow-md`}>
                    Ранг {teamPower.rating}
                  </span>
                </div>

                {/* Слоты карт */}
                <div className="flex flex-col gap-3 mb-6">
                  {[0, 1, 2].map(slot => {
                    const card = selectedCards[slot]
                    if (!card) {
                      return (
                        <button key={slot} onClick={() => setShowTeamBuilder(true)} className="w-full h-16 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-colors flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 text-sm font-bold group">
                          <span className="group-hover:scale-125 transition-transform">+</span> Выбрать бойца
                        </button>
                      )
                    }

                    return (
                      <div key={card.uniqueId} className={`relative flex items-center gap-3 p-2 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm group overflow-hidden`}>
                        {/* Фон редкости */}
                        <div className={`absolute inset-0 bg-gradient-to-r ${rarityConfig[card.rarity].bg} opacity-10`} />
                        
                        <div className="relative w-12 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-lg">
                          <img src={card.imageUrl} className="w-full h-full object-cover" alt={card.name} />
                          <div className={`absolute top-0 right-0 w-full h-1 bg-gradient-to-r ${rarityConfig[card.rarity].color}`} />
                        </div>
                        
                        <div className="flex-1 min-w-0 relative z-10">
                          <p className="text-sm font-black text-white truncate drop-shadow-sm">{card.name}</p>
                          <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 bg-gradient-to-r ${rarityConfig[card.rarity].color} bg-clip-text text-transparent`}>
                            {rarityConfig[card.rarity].label}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5 text-rose-400" /> {card.stats.hp}</span>
                            <span className="flex items-center gap-0.5"><SwordsIcon className="w-2.5 h-2.5 text-amber-400" /> {card.stats.atk}</span>
                          </div>
                        </div>

                        <button onClick={() => toggleCardSelection(card)} className="relative z-10 w-8 h-8 rounded-full bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors mr-1">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  })}
                </div>

                <button onClick={() => setShowTeamBuilder(true)} className={`w-full py-3 mb-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${glassButton} text-indigo-300`}>
                  <Target className="w-4 h-4" /> Редактировать состав
                </button>

                {/* Сравнение сил */}
                <div className="bg-black/30 rounded-2xl p-4 border border-white/5 space-y-4">
                  <div className="flex items-end justify-between">
                    <div>
                      <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Сила отряда</div>
                      <div className="text-2xl font-black text-white">{teamPower.totalPower.toLocaleString()}</div>
                    </div>
                    {selectedDungeon && (
                      <div className="text-right">
                        <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Сила врага</div>
                        <div className="text-lg font-black text-rose-400">{getDungeonEnemyPower(selectedDungeon).totalPower.toLocaleString()}</div>
                      </div>
                    )}
                  </div>
                  
                  {selectedDungeon && (
                    <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                      <span className="text-xs text-slate-400 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Прогноз</span>
                      <span className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                        teamPower.totalPower >= getDungeonEnemyPower(selectedDungeon).totalPower * 1.2 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        teamPower.totalPower >= getDungeonEnemyPower(selectedDungeon).totalPower ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' :
                        'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                        {teamPower.totalPower >= getDungeonEnemyPower(selectedDungeon).totalPower * 1.2 ? 'Легкая победа' :
                         teamPower.totalPower >= getDungeonEnemyPower(selectedDungeon).totalPower ? 'Равный бой' : 'Высокий риск'}
                      </span>
                    </div>
                  )}
                </div>

                <button
                  onClick={startBattle}
                  disabled={selectedCards.length === 0 || !selectedDungeon || (progress ? progress.current_stamina < (selectedDungeon?.energy_cost || 0) : false)}
                  className="w-full mt-6 py-4 bg-white text-black hover:bg-slate-200 disabled:bg-white/5 disabled:text-slate-500 disabled:cursor-not-allowed font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:shadow-none flex items-center justify-center gap-2"
                >
                  <Swords className="w-5 h-5" />
                  {selectedCards.length === 0 ? "Собери отряд" : !selectedDungeon ? "Выбери цель" : "Начать бой"}
                </button>
              </div>

              {/* История логов */}
              {logs.length > 0 && (
                <div className={`rounded-[2rem] p-6 ${glassCard}`}>
                  <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Сводка операций</h3>
                  <div className="space-y-2">
                    {logs.slice(0, 4).map(log => (
                      <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5">
                        <div className="flex items-center gap-3">
                          <div className={`p-1.5 rounded-lg ${log.result === 'win' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                            {log.result === 'win' ? <Trophy className="w-3.5 h-3.5" /> : <Skull className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-white">{log.result === 'win' ? 'Успешно' : 'Провал'}</div>
                            <div className="text-[10px] text-slate-500">{log.battle_turns} ходов</div>
                          </div>
                        </div>
                        {log.result === "win" && (
                          <div className="text-right">
                            <div className="text-[10px] font-bold text-yellow-400">+{log.coins_earned} 💰</div>
                            <div className="text-[10px] font-bold text-blue-400">+{log.xp_earned} XP</div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ==========================================
          МОДАЛКА: TEAM BUILDER (GLASS)
      ========================================== */}
      {showTeamBuilder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xl animate-in fade-in duration-200" onClick={() => setShowTeamBuilder(false)}>
          <div className="bg-[#0a0a0f]/90 border border-white/10 rounded-[2rem] p-6 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)]" onClick={e => e.stopPropagation()}>
            
            <div className="flex items-center justify-between mb-6 shrink-0">
              <div>
                <h2 className="text-2xl font-black text-white">Казармы</h2>
                <p className="text-sm text-slate-400 mt-1">Выбрано бойцов: <span className="text-indigo-400 font-bold">{selectedCards.length}/3</span></p>
              </div>
              <button onClick={() => setShowTeamBuilder(false)} className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 mb-6 shrink-0">
              <input
                type="text"
                placeholder="Поиск по имени / аниме..."
                value={teamSearch}
                onChange={e => setTeamSearch(e.target.value)}
                className="flex-1 h-12 rounded-xl bg-black/50 border border-white/10 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
              />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="h-12 rounded-xl bg-black/50 border border-white/10 px-4 text-sm text-white focus:outline-none cursor-pointer"
              >
                <option value="power">Сортировка: Сила</option>
                <option value="rarity">Сортировка: Редкость</option>
                <option value="hp">Сортировка: Здоровье</option>
                <option value="atk">Сортировка: Атака</option>
              </select>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1 pb-4">
              {filteredCards.length === 0 && (
                <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
                  <ShieldHalf className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm font-bold">Коллекция пуста или не найдено совпадений</p>
                </div>
              )}
              {filteredCards.map(card => {
                const isSelected = selectedCards.some(c => c.uniqueId === card.uniqueId)
                const power = getCardPower(card)
                return (
                  <button
                    key={card.uniqueId}
                    onClick={() => toggleCardSelection(card)}
                    disabled={!isSelected && selectedCards.length >= 3}
                    className={`relative text-left rounded-2xl p-3 border transition-all duration-200 flex items-center gap-4 ${
                      isSelected
                        ? "bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                        : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                    }`}
                  >
                    <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 shadow-lg">
                      <img src={card.imageUrl} className="w-full h-full object-cover" alt={card.name} />
                      <div className={`absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r ${rarityConfig[card.rarity].color}`} />
                      {isSelected && (
                        <div className="absolute inset-0 bg-indigo-500/40 backdrop-blur-[2px] flex items-center justify-center">
                          <CheckCircle2 className="w-6 h-6 text-white drop-shadow-md" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-black text-white truncate drop-shadow-sm">{card.name}</p>
                      <p className={`text-[9px] font-bold uppercase tracking-wider mb-2 bg-gradient-to-r ${rarityConfig[card.rarity].color} bg-clip-text text-transparent`}>
                        {rarityConfig[card.rarity].label}
                      </p>
                      <div className="grid grid-cols-2 gap-y-1 text-[10px] font-medium text-slate-300">
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3 text-rose-400" /> {card.stats.hp}</span>
                        <span className="flex items-center gap-1"><SwordsIcon className="w-3 h-3 text-amber-400" /> {card.stats.atk}</span>
                        <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-blue-400" /> {card.stats.def}</span>
                        <span className="flex items-center gap-1"><Zap className="w-3 h-3 text-emerald-400" /> {card.stats.spd}</span>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 shrink-0">
              <button
                onClick={() => setShowTeamBuilder(false)}
                className="w-full py-4 bg-white text-black hover:bg-slate-200 font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
              >
                Подтвердить выбор ({selectedCards.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}