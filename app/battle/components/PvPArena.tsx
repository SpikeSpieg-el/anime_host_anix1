import React, { useState, useEffect, useRef } from 'react'
import { Swords, Users, Trophy, Loader2, X, AlertCircle, Crown, Medal, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, ChevronDown, User } from 'lucide-react'
import { Card } from '../types'
import { glassCard, DECK_SIZE } from '../config'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth/auth-provider'

interface PvPArenaProps {
  selectedCards: Card[]
  leaderId: string | null
  formation: string
  onClose: () => void
  pvpState: any
  joinQueue: (deck: Card[], leaderId: string | null, formation: string) => void
  leaveQueue: () => void
  isConnected: boolean
  onShowLeaderboard: () => void
}

const RANK_TIERS = {
  grandmaster: { name: 'Грандмастер', color: 'from-red-500 to-orange-500', icon: Crown },
  master: { name: 'Мастер', color: 'from-purple-500 to-pink-500', icon: Trophy },
  diamond: { name: 'Алмаз', color: 'from-cyan-400 to-blue-500', icon: Medal },
  platinum: { name: 'Платина', color: 'from-slate-300 to-slate-400', icon: Medal },
  gold: { name: 'Золото', color: 'from-yellow-400 to-yellow-600', icon: Medal },
  silver: { name: 'Серебро', color: 'from-slate-400 to-slate-500', icon: Medal },
  bronze: { name: 'Бронза', color: 'from-amber-700 to-amber-900', icon: Medal },
}

interface LeaderboardEntry {
  user_id: string
  mmr: number
  wins: number
  losses: number
  rank_tier: string
  username?: string
}

