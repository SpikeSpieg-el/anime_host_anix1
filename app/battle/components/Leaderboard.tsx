import React, { useState, useEffect, useRef } from 'react'
import { Trophy, Medal, Crown, Swords, TrendingUp, TrendingDown, User, ChevronLeft } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/auth/auth-provider'

interface LeaderboardEntry {
  user_id: string
  mmr: number
  wins: number
  losses: number
  rank_tier: string
  username?: string
}

interface LeaderboardProps {
  onClose: () => void
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

export const Leaderboard: React.FC<LeaderboardProps> = ({ onClose }) => {
  const { user, profile } = useAuth()
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [userRank, setUserRank] = useState<number | null>(null)
  const userRowRef = useRef<HTMLTableRowElement>(null)

  useEffect(() => {
    loadLeaderboard()
  }, [])

  useEffect(() => {
    if (userRowRef.current && userRank) {
      userRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [userRank])

  const loadLeaderboard = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('user_ladder')
        .select('user_id, mmr, wins, losses, rank_tier')
        .order('mmr', { ascending: false })
        .limit(100)

      if (error) throw error
      setLeaderboard(data || [])
      
      // Find user rank
      if (user && data) {
        const userIndex = data.findIndex((entry: LeaderboardEntry) => entry.user_id === user.id)
        setUserRank(userIndex >= 0 ? userIndex + 1 : null)
      }
    } catch (err) {
      console.error('[Leaderboard] Error loading:', err)
    } finally {
      setLoading(false)
    }
  }

  const scrollToUser = () => {
    if (userRowRef.current) {
      userRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const getRankInfo = (tier: string) => {
    return RANK_TIERS[tier as keyof typeof RANK_TIERS] || RANK_TIERS.bronze
  }

  const getWinRate = (wins: number, losses: number) => {
    const total = wins + losses
    if (total === 0) return 0
    return Math.round((wins / total) * 100)
  }

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="px-4 py-2 bg-zinc-900/60 hover:bg-zinc-800/80 rounded-xl text-xs font-bold text-zinc-300 transition-all border border-white/[0.06] active:scale-95 flex items-center gap-2"
        >
          <ChevronLeft className="w-4 h-4" />
          Вернуться на арену
        </button>
        {userRank && (
          <button
            onClick={scrollToUser}
            className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-xl text-xs font-bold text-purple-300 transition-all border border-purple-500/30 active:scale-95 flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            Моя позиция: #{userRank}
          </button>
        )}
      </div>
      
      {/* Leaderboard Table */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
        {loading ? (
          <div className="p-8 text-center text-slate-400 flex items-center justify-center gap-2">
            <Swords className="w-5 h-5 animate-spin" />
            Загрузка таблицы лидеров...
          </div>
        ) : leaderboard.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Нет данных</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-3 py-3 text-left text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Место
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Игрок
                  </th>
                  <th className="px-3 py-3 text-left text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider hidden sm:table-cell">
                    Ранг
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
                    MMR
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">
                    Побед
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider hidden md:table-cell">
                    Поражений
                  </th>
                  <th className="px-3 py-3 text-center text-[10px] md:text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Винрейт
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((entry, index) => {
                  const rankInfo = getRankInfo(entry.rank_tier)
                  const RankIcon = rankInfo.icon
                  const winRate = getWinRate(entry.wins, entry.losses)
                  const isCurrentUser = user && entry.user_id === user.id

                  return (
                    <tr
                      key={entry.user_id}
                      ref={isCurrentUser ? userRowRef : null}
                      className={`hover:bg-white/5 transition-colors ${
                        isCurrentUser ? 'bg-purple-500/10 border-l-2 border-l-purple-500' : ''
                      }`}
                    >
                      {/* Rank */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {index === 0 && (
                            <Crown className="w-4 h-4 text-yellow-400" />
                          )}
                          {index === 1 && (
                            <Medal className="w-4 h-4 text-slate-300" />
                          )}
                          {index === 2 && (
                            <Medal className="w-4 h-4 text-amber-700" />
                          )}
                          <span className="text-xs md:text-sm font-bold text-white">
                            #{index + 1}
                          </span>
                        </div>
                      </td>

                      {/* Player */}
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          {isCurrentUser && (
                            <User className="w-3 h-3 text-purple-400" />
                          )}
                          <span className="text-xs md:text-sm text-slate-300">
                            {isCurrentUser ? (profile?.username || 'Вы') : `Игрок ${entry.user_id.slice(0, 8)}`}
                          </span>
                        </div>
                      </td>

                      {/* Tier */}
                      <td className="px-3 py-3 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <RankIcon className={`w-3 h-3 bg-gradient-to-r ${rankInfo.color} bg-clip-text text-transparent`} />
                          <span className={`text-[10px] font-bold bg-gradient-to-r ${rankInfo.color} bg-clip-text text-transparent`}>
                            {rankInfo.name}
                          </span>
                        </div>
                      </td>

                      {/* MMR */}
                      <td className="px-3 py-3 text-center">
                        <span className="text-xs md:text-sm font-bold text-purple-400">
                          {entry.mmr}
                        </span>
                      </td>

                      {/* Wins */}
                      <td className="px-3 py-3 text-center hidden md:table-cell">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span className="text-xs md:text-sm text-emerald-400">
                            {entry.wins}
                          </span>
                        </div>
                      </td>

                      {/* Losses */}
                      <td className="px-3 py-3 text-center hidden md:table-cell">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingDown className="w-3 h-3 text-rose-400" />
                          <span className="text-xs md:text-sm text-rose-400">
                            {entry.losses}
                          </span>
                        </div>
                      </td>

                      {/* Win Rate */}
                      <td className="px-3 py-3 text-center">
                        <span
                          className={`text-xs md:text-sm font-bold ${
                            winRate >= 60
                              ? 'text-emerald-400'
                              : winRate >= 50
                              ? 'text-yellow-400'
                              : 'text-slate-400'
                          }`}
                        >
                          {winRate}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      
      {userRank === null && (
        <div className="text-center text-xs text-zinc-500 py-2">
          Вы не в топ-100. Продолжайте побеждать, чтобы попасть в таблицу лидеров!
        </div>
      )}
    </div>
  )
}
