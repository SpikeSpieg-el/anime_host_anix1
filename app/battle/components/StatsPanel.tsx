import React from "react"
import { Crown, Zap, Coins, Timer } from "lucide-react"
import { BattleProgress } from "../types"
import { glassCard } from "../config"

interface StatsPanelProps {
  progress: BattleProgress | null
  userCoins: number
  staminaTime: string
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ progress, userCoins, staminaTime }) => {
  if (!progress) return null

  return (
    <div className="flex overflow-x-auto pb-4 md:pb-0 mb-8 md:mb-12 snap-x scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:justify-center gap-3">
      {/* Уровень */}
      <div className={`shrink-0 snap-center flex flex-col justify-center px-5 py-3 rounded-2xl ${glassCard} min-w-[140px]`}>
        <div className="flex items-center gap-2 mb-1.5 text-slate-400">
          <Crown className="w-4 h-4 text-amber-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Уровень</span>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-2xl font-black text-white">{progress.level}</span>
        </div>
        <div className="w-full h-1.5 bg-black/50 rounded-full mt-2 overflow-hidden border border-white/5">
          <div 
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500" 
            style={{ width: `${Math.min(100, (progress.xp / progress.xp_to_next) * 100)}%` }} 
          />
        </div>
      </div>

      {/* Энергия */}
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

      {/* Монеты */}
      <div className={`shrink-0 snap-center flex flex-col justify-center px-5 py-3 rounded-2xl ${glassCard} min-w-[140px]`}>
        <div className="flex items-center gap-2 mb-1.5 text-slate-400">
          <Coins className="w-4 h-4 text-yellow-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest">Монеты</span>
        </div>
        <span className="text-2xl font-black text-white">{userCoins.toLocaleString()}</span>
      </div>

      {/* Дейлики */}
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
  )
}
