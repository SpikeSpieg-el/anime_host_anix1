import React from "react"
import { Crown, Zap, Coins, Timer, Sparkles } from "lucide-react"
import { BattleProgress } from "../types"
import { glassCard } from "../config"

export const StatsPanelSkeleton: React.FC = () => {
  return (
    <div className="flex overflow-x-auto pb-2 md:pb-0 mb-6 md:mb-8 snap-x scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:justify-center gap-2">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className={`shrink-0 snap-center flex flex-col justify-center px-3 py-2 rounded-xl ${glassCard} min-w-[100px] animate-pulse`}>
          <div className="h-3 w-16 bg-white/10 rounded mb-2" />
          <div className="h-6 w-8 bg-white/10 rounded mb-1" />
          <div className="h-1.5 w-full bg-white/5 rounded" />
        </div>
      ))}
    </div>
  )
}

interface StatsPanelProps {
  progress: BattleProgress | null
  userCoins: number
  dust: number
  staminaTime: string
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ progress, userCoins, dust, staminaTime }) => {
  if (!progress) return <StatsPanelSkeleton />

  return (
    <div className="flex overflow-x-auto pb-2 md:pb-0 mb-6 md:mb-8 snap-x scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:justify-center gap-2">
      {/* Уровень */}
      <div className={`shrink-0 snap-center flex flex-col justify-center px-3 py-2 rounded-xl ${glassCard} min-w-[100px]`}>
        <div className="flex items-center gap-1.5 mb-1 text-slate-400">
          <Crown className="w-3 h-3 text-amber-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Уровень</span>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-xl font-black text-white">{progress.level}</span>
        </div>
        <div className="w-full h-1 bg-black/50 rounded-full mt-1.5 overflow-hidden border border-white/5">
          <div 
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500" 
            style={{ width: `${Math.min(100, (progress.xp / progress.xp_to_next) * 100)}%` }} 
          />
        </div>
      </div>

      {/* Энергия */}
      <div className={`shrink-0 snap-center flex flex-col justify-center px-3 py-2 rounded-xl ${glassCard} min-w-[100px]`}>
        <div className="flex items-center gap-1.5 mb-1 text-slate-400">
          <Zap className="w-3 h-3 text-yellow-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Энергия</span>
        </div>
        <div className="flex items-end gap-1.5">
          <span className="text-xl font-black text-yellow-400">{progress.current_stamina}</span>
          <span className="text-xs font-bold text-slate-500 mb-0.5">/ {progress.max_stamina}</span>
        </div>
        {progress.current_stamina < progress.max_stamina && (
          <span className="text-[9px] text-yellow-500/70 font-mono mt-0.5">{staminaTime}</span>
        )}
      </div>

      {/* Монеты */}
      <div className={`shrink-0 snap-center flex flex-col justify-center px-3 py-2 rounded-xl ${glassCard} min-w-[100px]`}>
        <div className="flex items-center gap-1.5 mb-1 text-slate-400">
          <Coins className="w-3 h-3 text-yellow-500" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Монеты</span>
        </div>
        <span className="text-xl font-black text-white">{userCoins.toLocaleString()}</span>
      </div>

      {/* Пыль */}
      <div className={`shrink-0 snap-center flex flex-col justify-center px-3 py-2 rounded-xl ${glassCard} min-w-[100px]`}>
        <div className="flex items-center gap-1.5 mb-1 text-slate-400">
          <Sparkles className="w-3 h-3 text-amber-300" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Пыль</span>
        </div>
        <span className="text-xl font-black text-white">{dust.toLocaleString()}</span>
      </div>

      {/* Дейлики */}
      <div className={`shrink-0 snap-center flex flex-col justify-center px-3 py-2 rounded-xl ${glassCard} min-w-[100px]`}>
        <div className="flex items-center gap-1.5 mb-1 text-slate-400">
          <Timer className="w-3 h-3 text-blue-400" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Дейлики</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xl font-black text-blue-400">{progress.daily_battles_today}</span>
          <span className="text-xs font-bold text-slate-500 mb-0.5">/ 2</span>
        </div>
      </div>
    </div>
  )
}