export const PvPArena: React.FC<PvPArenaProps> = ({
  selectedCards,
  leaderId,
  formation,
  onClose,
  pvpState,
  joinQueue,
  leaveQueue,
  isConnected,
  onShowLeaderboard
}) => {
  const { user, profile } = useAuth()
  const [ladderData, setLadderData] = useState<any>(null)
  const [ladderLoading, setLadderLoading] = useState(true)
  const [ladderError, setLadderError] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const touchStartX = useRef<number>(0)
  const touchEndX = useRef<number>(0)

  useEffect(() => {
    const loadLadderData = async () => {
      if (!user) return
      setLadderLoading(true)
      setLadderError(null)

      const maxRetries = 3
      const retryDelay = 10000 // 10 seconds

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`[PvPArena] Loading ladder data, attempt ${attempt}/${maxRetries}...`)
          const { data, error } = await supabase
            .from('user_ladder')
            .select('*')
            .eq('user_id', user.id)
            .single()

          if (error) throw error
          setLadderData(data)
          setLadderLoading(false)
          return // Success, exit retry loop
        } catch (err) {
          console.error(`[PvPArena] Error loading ladder data (attempt ${attempt}/${maxRetries}):`, err)

          if (attempt === maxRetries) {
            setLadderError('Технические работы, PvP временно недоступно')
            setLadderLoading(false)
          } else {
            await new Promise(resolve => setTimeout(resolve, retryDelay))
          }
        }
      }
    }

    loadLadderData()
  }, [user])

  const getRankInfo = (tier: string) => {
    return RANK_TIERS[tier as keyof typeof RANK_TIERS] || RANK_TIERS.bronze
  }

  const getWinRate = (wins: number, losses: number) => {
    const total = wins + losses
    if (total === 0) return 0
    return Math.round((wins / total) * 100)
  }

  const handleJoinQueue = () => {
    if (selectedCards.length !== DECK_SIZE) {
      alert(`Необходимо выбрать ровно ${DECK_SIZE} карт для PvP битвы`)
      return
    }
    joinQueue(selectedCards, leaderId, formation)
  }

  const handleLeaveQueue = () => {
    leaveQueue()
  }

  const navigateDeck = (direction: 'left' | 'right') => {
    if (selectedCards.length === 0) return
    
    if (direction === 'left') {
      setCurrentIndex(prev => (prev - 1 + selectedCards.length) % selectedCards.length)
    } else {
      setCurrentIndex(prev => (prev + 1) % selectedCards.length)
    }
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0].screenX
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    touchEndX.current = e.changedTouches[0].screenX
    handleSwipe()
  }

  const handleSwipe = () => {
    const swipeThreshold = 50
    const diff = touchStartX.current - touchEndX.current
    
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        navigateDeck('right')
      } else {
        navigateDeck('left')
      }
    }
  }

  return (
    <div className="relative flex flex-col gap-5 max-w-4xl mx-auto p-1 text-slate-100 selection:bg-purple-500/30">
      
      {/* Top Bar / Header */}
      <div className="flex items-center justify-between border-b border-white/[0.06] pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.1)]">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-black tracking-wide text-white uppercase">Арена PvP</h2>
              {/* Online indicator */}
              <span className={`flex h-2 w-2 relative rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}>
                {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
              </span>
            </div>
            <p className="text-xs text-zinc-400 hidden sm:block">Сражения в реальном времени за рейтинг MMR</p>
          </div>
        </div>
      </div>

      {/* Connection & Error Messages */}
      {!isConnected && (
        <div className="bg-amber-950/20 border border-amber-500/20 rounded-xl p-3.5 flex items-start gap-3 animate-in slide-in-from-top-2 duration-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-bold text-amber-400">Подключение к серверу...</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">Пожалуйста, убедитесь, что соединение стабильно.</p>
          </div>
        </div>
      )}

      {(pvpState.error || ladderError) && (
        <div className="bg-red-950/20 border border-red-500/20 rounded-xl p-3.5 flex items-start gap-3 animate-in slide-in-from-top-2 duration-200">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-xs text-red-300 font-medium">{pvpState.error || ladderError}</p>
        </div>
      )}

      {/* Player Dashboard Card */}
      {ladderLoading ? (
        <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Profile Info Skeleton */}
            <div className="flex items-center gap-3.5 w-full md:w-auto">
              <div className="w-12 h-12 rounded-xl bg-zinc-800/50 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-zinc-800/50 rounded animate-pulse" />
                <div className="h-3 w-16 bg-zinc-800/50 rounded animate-pulse" />
              </div>
            </div>

            {/* Performance Stats Skeleton */}
            <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto border-t md:border-t-0 border-white/[0.04] pt-3 md:pt-0 justify-center md:justify-end">
              <div className="text-center md:text-right space-y-2">
                <div className="h-4 w-8 bg-zinc-800/50 rounded animate-pulse mx-auto md:mx-0" />
                <div className="h-2 w-12 bg-zinc-800/50 rounded animate-pulse mx-auto md:mx-0" />
              </div>
              <div className="text-center md:text-right border-l border-white/[0.04] pl-4 md:pl-6 space-y-2">
                <div className="h-4 w-8 bg-zinc-800/50 rounded animate-pulse mx-auto md:mx-0" />
                <div className="h-2 w-14 bg-zinc-800/50 rounded animate-pulse mx-auto md:mx-0" />
              </div>
              <div className="text-center md:text-right border-l border-white/[0.04] pl-4 md:pl-6 space-y-2">
                <div className="h-4 w-8 bg-zinc-800/50 rounded animate-pulse mx-auto md:mx-0" />
                <div className="h-2 w-10 bg-zinc-800/50 rounded animate-pulse mx-auto md:mx-0" />
              </div>
            </div>

            {/* Rank Badge Skeleton */}
            <div className="w-full md:w-auto">
              <div className="bg-zinc-900/80 border border-white/[0.1] rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-zinc-800/50 animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-20 bg-zinc-800/50 rounded animate-pulse" />
                    <div className="h-3 w-16 bg-zinc-800/50 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div className="h-full w-1/2 bg-zinc-700/50 rounded-full animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : ladderData && (
        <div className="bg-zinc-900/40 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-4 md:p-5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            
            {/* Profile Info */}
            <div className="flex items-center gap-3.5 w-full md:w-auto">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white font-extrabold text-lg shadow-lg shadow-purple-500/10">
                {profile?.username ? profile.username.charAt(0).toUpperCase() : 'U'}
              </div>
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">{profile?.username || 'Игрок'}</h3>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[10px] text-zinc-500 font-mono tracking-wider uppercase">Рейтинг:</span>
                  <span className="text-xs font-black text-purple-400">{ladderData.mmr} MMR</span>
                </div>
              </div>
            </div>

            {/* Performance Stats */}
            <div className="flex items-center gap-4 md:gap-6 w-full md:w-auto border-t md:border-t-0 border-white/[0.04] pt-3 md:pt-0 justify-center md:justify-end">
              <div className="text-center md:text-right">
                <div className="flex items-center justify-center md:justify-end gap-1 text-emerald-400 font-bold">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span className="text-xs tracking-wide">{ladderData.wins}</span>
                </div>
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5 font-bold">Победы</p>
              </div>

              <div className="text-center md:text-right border-l border-white/[0.04] pl-4 md:pl-6">
                <div className="flex items-center justify-center md:justify-end gap-1 text-rose-400 font-bold">
                  <TrendingDown className="w-3.5 h-3.5" />
                  <span className="text-xs tracking-wide">{ladderData.losses}</span>
                </div>
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5 font-bold">Поражения</p>
              </div>

              <div className="text-center md:text-right border-l border-white/[0.04] pl-4 md:pl-6">
                <div className="flex items-center justify-center md:justify-end gap-1 font-bold">
                  <span className={`text-xs tracking-wide ${
                    getWinRate(ladderData.wins, ladderData.losses) >= 60 
                      ? 'text-emerald-400' 
                      : getWinRate(ladderData.wins, ladderData.losses) >= 50 
                      ? 'text-yellow-500' 
                      : 'text-zinc-400'
                  }`}>
                    {getWinRate(ladderData.wins, ladderData.losses)}%
                  </span>
                </div>
                <p className="text-[9px] text-zinc-500 uppercase tracking-widest mt-0.5 font-bold">Винрейт</p>
              </div>
            </div>

            {/* Rank Tier Badge - Clean Display */}
            <div className="w-full md:w-auto">
              {(() => {
                const rankInfo = getRankInfo(ladderData.rank_tier)
                const RankIcon = rankInfo.icon
                
                // Calculate progress to next rank
                const tierOrder = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'grandmaster']
                const currentIndex = tierOrder.indexOf(ladderData.rank_tier)
                const nextTier = tierOrder[currentIndex + 1]
                const isMaxRank = currentIndex === tierOrder.length - 1
                
                // MMR thresholds for each tier
                const mmrThresholds = {
                  bronze: { min: 800, max: 1200 },
                  silver: { min: 1200, max: 1600 },
                  gold: { min: 1600, max: 2000 },
                  platinum: { min: 2000, max: 2400 },
                  diamond: { min: 2400, max: 2800 },
                  master: { min: 2800, max: 3200 },
                  grandmaster: { min: 3200, max: 9999 }
                }
                
                const currentThreshold = mmrThresholds[ladderData.rank_tier as keyof typeof mmrThresholds] || mmrThresholds.bronze
                const progress = isMaxRank ? 100 : Math.min(100, Math.max(0, ((ladderData.mmr - currentThreshold.min) / (currentThreshold.max - currentThreshold.min)) * 100))
                
                // Extract solid color from gradient
                const colorMap: Record<string, string> = {
                  'from-red-500 to-orange-500': 'text-red-500',
                  'from-purple-500 to-pink-500': 'text-purple-500',
                  'from-cyan-400 to-blue-500': 'text-cyan-400',
                  'from-slate-300 to-slate-400': 'text-slate-300',
                  'from-yellow-400 to-yellow-600': 'text-yellow-400',
                  'from-slate-400 to-slate-500': 'text-slate-400',
                  'from-amber-700 to-amber-900': 'text-amber-700',
                }
                const solidColor = colorMap[rankInfo.color] || 'text-zinc-400'
                
                const bgMap: Record<string, string> = {
                  'from-red-500 to-orange-500': 'bg-red-500',
                  'from-purple-500 to-pink-500': 'bg-purple-500',
                  'from-cyan-400 to-blue-500': 'bg-cyan-400',
                  'from-slate-300 to-slate-400': 'bg-slate-300',
                  'from-yellow-400 to-yellow-600': 'bg-yellow-400',
                  'from-slate-400 to-slate-500': 'bg-slate-400',
                  'from-amber-700 to-amber-900': 'bg-amber-700',
                }
                const solidBg = bgMap[rankInfo.color] || 'bg-zinc-400'
                
                return (
                  <div className="bg-zinc-900/80 border border-white/[0.1] rounded-2xl p-4">
                    <div className="flex items-center gap-3">
                      {/* Icon */}
                      <div className={`p-3 rounded-xl ${solidBg}`}>
                        <RankIcon className="w-6 h-6 text-white" />
                      </div>
                      
                      {/* Rank name and tier */}
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-black ${solidColor} uppercase tracking-wider`}>
                            {rankInfo.name}
                          </span>
                          {!isMaxRank && (
                            <span className="text-[9px] text-zinc-500 font-medium">
                              → {RANK_TIERS[nextTier as keyof typeof RANK_TIERS]?.name}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-zinc-400 font-mono">{ladderData.mmr} MMR</span>
                          {!isMaxRank && (
                            <span className="text-[9px] text-zinc-500">
                              до {currentThreshold.max}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress bar */}
                    {!isMaxRank && (
                      <div className="mt-3">
                        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${solidBg} transition-all duration-500 ease-out rounded-full`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <div className="flex justify-between mt-1">
                          <span className="text-[8px] text-zinc-500 font-mono">{currentThreshold.min}</span>
                          <span className="text-[8px] text-zinc-500 font-mono">{currentThreshold.max}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Max rank indicator */}
                    {isMaxRank && (
                      <div className="mt-3 flex items-center justify-center gap-1.5 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                        <Crown className="w-3 h-3 text-amber-400" />
                        <span className="text-[9px] font-bold text-amber-400 uppercase tracking-wider">Максимальный ранг</span>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>

          </div>
        </div>
      )}

      {/* Interactive Main Panels */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        {/* Left Panel: Search and matchmaking */}
        <div className="md:col-span-5 flex flex-col justify-between bg-zinc-900/40 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 relative overflow-hidden shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-zinc-800/50 text-zinc-400 border border-white/[0.04]">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Подбор соперника</h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">
                  {pvpState.status === 'idle' && 'Готов к поиску'}
                  {pvpState.status === 'connecting' && 'Инициализация...'}
                  {pvpState.status === 'in_queue' && `В поиске (${pvpState.queueSize || 0} в очереди)`}
                  {pvpState.status === 'matched' && 'Противник найден!'}
                  {pvpState.status === 'in_battle' && 'Вы в бою'}
                </p>
              </div>
            </div>

            {/* Active search radar style indicator */}
            {pvpState.status === 'in_queue' && (
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-purple-500"></span>
              </span>
            )}
          </div>

          <div className="mt-8 flex flex-col gap-3">
            {/* Main Action Button */}
            {pvpState.status === 'idle' && (
              <button
                onClick={handleJoinQueue}
                disabled={!isConnected || selectedCards.length !== DECK_SIZE}
                className="w-full py-3.5 px-4 bg-white text-zinc-950 disabled:bg-zinc-800 disabled:text-zinc-500 disabled:cursor-not-allowed hover:bg-zinc-100 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
              >
                <Swords className="w-4 h-4" />
                Найти Битву
              </button>
            )}

            {pvpState.status === 'in_queue' && (
              <button
                onClick={handleLeaveQueue}
                className="w-full py-3.5 px-4 bg-red-950/20 hover:bg-red-950/40 text-red-400 font-extrabold text-xs uppercase tracking-wider rounded-xl transition-all border border-red-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <X className="w-4 h-4" />
                Отменить Поиск
              </button>
            )}

            {/* Loading queue status anim */}
            {(pvpState.status === 'connecting' || pvpState.status === 'in_queue') && (
              <div className="flex items-center justify-center gap-2 py-2">
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                <span className="text-xs text-zinc-400 font-medium">Ожидание оппонента...</span>
              </div>
            )}

            {/* Match found state */}
            {pvpState.status === 'matched' && (
              <div className="bg-emerald-950/10 border border-emerald-500/20 rounded-xl p-4 text-center animate-in zoom-in-95 duration-200">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Swords className="w-4 h-4 text-emerald-400 animate-bounce" />
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Матч найден!</span>
                </div>
                <p className="text-[10px] text-zinc-400">
                  Оппонент ID: <span className="font-mono text-zinc-300">{pvpState.matchData?.opponentId?.slice(0, 8)}...</span>
                </p>
              </div>
            )}

            {/* Deck warning if not completed */}
            {selectedCards.length !== DECK_SIZE && pvpState.status === 'idle' && (
              <div className="text-[11px] leading-relaxed text-amber-400/90 bg-amber-500/[0.03] border border-amber-500/10 px-3 py-2.5 rounded-xl">
                Для участия требуется собрать колоду ровно из {DECK_SIZE} карт (сейчас: {selectedCards.length}).
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Deck selection & horizontal slider */}
        <div className="md:col-span-7 bg-zinc-900/40 backdrop-blur-xl border border-white/[0.06] rounded-2xl p-5 relative flex flex-col justify-between shadow-[inset_0_1px_1px_rgba(255,255,255,0.02)]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-zinc-800/50 text-zinc-400 border border-white/[0.04]">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wide">Ваша Боевая Колода</h3>
                <p className="text-[10px] text-zinc-400 mt-0.5">Выбрано карт: {selectedCards.length} из {DECK_SIZE}</p>
              </div>
            </div>

            {/* Navigation buttons for carousel */}
            {selectedCards.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button 
                  onClick={() => navigateDeck('left')}
                  className="p-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] text-zinc-400 hover:text-white transition-all"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => navigateDeck('right')}
                  className="p-1.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.06] border border-white/[0.04] text-zinc-400 hover:text-white transition-all"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Cards carousel - infinite cycling */}
          <div className="relative mt-2">
            {selectedCards.length > 0 ? (
              <div 
                className="relative h-[200px] flex items-center justify-center"
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
              >
                {selectedCards.map((card, idx) => {
                  const isVisible = idx === currentIndex
                  const isLeft = idx === (currentIndex - 1 + selectedCards.length) % selectedCards.length
                  const isRight = idx === (currentIndex + 1) % selectedCards.length
                  
                  return (
                    <div
                      key={card.uniqueId}
                      className="absolute transition-all duration-300 ease-out cursor-pointer"
                      style={{
                        left: isVisible ? '50%' : isLeft ? 'calc(50% - 100px)' : isRight ? 'calc(50% + 100px)' : '50%',
                        transform: isVisible ? 'translateX(-50%) scale(1.05)' : isLeft ? 'translateX(-50%) scale(0.85)' : isRight ? 'translateX(-50%) scale(0.85)' : 'translateX(-50%) scale(0)',
                        width: isVisible ? '120px' : isLeft || isRight ? '80px' : '0px',
                        opacity: isVisible ? 1 : isLeft || isRight ? 0.5 : 0,
                        pointerEvents: isVisible || isLeft || isRight ? 'auto' : 'none',
                        zIndex: isVisible ? 10 : isLeft || isRight ? 5 : 1,
                      }}
                      onClick={() => {
                        if (isLeft) navigateDeck('left')
                        if (isRight) navigateDeck('right')
                      }}
                    >
                      <div className="relative aspect-[2/3] rounded-xl overflow-hidden border border-white/[0.08] bg-zinc-950 shadow-lg">
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-full h-full object-cover select-none pointer-events-none"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent">
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p className="text-[9px] font-bold text-white truncate text-center">{card.name}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="aspect-[4/2] rounded-xl border border-dashed border-white/[0.08] bg-white/[0.01] flex items-center justify-center">
                <div className="text-center p-4">
                  <p className="text-xs text-zinc-500 font-medium">Нет выбранных карт в колоде</p>
                  <p className="text-[10px] text-zinc-600 mt-1">Вернитесь на экран выбора карт и подготовьте состав.</p>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Leaderboard Fast-Link */}
      <button
        onClick={onShowLeaderboard}
        className="w-full bg-zinc-900/30 hover:bg-zinc-800/40 border border-white/[0.05] p-3.5 rounded-2xl transition-all flex items-center justify-between group active:scale-[0.99] shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.1)]">
            <Trophy className="w-4 h-4" />
          </div>
          <div className="text-left">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">Таблица Лидеров</h3>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Взгляните на текущую вершину рейтинга и лучших воинов
            </p>
          </div>
        </div>
        <div className="text-zinc-500 group-hover:text-white group-hover:translate-x-0.5 transition-all text-sm font-bold">→</div>
      </button>

      {/* Informational Rules Section */}
      <div className="bg-white/[0.01] border border-white/[0.04] rounded-2xl p-4">
        <h4 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2.5">Основные правила Арены</h4>
        <ul className="text-[10px] text-zinc-500 space-y-1.5 leading-relaxed">
          <li className="flex items-start gap-1.5">• <span className="text-zinc-400">Сформируйте колоду:</span> ровно {DECK_SIZE} боевых карт обязательны для начала поиска.</li>
          <li className="flex items-start gap-1.5">• <span className="text-zinc-400">Подбор по MMR:</span> система подбирает максимально близких по силе оппонентов.</li>
          <li className="flex items-start gap-1.5">• <span className="text-zinc-400">Изменение рейтинга:</span> победа добавляет очки MMR, поражение снижает ваш текущий ранг.</li>
        </ul>
      </div>

    </div>
  )
}