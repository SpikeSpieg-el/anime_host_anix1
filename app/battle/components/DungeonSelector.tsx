import React from "react"
import { Mountain, Zap, Coins, Star, Sparkles, CheckCircle2, Lock, TrendingUp, Swords } from "lucide-react"
import { Dungeon, BattleProgress } from "../types"
import { THEME_CONFIG } from "../config"

interface DungeonSelectorProps {
  dungeons: Dungeon[]
  progress: BattleProgress | null
  selectedDungeon: Dungeon | null
  setSelectedDungeon: (dungeon: Dungeon) => void
  logs: any[]
  onStartBattle?: () => void
}

export const DungeonSelector: React.FC<DungeonSelectorProps> = ({
  dungeons,
  progress,
  selectedDungeon,
  setSelectedDungeon,
  logs,
  onStartBattle,
}) => {
  return (
    <div className="flex flex-col gap-3 sm:gap-4 h-full">
      {/* Header */}
      <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 px-1 sm:px-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br from-rose-500/20 to-purple-500/20 border border-rose-500/30 shadow-lg">
            <Mountain className="w-4 h-4 sm:w-5 sm:h-5 text-rose-400" />
          </div>
          <h2 className="text-lg sm:text-2xl font-black text-white tracking-tight">
            Выбор Локации
          </h2>
        </div>
        {selectedDungeon && (
          <div className="flex items-center gap-1.5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full border border-indigo-500/30">
            <TrendingUp className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-400" />
            <span className="text-[10px] sm:text-xs font-bold text-slate-300">
              Мин. ур. <span className="text-white">{selectedDungeon.required_level}</span>
            </span>
          </div>
        )}
      </div>

      {/* Dungeons Grid */}
      <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent px-1 sm:px-2 pt-4 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {dungeons.map((dungeon) => {
            const theme = THEME_CONFIG[dungeon.theme] || THEME_CONFIG.dark_forest
            const ThemeIcon = theme.icon
            const isLocked = progress ? progress.level < dungeon.required_level : true
            const isSelected = selectedDungeon?.id === dungeon.id
            const isDaily = dungeon.id?.startsWith("daily-")

            const isDailyCompletedViaLogs = isDaily && logs ? logs.some((log: any) => log.dungeon_id === dungeon.id && log.result === 'win') : false
            const dailyLimitReached = isDaily && progress ? progress.daily_battles_today >= 2 : false
            const isDailyCompleted = isDailyCompletedViaLogs || dailyLimitReached

            return (
              <button
                key={dungeon.id}
                onClick={() => !isLocked && !isDailyCompleted && setSelectedDungeon(dungeon)}
                disabled={isLocked || isDailyCompleted}
                className={`
                  relative text-left rounded-2xl sm:rounded-[1.5rem] p-3 sm:p-5 overflow-hidden
                  transition-all duration-300 group touch-manipulation
                  ${isLocked || isDailyCompleted
                    ? "opacity-40 cursor-not-allowed bg-black/30 border border-white/5"
                    : isSelected
                    ? "bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10 ring-2 ring-indigo-500 shadow-[0_0_40px_rgba(99,102,241,0.2)] border-transparent scale-[1.02] sm:scale-100"
                    : "bg-white/[0.02] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 hover:shadow-xl active:scale-[0.98] sm:active:scale-100"
                  }
                  backdrop-blur-md
                `}
              >
                {/* Animated Background Gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-40 transition-opacity duration-500 ${isSelected ? 'opacity-60' : 'group-hover:opacity-50'}`} />
                
                {/* Glow Effect on Selection */}
                {isSelected && (
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-transparent animate-pulse" />
                )}

                {/* Status Badges */}
                {isDaily && !isDailyCompleted && (
                  <div className="absolute top-0 right-0 bg-gradient-to-br from-blue-500 to-cyan-500 text-white text-[8px] sm:text-[9px] font-black uppercase px-2 sm:px-3 py-0.5 sm:py-1 rounded-bl-xl sm:rounded-bl-2xl shadow-lg z-10 flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span className="hidden xs:inline">Ежедневное</span>
                    <span className="xs:hidden">Daily</span>
                  </div>
                )}
                {isDailyCompleted && (
                  <div className="absolute top-0 right-0 bg-emerald-500/20 text-emerald-300 border-b border-l border-emerald-500/30 text-[8px] sm:text-[9px] font-black uppercase px-2 sm:px-3 py-0.5 sm:py-1 rounded-bl-xl sm:rounded-bl-2xl z-10 flex items-center gap-1 backdrop-blur-md">
                    <CheckCircle2 className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                    <span className="hidden xs:inline">Пройдено</span>
                    <span className="xs:hidden">✓</span>
                  </div>
                )}

                {/* Content */}
                <div className="relative z-10 flex flex-col h-full min-h-[140px] sm:min-h-[180px]">
                  {/* Top Section */}
                  <div className="flex items-start justify-between mb-3 sm:mb-4">
                    <div className={`
                      p-2 sm:p-2.5 rounded-xl ${theme.bg} ${theme.border} border 
                      backdrop-blur-sm shadow-lg transition-transform duration-300
                      ${isSelected ? 'scale-110' : 'group-hover:scale-105'}
                    `}>
                      <ThemeIcon className={`w-4 h-4 sm:w-5 sm:h-5 ${theme.color}`} />
                    </div>
                    <div className="flex items-center gap-1 sm:gap-1.5 bg-black/50 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border border-yellow-500/20 shadow-lg">
                      <Zap className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-400" />
                      <span className="text-[10px] sm:text-xs font-black text-yellow-400">{dungeon.energy_cost}</span>
                    </div>
                  </div>

                  {/* Info Section */}
                  <div className="mb-auto flex-1">
                    <h3 className="text-base sm:text-lg font-black text-white mb-1 drop-shadow-lg leading-tight">
                      {dungeon.name_ru}
                    </h3>
                    <div className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                      <div className="w-1 h-1 rounded-full bg-slate-400" />
                      Угроза {dungeon.difficulty}
                    </div>
                    {dungeon.description && (
                      <p className="text-[10px] sm:text-xs text-slate-400/90 line-clamp-2 leading-relaxed">
                        {dungeon.description}
                      </p>
                    )}
                  </div>

                  {/* Rewards Section */}
                  <div className="flex flex-wrap gap-1.5 sm:gap-2 pt-3 sm:pt-4 border-t border-white/10 mt-2">
                    <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-gradient-to-br from-yellow-500/20 to-orange-500/20 border border-yellow-500/30 shadow-sm">
                      <Coins className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-400" />
                      <span className="text-[9px] sm:text-[10px] font-bold text-yellow-200">{dungeon.coins_reward_base}</span>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 shadow-sm">
                      <Star className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-400" />
                      <span className="text-[9px] sm:text-[10px] font-bold text-blue-200">{dungeon.xp_reward_base}</span>
                    </div>
                    {dungeon.dust_reward_base > 0 && (
                      <div className="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 shadow-sm">
                        <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-400" />
                        <span className="text-[9px] sm:text-[10px] font-bold text-amber-200">{dungeon.dust_reward_base}</span>
                      </div>
                    )}
                  </div>

                  {/* Start Battle Button on Selected */}
                  {isSelected && onStartBattle && (
                    <div
                      className="mt-3 pt-3 border-t border-indigo-500/30"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={onStartBattle}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onStartBattle() }}
                        className="w-full flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-black font-black text-xs sm:text-sm uppercase tracking-wider shadow-lg shadow-amber-500/30 border-b-2 border-amber-700 hover:brightness-110 transition-all active:scale-[0.97] cursor-pointer select-none"
                      >
                        <Swords className="w-4 h-4" />
                        Вступить в дуэль
                      </div>
                    </div>
                  )}
                </div>

                {/* Lock Overlay */}
                {isLocked && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
                    <div className="bg-gradient-to-br from-slate-900/90 to-black/90 px-3 sm:px-4 py-2 rounded-xl border border-white/20 flex items-center gap-2 shadow-2xl">
                      <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                      <div className="flex flex-col">
                        <span className="text-[10px] sm:text-xs font-bold text-slate-300">
                          Требуется ур. {dungeon.required_level}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
