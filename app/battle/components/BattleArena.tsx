import React from "react"
import { Swords, ArrowRight, Shield, Swords as SwordsIcon, Skull } from "lucide-react"
import { Card, Enemy, BattleProgress } from "../types"
import { glassCard } from "../config"
import { BattleResult, BattleAction } from "@/lib/battle-engine"

interface BattleArenaProps {
  battleResult: BattleResult
  battleActionIndex: number
  setBattleActionIndex: React.Dispatch<React.SetStateAction<number>>
  isAutoPlaying: boolean
  setIsAutoPlaying: React.Dispatch<React.SetStateAction<boolean>>
  battleSpeed: 1 | 2
  setBattleSpeed: React.Dispatch<React.SetStateAction<1 | 2>>
  setBattleState: (state: "idle" | "loading" | "battle" | "result") => void
  selectedCards: Card[]
  enemies: Enemy[]
  progress: BattleProgress | null
}

export const BattleArena: React.FC<BattleArenaProps> = ({
  battleResult,
  battleActionIndex,
  setBattleActionIndex,
  isAutoPlaying,
  setIsAutoPlaying,
  battleSpeed,
  setBattleSpeed,
  setBattleState,
  selectedCards,
  enemies,
  progress,
}) => {
  const currentAction = battleResult.actions[battleActionIndex]

  const getUnitHpAtActionIndex = (
    unit: { uniqueId: string; maxHp: number },
    actions: BattleAction[],
    actionIndex: number
  ) => {
    for (let i = actionIndex; i >= 0; i--) {
      if (actions[i]?.defenderId === unit.uniqueId) {
        return actions[i].defenderHpAfter
      }
    }
    return unit.maxHp
  }

  return (
    <div className={`w-full max-w-6xl mx-auto rounded-3xl ${glassCard} overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col`}>
      {/* Control Panel */}
      <div className="bg-white/[0.02] border-b border-white/5 p-4 flex flex-wrap gap-4 items-center justify-between backdrop-blur-md relative z-20">
        <div className="flex items-center gap-4">
          <div className="px-4 py-1.5 rounded-full bg-black/40 border border-white/10 shadow-inner">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-2">Ход</span>
            <span className="text-sm font-black text-white">{battleActionIndex + 1}</span>
            <span className="text-xs text-slate-500 ml-1">/ {battleResult.actions.length}</span>
          </div>
          <button
            onClick={() => setBattleSpeed((prev) => (prev === 1 ? 2 : 1))}
            className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase transition-all border ${
              battleSpeed === 2
                ? "bg-amber-500/20 text-amber-300 border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
            }`}
          >
            Ускорение x{battleSpeed}
          </button>
        </div>
        <button
          onClick={() => {
            setIsAutoPlaying(false)
            setBattleState("result")
          }}
          className="text-xs px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-xl transition-all flex items-center gap-2 font-medium"
        >
          Пропустить <ArrowRight className="w-3 h-3" />
        </button>
      </div>

      {/* Battle Arena Frame */}
      <div className="p-6 md:p-10 relative flex flex-col lg:grid lg:grid-cols-3 gap-8 lg:gap-12 bg-gradient-to-b from-transparent to-black/40">
        {/* === PLAYER TEAM (Left / Bottom on Mobile) === */}
        <div className="order-3 lg:order-1 flex flex-col gap-4">
          <div className="text-center lg:text-left">
            <span className="inline-flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">
              <Shield className="w-3 h-3" /> Твой отряд
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {battleResult.playerUnits.map((unit, i) => {
              const card = selectedCards[i]
              const isAttacker = currentAction?.attackerId === unit.uniqueId
              const isTarget = currentAction?.defenderId === unit.uniqueId && !currentAction.isPlayerAttack
              const currentHp = getUnitHpAtActionIndex(unit, battleResult.actions, battleActionIndex)
              const hpPercent = Math.max(0, (currentHp / unit.maxHp) * 100)
              const isDead = currentHp <= 0

              return (
                <div
                  key={unit.uniqueId}
                  className={`relative rounded-2xl p-3 flex items-center gap-4 transition-all duration-300 ${
                    isDead
                      ? "opacity-40 grayscale bg-black/40 border border-white/5"
                      : isAttacker
                      ? "scale-[1.02] bg-indigo-900/30 border border-indigo-500/40 shadow-[0_0_20px_rgba(99,102,241,0.2)] lg:translate-x-4"
                      : isTarget
                      ? "bg-rose-900/20 border border-rose-500/40 lg:-translate-x-2"
                      : "bg-white/[0.03] border border-white/10"
                  }`}
                >
                  <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10">
                    <img src={card?.imageUrl} className="w-full h-full object-cover" alt={unit.name} />
                    {isDead && (
                      <div className="absolute inset-0 bg-red-950/80 flex items-center justify-center">
                        <Skull className="w-6 h-6 text-red-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-black text-white truncate drop-shadow-md">{unit.name}</div>
                    <div className="text-[10px] text-indigo-300 font-bold mb-2">Ур. {progress?.level || 1}</div>
                    {/* HP Bar */}
                    <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5">
                      <div
                        className={`h-full transition-all duration-500 shadow-[0_0_10px_currentColor] ${
                          hpPercent > 50
                            ? "bg-emerald-400 text-emerald-400"
                            : hpPercent > 25
                            ? "bg-amber-400 text-amber-400"
                            : "bg-rose-500 text-rose-500"
                        }`}
                        style={{ width: `${hpPercent}%` }}
                      />
                    </div>
                    <div className="text-[9px] font-mono text-slate-400 mt-1 text-right">
                      {Math.max(0, currentHp)} / {unit.maxHp}
                    </div>
                  </div>
                  {isTarget && currentAction?.damage > 0 && (
                    <div className="absolute -right-2 lg:-right-6 top-1/2 -translate-y-1/2 text-xl font-black text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.8)] animate-in slide-in-from-top-4 fade-in duration-300">
                      -{currentAction.damage}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* === CENTER ACTION WINDOW === */}
        <div className="order-2 lg:order-2 flex items-center justify-center min-h-[250px] relative z-10">
          {currentAction ? (
            <div className="w-full max-w-sm relative flex flex-col items-center text-center p-6 lg:p-8 rounded-[2rem] bg-black/40 backdrop-blur-md border border-white/10 shadow-2xl">
              <div
                className={`absolute inset-0 rounded-[2rem] opacity-20 transition-all duration-500 ${
                  currentAction.isPlayerAttack
                    ? "bg-gradient-to-r from-indigo-500 to-transparent"
                    : "bg-gradient-to-l from-rose-500 to-transparent"
                }`}
              />

              <div className="relative z-10 w-full flex flex-col items-center">
                <div
                  className={`text-xs font-black uppercase tracking-widest mb-1 ${
                    currentAction.isPlayerAttack ? "text-indigo-400" : "text-rose-400"
                  }`}
                >
                  {currentAction.attackerName}
                </div>
                <div className="inline-flex items-center gap-1.5 text-[10px] font-bold text-slate-300 bg-white/5 px-3 py-1 rounded-full mb-6 border border-white/5">
                  <SwordsIcon className="w-3 h-3 text-slate-400" />
                  {currentAction.abilityUsed || "Базовая атака"}
                </div>

                <div className="h-24 flex items-center justify-center mb-4">
                  {currentAction.isDodged ? (
                    <div className="animate-in zoom-in duration-300 flex flex-col items-center">
                      <span className="text-3xl mb-1">💨</span>
                      <span className="text-xl font-black text-slate-400 uppercase tracking-widest drop-shadow-lg">
                        Промах
                      </span>
                    </div>
                  ) : (
                    <div className="animate-in zoom-in scale-110 duration-300 flex flex-col items-center">
                      <span
                        className={`text-5xl lg:text-6xl font-black drop-shadow-[0_0_20px_currentColor] ${
                          currentAction.isPlayerAttack ? "text-white" : "text-rose-500"
                        }`}
                      >
                        -{currentAction.damage}
                      </span>
                      {currentAction.isCritical && (
                        <span className="text-xs font-black text-amber-400 uppercase tracking-widest mt-2 animate-pulse drop-shadow-[0_0_8px_rgba(251,191,36,0.5)] bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          Критический!
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="w-full pt-4 border-t border-white/10 flex flex-col items-center">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest mb-1">Цель</span>
                  <span
                    className={`text-sm font-black truncate max-w-full ${
                      currentAction.isPlayerAttack ? "text-rose-400" : "text-indigo-400"
                    }`}
                  >
                    {currentAction.defenderName}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-slate-600 font-black text-xl uppercase tracking-widest animate-pulse">Анализ...</div>
          )}
        </div>

        {/* === ENEMY TEAM (Right / Top on Mobile) === */}
        <div className="order-1 lg:order-3 flex flex-col gap-4">
          <div className="text-center lg:text-right">
            <span className="inline-flex items-center gap-2 text-[10px] font-black text-rose-400 uppercase tracking-widest bg-rose-500/10 px-3 py-1 rounded-full border border-rose-500/20">
              Враги <Skull className="w-3 h-3" />
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {battleResult.enemyUnits.map((unit, i) => {
              const enemy = enemies[i]
              const isAttacker = currentAction?.attackerId === unit.uniqueId
              const isTarget = currentAction?.defenderId === unit.uniqueId && currentAction.isPlayerAttack
              const currentHp = getUnitHpAtActionIndex(unit, battleResult.actions, battleActionIndex)
              const hpPercent = Math.max(0, (currentHp / unit.maxHp) * 100)
              const isDead = currentHp <= 0

              return (
                <div
                  key={unit.uniqueId}
                  className={`relative rounded-2xl p-3 flex flex-row-reverse lg:flex-row items-center gap-4 transition-all duration-300 ${
                    isDead
                      ? "opacity-40 grayscale bg-black/40 border border-white/5"
                      : isAttacker
                      ? "scale-[1.02] bg-rose-900/30 border border-rose-500/40 shadow-[0_0_20px_rgba(244,63,94,0.2)] lg:-translate-x-4"
                      : isTarget
                      ? "bg-indigo-900/20 border border-indigo-500/40 lg:translate-x-2"
                      : "bg-white/[0.03] border border-white/10"
                  }`}
                >
                  <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black">
                    {enemy?.image_url ? (
                      <img src={enemy.image_url} className="w-full h-full object-cover" alt={unit.name} />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-2xl">👹</div>
                    )}
                    {isDead && (
                      <div className="absolute inset-0 bg-red-950/80 flex items-center justify-center">
                        <Skull className="w-6 h-6 text-red-500" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-right lg:text-left">
                    <div className="text-sm font-black text-white truncate drop-shadow-md">{unit.name}</div>
                    <div className="text-[10px] text-rose-400 font-bold mb-2">Ур. {enemy?.level || 1}</div>
                    <div className="h-1.5 bg-black/60 rounded-full overflow-hidden border border-white/5 transform rotate-180 lg:rotate-0">
                      <div
                        className={`h-full transition-all duration-500 shadow-[0_0_10px_currentColor] ${
                          hpPercent > 50
                            ? "bg-rose-500 text-rose-500"
                            : hpPercent > 25
                            ? "bg-orange-500 text-orange-500"
                            : "bg-red-700 text-red-700"
                        }`}
                        style={{ width: `${hpPercent}%` }}
                      />
                    </div>
                    <div className="text-[9px] font-mono text-slate-400 mt-1 text-left lg:text-right">
                      {Math.max(0, currentHp)} / {unit.maxHp}
                    </div>
                  </div>
                  {isTarget && currentAction?.damage > 0 && (
                    <div className="absolute -left-2 lg:-left-6 top-1/2 -translate-y-1/2 text-xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)] animate-in slide-in-from-top-4 fade-in duration-300">
                      -{currentAction.damage}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
