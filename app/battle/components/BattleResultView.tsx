import React from "react"
import { Trophy, Skull, Coins, Sparkles, Star, Crown, RotateCcw } from "lucide-react"
import { BattleResult } from "@/lib/battle-engine"

interface BattleResultViewProps {
  battleResult: BattleResult
  finishBattle: () => Promise<void> | void
}

export const BattleResultView: React.FC<BattleResultViewProps> = ({
  battleResult,
  finishBattle,
}) => {
  return (
    <div className="max-w-3xl mx-auto relative animate-in fade-in zoom-in-95 duration-700">
      {/* Decorative Glow */}
      <div
        className={`absolute -inset-4 rounded-3xl blur-2xl opacity-50 ${
          battleResult.victory ? "bg-emerald-500/20" : "bg-rose-500/20"
        }`}
      />

      <div
        className={`relative rounded-3xl p-8 md:p-12 backdrop-blur-2xl border flex flex-col items-center text-center shadow-2xl ${
          battleResult.victory
            ? "bg-emerald-950/40 border-emerald-500/30"
            : "bg-rose-950/40 border-rose-500/30"
        }`}
      >
        <div className="mb-8">
          <div
            className={`inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 shadow-2xl ${
              battleResult.victory
                ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/50"
                : "bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/50"
            }`}
          >
            {battleResult.victory ? <Trophy className="w-12 h-12 text-white" /> : <Skull className="w-12 h-12 text-white" />}
          </div>
          <h2
            className={`text-4xl md:text-5xl font-black uppercase tracking-widest drop-shadow-lg ${
              battleResult.victory ? "text-emerald-300" : "text-rose-300"
            }`}
          >
            {battleResult.victory ? "Победа" : "Поражение"}
          </h2>
          <p className="text-slate-400 mt-2 font-medium">Сражение завершено за {battleResult.turns} ходов</p>
        </div>

        {/* Rewards */}
        {battleResult.victory && (
          <div className="grid grid-cols-3 gap-3 md:gap-6 w-full max-w-md mb-10">
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/40 border border-yellow-500/20 shadow-inner">
              <Coins className="w-6 h-6 text-yellow-400 mb-2 drop-shadow-md" />
              <span className="text-2xl font-black text-yellow-400">+{battleResult.coinsEarned}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold mt-1">Монеты</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/40 border border-amber-500/20 shadow-inner">
              <Sparkles className="w-6 h-6 text-amber-400 mb-2 drop-shadow-md" />
              <span className="text-2xl font-black text-amber-400">+{battleResult.dustEarned}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold mt-1">Пыль</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/40 border border-blue-500/20 shadow-inner">
              <Star className="w-6 h-6 text-blue-400 mb-2 drop-shadow-md" />
              <span className="text-2xl font-black text-blue-400">+{battleResult.xpEarned}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold mt-1">Опыт</span>
            </div>
          </div>
        )}

        {/* MVP Card Highlight */}
        {battleResult.victory && battleResult.mvpCard && (
          <div className="w-full max-w-md mb-10 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-transparent to-purple-500/10 border border-white/10 backdrop-blur-md">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">MVP Матча</span>
            </div>
            <div className="text-xl font-black text-white mb-1">{battleResult.mvpCard.name}</div>
            <div className="text-sm font-medium text-amber-200 bg-black/30 inline-block px-3 py-1 rounded-full border border-white/5">
              Нанесено урона: {battleResult.mvpCard.totalDamageDealt.toLocaleString()}
            </div>
          </div>
        )}

        <button
          onClick={finishBattle}
          className="w-full max-w-sm py-4 bg-white text-black hover:bg-slate-200 font-black uppercase tracking-widest rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2"
        >
          <RotateCcw className="w-5 h-5" />
          Продолжить
        </button>
      </div>
    </div>
  )
}
