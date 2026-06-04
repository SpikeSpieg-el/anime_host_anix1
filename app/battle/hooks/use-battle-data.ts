import { useState, useEffect, useCallback, useRef } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { useCoins } from "@/hooks/use-coins"
import { useDust } from "@/hooks/use-dust"
import { Card, Dungeon, Enemy, BattleProgress, BattleLog } from "../types"
import { calculateTeamPower, type BattleResult } from "@/lib/battle-engine"

export function useBattleData() {
  const { user, session, sessionLoading } = useAuth()
  const { coins: userCoins, refresh: refreshCoins } = useCoins()
  const { dust, refresh: refreshDust } = useDust()

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
  const [staminaTime, setStaminaTime] = useState("")

  const loadBattleData = useCallback(async () => {
    if (!user) return
    
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
      loadBattleData() 
      loadUserCards() 
    }
  }, [user, sessionLoading, loadBattleData, loadUserCards])

  // Timer for auto play battle animations
  useEffect(() => {
    if (!isAutoPlaying || !battleResult) return
    const speedMs = battleSpeed === 1 ? 1200 : 500
    const timer = setInterval(() => {
      setBattleActionIndex(prev => {
        if (prev >= battleResult.actions.length - 1) {
          setIsAutoPlaying(false)
          setBattleState("result")
          return prev
        }
        return prev + 1
      })
    }, speedMs)
    return () => clearInterval(timer)
  }, [isAutoPlaying, battleResult, battleSpeed])

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

  const toggleCardSelection = (card: Card) => {
    setSelectedCards(prev => {
      if (prev.some(c => c.uniqueId === card.uniqueId)) return prev.filter(c => c.uniqueId !== card.uniqueId)
      if (prev.length >= 3) return prev
      return [...prev, card]
    })
  }

  const startBattle = async () => {
    if (selectedCards.length === 0 || !selectedDungeon) return setError("Выберите карты и подземелье!")
    setError(null)
    setBattleState("loading")
    setBattleActionIndex(0)
    setIsAutoPlaying(false)

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
      if (!res.ok) { 
        setError(data.message || "Ошибка боя")
        setBattleState("idle")
        return 
      }
      if (data.success) {
        setBattleResult(data.battle)
        setBattleState("battle")
        setTimeout(() => setIsAutoPlaying(true), 1500)
      }
    } catch (err) {
      setError("Ошибка соединения")
      setBattleState("idle")
    }
  }

  const finishBattle = async () => {
    if (battleResult?.victory) { 
      await refreshCoins()
      await refreshDust()
    }
    await loadBattleData()
    setBattleState("idle")
    setBattleResult(null)
    setBattleActionIndex(0)
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
    selectedCards,
    setSelectedCards,
    selectedDungeon,
    setSelectedDungeon,
    battleState,
    setBattleState,
    battleResult,
    battleActionIndex,
    setBattleActionIndex,
    isAutoPlaying,
    setIsAutoPlaying,
    battleSpeed,
    setBattleSpeed,
    showTeamBuilder,
    setShowTeamBuilder,
    teamSearch,
    setTeamSearch,
    sortBy,
    setSortBy,
    error,
    setError,
    staminaTime,
    toggleCardSelection,
    startBattle,
    finishBattle,
    teamPower,
    filteredCards,
  }
}
