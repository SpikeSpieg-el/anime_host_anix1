import React, { useState, useEffect, useRef } from "react"
import { Crown, Zap, Coins, Timer, Sparkles } from "lucide-react"
import { BattleProgress } from "../types"
import { glassCard } from "../config"

function useSpendAnimation(value: number) {
  const [flash, setFlash] = useState(false)
  const [delta, setDelta] = useState<number | null>(null)
  const prevRef = useRef<number | null>(null)

  useEffect(() => {
    if (prevRef.current !== null && value < prevRef.current) {
      setDelta(prevRef.current - value)
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
  coinsLoading: boolean
  dust: number
  dustLoading: boolean
  staminaTime: string
}

export const StatsPanel: React.FC<StatsPanelProps> = ({ progress, userCoins, coinsLoading, dust, dustLoading, staminaTime }) => {
  const coinsAnim = useSpendAnimation(userCoins)
  const dustAnim = useSpendAnimation(dust)

  if (!progress) return <StatsPanelSkeleton />

  return (
    <div data-tutorial="battle-stats" className="flex overflow-x-auto pb-2 md:pb-0 mb-6 md:mb-8 snap-x scrollbar-hide -mx-4 px-4 md:mx-0 md:px-0 md:justify-center gap-2">
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
      <div className={`relative shrink-0 snap-center flex flex-col justify-center px-3 py-2 rounded-xl ${glassCard} min-w-[100px] transition-all duration-200 ${coinsAnim.flash ? 'ring-2 ring-red-500/70 ring-offset-2 ring-offset-slate-950' : ''}`}>
        <div className="flex items-center gap-1.5 mb-1 text-slate-400">
          <Coins className="w-3 h-3 text-yellow-500" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Монеты</span>
        </div>
        <span className={`text-xl font-black transition-colors duration-200 ${coinsAnim.flash ? 'text-red-500 animate-spend' : 'text-white'}`}>
          {coinsLoading ? <span className="inline-block w-16 h-5 bg-white/10 rounded animate-pulse align-middle" /> : userCoins.toLocaleString()}
        </span>
        {coinsAnim.delta !== null && (
          <span className="absolute -top-4 left-1/2 text-red-400 font-black text-[10px] animate-float-minus whitespace-nowrap pointer-events-none">
            -{coinsAnim.delta.toLocaleString()}
          </span>
        )}
      </div>

      {/* Пыль */}
      <div className={`relative shrink-0 snap-center flex flex-col justify-center px-3 py-2 rounded-xl ${glassCard} min-w-[100px] transition-all duration-200 ${dustAnim.flash ? 'ring-2 ring-red-500/70 ring-offset-2 ring-offset-slate-950' : ''}`}>
        <div className="flex items-center gap-1.5 mb-1 text-slate-400">
          <Sparkles className="w-3 h-3 text-amber-300" />
          <span className="text-[9px] font-bold uppercase tracking-wider">Пыль</span>
        </div>
        <span className={`text-xl font-black transition-colors duration-200 ${dustAnim.flash ? 'text-red-500 animate-spend' : 'text-white'}`}>
          {dustLoading ? <span className="inline-block w-10 h-5 bg-white/10 rounded animate-pulse align-middle" /> : dust.toLocaleString()}
        </span>
        {dustAnim.delta !== null && (
          <span className="absolute -top-4 left-1/2 text-red-400 font-black text-[10px] animate-float-minus whitespace-nowrap pointer-events-none">
            -{dustAnim.delta.toLocaleString()}
          </span>
        )}
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
