import React from "react"
import { Shield, Heart, Swords as SwordsIcon, X, Target, Info, Trophy, Skull } from "lucide-react"
import { Card, Dungeon, Enemy, BattleProgress, BattleLog } from "../types"
import { rarityConfig } from "@/types/gacha"
import { glassCard, glassButton } from "../config"
import { getDungeonEnemyPower } from "../utils"

interface SelectedTeamPanelProps {
  selectedCards: Card[]
  toggleCardSelection: (card: Card) => void
  setShowTeamBuilder: (show: boolean) => void
  selectedDungeon: Dungeon | null
  enemies: Enemy[]
  teamPower: {
    totalPower: number
    rating: string
    ratingColor: string
  }
  progress: BattleProgress | null
  startBattle: () => void
  logs: BattleLog[]
}

export const SelectedTeamPanel: React.FC<SelectedTeamPanelProps> = ({
  selectedCards,
  toggleCardSelection,
  setShowTeamBuilder,
  selectedDungeon,
  enemies,
  teamPower,
  progress,
  startBattle,
  logs,
}) => {
  const enemyPower = selectedDungeon ? getDungeonEnemyPower(selectedDungeon, enemies) : null

  return (
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

        {/* Card slots */}
        <div className="flex flex-col gap-3 mb-6">
          {[0, 1, 2].map((slot) => {
            const card = selectedCards[slot]
            if (!card) {
              return (
                <button
                  key={slot}
                  onClick={() => setShowTeamBuilder(true)}
                  className="w-full h-16 rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] transition-colors flex items-center justify-center gap-2 text-slate-500 hover:text-slate-300 text-sm font-bold group"
                >
                  <span className="group-hover:scale-125 transition-transform">+</span> Выбрать бойца
                </button>
              )
            }

            const rarity = card.rarity
            const config = rarityConfig[rarity] || { bg: "from-slate-500 to-slate-700", color: "text-slate-400", label: "Обычная" }

            return (
              <div
                key={card.uniqueId}
                className="relative flex items-center gap-3 p-2 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-sm group overflow-hidden"
              >
                {/* Rarity BG */}
                <div className={`absolute inset-0 bg-gradient-to-r ${config.bg} opacity-10`} />

                <div className="relative w-12 h-16 rounded-xl overflow-hidden shrink-0 border border-white/10 shadow-lg">
                  <img src={card.imageUrl} className="w-full h-full object-cover" alt={card.name} />
                  <div className={`absolute top-0 right-0 w-full h-1 bg-gradient-to-r ${config.color}`} />
                </div>

                <div className="flex-1 min-w-0 relative z-10">
                  <p className="text-sm font-black text-white truncate drop-shadow-sm">{card.name}</p>
                  <div className={`text-[9px] font-bold uppercase tracking-wider mb-1 bg-gradient-to-r ${config.color} bg-clip-text text-transparent`}>
                    {config.label}
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="flex items-center gap-0.5">
                      <Heart className="w-2.5 h-2.5 text-rose-400" /> {card.stats.hp}
                    </span>
                    <span className="flex items-center gap-0.5">
                      <SwordsIcon className="w-2.5 h-2.5 text-amber-400" /> {card.stats.atk}
                    </span>
                  </div>
                </div>

                <button
                  onClick={() => toggleCardSelection(card)}
                  className="relative z-10 w-8 h-8 rounded-full bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 flex items-center justify-center transition-colors mr-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )
          })}
        </div>

        <button
          onClick={() => setShowTeamBuilder(true)}
          className={`w-full py-3 mb-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${glassButton} text-indigo-300`}
        >
          <Target className="w-4 h-4" /> Редактировать состав
        </button>

        {/* Strength forecast */}
        <div className="bg-black/30 rounded-2xl p-4 border border-white/5 space-y-4">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Сила отряда</div>
              <div className="text-2xl font-black text-white">{teamPower.totalPower.toLocaleString()}</div>
            </div>
            {selectedDungeon && enemyPower && (
              <div className="text-right">
                <div className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1">Сила врага</div>
                <div className="text-lg font-black text-rose-400">{enemyPower.totalPower.toLocaleString()}</div>
              </div>
            )}
          </div>

          {selectedDungeon && enemyPower && (
            <div className="pt-3 border-t border-white/5 flex items-center justify-between">
              <span className="text-xs text-slate-400 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5" /> Прогноз
              </span>
              <span
                className={`text-xs font-black uppercase tracking-wider px-2 py-0.5 rounded border ${
                  teamPower.totalPower >= enemyPower.totalPower * 1.2
                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    : teamPower.totalPower >= enemyPower.totalPower
                    ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                    : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}
              >
                {teamPower.totalPower >= enemyPower.totalPower * 1.2
                  ? "Легкая победа"
                  : teamPower.totalPower >= enemyPower.totalPower
                  ? "Равный бой"
                  : "Высокий риск"}
              </span>
            </div>
          )}
        </div>

        <button
          onClick={startBattle}
          disabled={
            selectedCards.length === 0 ||
            !selectedDungeon ||
            (progress ? progress.current_stamina < (selectedDungeon?.energy_cost || 0) : false)
          }
          className="w-full mt-6 py-4 bg-white text-black hover:bg-slate-200 disabled:bg-white/5 disabled:text-slate-500 disabled:cursor-not-allowed font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:shadow-none flex items-center justify-center gap-2"
        >
          <SwordsIcon className="w-5 h-5" />
          {selectedCards.length === 0
            ? "Собери отряд"
            : !selectedDungeon
            ? "Выбери цель"
            : progress && progress.current_stamina < selectedDungeon.energy_cost
            ? `Недостаточно энергии (${progress.current_stamina}/${selectedDungeon.energy_cost})`
            : "Начать бой"}
        </button>
      </div>

      {/* Logs history */}
      {logs.length > 0 && (
        <div className={`rounded-[2rem] p-6 ${glassCard}`}>
          <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">Сводка операций</h3>
          <div className="space-y-2">
            {logs.slice(0, 4).map((log) => (
              <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5">
                <div className="flex items-center gap-3">
                  <div
                    className={`p-1.5 rounded-lg ${
                      log.result === "win" ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
                    }`}
                  >
                    {log.result === "win" ? <Trophy className="w-3.5 h-3.5" /> : <Skull className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{log.result === "win" ? "Успешно" : "Провал"}</div>
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
  )
}
