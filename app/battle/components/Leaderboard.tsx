import React, { useState, useEffect } from 'react'
import { Trophy, Medal, Crown, Swords, TrendingUp, TrendingDown } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface LeaderboardEntry {
  user_id: string
  mmr: number
  wins: number
  losses: number
  rank_tier: string
  email?: string
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

export const Leaderboard: React.FC = () => {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'top100'>('top100')

  useEffect(() => {
    loadLeaderboard()
  }, [filter])

  const loadLeaderboard = async () => {
    setLoading(true)
    try {
      const limit = filter === 'top100' ? 100 : 1000
      const { data, error } = await supabase
        .from('user_ladder')
        .select('user_id, mmr, wins, losses, rank_tier')
        .order('mmr', { ascending: false })
        .limit(limit)

      if (error) throw error
      setLeaderboard(data || [])
    } catch (err) {
      console.error('[Leaderboard] Error loading:', err)
    } finally {
      setLoading(false)
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
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-black text-white flex items-center gap-3">
          <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
            <Trophy className="w-5 h-5" />
          </span>
          Таблица Лидеров
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('top100')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === 'top100'
                ? 'bg-purple-500 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            Топ 100
          </button>
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === 'all'
                ? 'bg-purple-500 text-white'
                : 'bg-white/5 text-slate-400 hover:bg-white/10'
            }`}
          >
            Все
          </button>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white/[0.02] border border-white/10 rounded-2xl overflow-hidden backdrop-blur-md">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Загрузка...</div>
        ) : leaderboard.length === 0 ? (
          <div className="p-8 text-center text-slate-400">Нет данных</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5 border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Место
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Игрок
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Ранг
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                    MMR
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Побед
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Поражений
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Винрейт
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {leaderboard.map((entry, index) => {
                  const rankInfo = getRankInfo(entry.rank_tier)
                  const RankIcon = rankInfo.icon
                  const winRate = getWinRate(entry.wins, entry.losses)

                  return (
                    <tr
                      key={entry.user_id}
                      className="hover:bg-white/5 transition-colors"
                    >
                      {/* Rank */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {index === 0 && (
                            <Crown className="w-5 h-5 text-yellow-400" />
                          )}
                          {index === 1 && (
                            <Medal className="w-5 h-5 text-slate-300" />
                          )}
                          {index === 2 && (
                            <Medal className="w-5 h-5 text-amber-700" />
                          )}
                          <span className="text-sm font-bold text-white">
                            #{index + 1}
                          </span>
                        </div>
                      </td>

                      {/* Player */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-300">
                          Игрок {entry.user_id.slice(0, 8)}
                        </span>
                      </td>

                      {/* Tier */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <RankIcon className={`w-4 h-4 bg-gradient-to-r ${rankInfo.color} bg-clip-text text-transparent`} />
                          <span className={`text-xs font-bold bg-gradient-to-r ${rankInfo.color} bg-clip-text text-transparent`}>
                            {rankInfo.name}
                          </span>
                        </div>
                      </td>

                      {/* MMR */}
                      <td className="px-4 py-3 text-center">
                        <span className="text-sm font-bold text-purple-400">
                          {entry.mmr}
                        </span>
                      </td>

                      {/* Wins */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          <span className="text-sm text-emerald-400">
                            {entry.wins}
                          </span>
                        </div>
                      </td>

                      {/* Losses */}
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingDown className="w-3 h-3 text-rose-400" />
                          <span className="text-sm text-rose-400">
                            {entry.losses}
                          </span>
                        </div>
                      </td>

                      {/* Win Rate */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-sm font-bold ${
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
    </div>
  )
}
