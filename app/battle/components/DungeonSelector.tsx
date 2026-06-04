import React from "react"
import { Mountain, Zap, Coins, Star, Sparkles, CheckCircle2 } from "lucide-react"
import { Dungeon, BattleProgress } from "../types"
import { THEME_CONFIG } from "../config"

interface DungeonSelectorProps {
  dungeons: Dungeon[]
  progress: BattleProgress | null
  selectedDungeon: Dungeon | null
  setSelectedDungeon: (dungeon: Dungeon) => void
}

export const DungeonSelector: React.FC<DungeonSelectorProps> = ({
  dungeons,
  progress,
  selectedDungeon,
  setSelectedDungeon,
}) => {
  return (
    <div className="xl:col-span-8 flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-2">
        <h2 className="text-2xl font-black text-white flex items-center gap-3 drop-shadow-sm">
          <span className="p-2 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30">
            <Mountain className="w-5 h-5" />
          </span>
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
          {dungeons.map((dungeon) => {
            const theme = THEME_CONFIG[dungeon.theme] || THEME_CONFIG.dark_forest
            const ThemeIcon = theme.icon
            const isLocked = progress ? progress.level < dungeon.required_level : true
            const isSelected = selectedDungeon?.id === dungeon.id
            const isDaily = dungeon.id?.startsWith("daily-")
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
                {/* Theme theme gradient */}
                <div className={`absolute inset-0 bg-gradient-to-br ${theme.gradient} opacity-50`} />

                {/* Decorative Badges */}
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
                      <p className="text-xs text-slate-400/80 line-clamp-2 leading-relaxed mb-4">
                        {dungeon.description}
                      </p>
                    )}
                  </div>

                  {/* Rewards */}
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
            )
          })}
        </div>
      </div>
    </div>
  )
}
