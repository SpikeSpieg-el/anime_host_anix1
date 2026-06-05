import React from "react"
import { Trophy, Skull, Coins, Sparkles, Star, Crown, RotateCcw, Loader2 } from "lucide-react"
import { CCGBattleState } from "../types"

interface BattleResultViewProps {
  ccgState: CCGBattleState | null
  finishBattle: () => Promise<void> | void
  isFinishing?: boolean
}

export const BattleResultView: React.FC<BattleResultViewProps> = ({
  ccgState,
  finishBattle,
  isFinishing = false,
}) => {
  if (!ccgState) return null

  const isVictory = ccgState.victory

  return (
    <div className="max-w-3xl lg:max-w-5xl mx-auto relative animate-in fade-in zoom-in-95 duration-700">
      {/* Decorative Glow */}
      <div
        className={"absolute -inset-4 rounded-3xl blur-2xl opacity-50 " + (
          isVictory ? "bg-emerald-500/20" : "bg-rose-500/20"
        )}
      />

      <div
        className={"relative rounded-3xl p-8 md:p-12 backdrop-blur-2xl border flex flex-col items-center text-center shadow-2xl " + (
          isVictory
            ? "bg-emerald-950/40 border-emerald-500/30"
            : "bg-rose-950/40 border-rose-500/30"
        )}
      >
        <div className="mb-8">
          <div
            className={"inline-flex items-center justify-center w-24 h-24 rounded-full mb-6 shadow-2xl " + (
              isVictory
                ? "bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/50"
                : "bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/50"
            )}
          >
            {isVictory ? <Trophy className="w-12 h-12 text-white" /> : <Skull className="w-12 h-12 text-white" />}
          </div>
          <h2
            className={"text-4xl md:text-5xl font-black uppercase tracking-widest drop-shadow-lg " + (
              isVictory ? "text-emerald-300" : "text-rose-300"
            )}
          >
            {isVictory ? "Победа" : "Поражение"}
          </h2>
          <p className="text-slate-400 mt-2 font-medium">Сражение завершено за 3 тактических раунда</p>
        </div>

        {/* Rewards */}
        {isVictory && (
          <div className="grid grid-cols-3 gap-3 md:gap-6 w-full max-w-md mb-10">
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/40 border border-yellow-500/20 shadow-inner animate-in slide-in-from-bottom-4 duration-500 delay-100">
              <Coins className="w-6 h-6 text-yellow-400 mb-2 drop-shadow-md animate-bounce" style={{ animationDuration: '2s' }} />
              <span className="text-2xl font-black text-yellow-400">+{ccgState.coinsEarned || 0}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold mt-1">Монеты</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/40 border border-amber-500/20 shadow-inner animate-in slide-in-from-bottom-4 duration-500 delay-200">
              <Sparkles className="w-6 h-6 text-amber-400 mb-2 drop-shadow-md animate-pulse" />
              <span className="text-2xl font-black text-amber-400">+{ccgState.dustEarned || 0}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold mt-1">Пыль</span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-black/40 border border-blue-500/20 shadow-inner animate-in slide-in-from-bottom-4 duration-500 delay-300">
              <Star className="w-6 h-6 text-blue-400 mb-2 drop-shadow-md animate-spin" style={{ animationDuration: '3s' }} />
              <span className="text-2xl font-black text-blue-400">+{ccgState.xpEarned || 0}</span>
              <span className="text-[10px] text-slate-400 uppercase font-bold mt-1">Опыт</span>
            </div>
          </div>
        )}

        {/* MVP Card Highlight */}
        {isVictory && ccgState.mvpCard && (
          <div className="w-full max-w-md mb-10 p-5 rounded-2xl bg-gradient-to-r from-amber-500/10 via-transparent to-purple-500/10 border border-white/10 backdrop-blur-md">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Crown className="w-4 h-4 text-amber-400" />
              <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">MVP Матча</span>
            </div>
            <div className="text-xl font-black text-white mb-1">{ccgState.mvpCard.name}</div>
            <div className="text-sm font-medium text-amber-200 bg-black/30 inline-block px-3 py-1 rounded-full border border-white/5">
              Итоговая сила на линии: {ccgState.mvpCard.power}
            </div>
          </div>
        )}

        <button
          onClick={finishBattle}
          disabled={isFinishing}
          className="w-full max-w-sm py-4 bg-white text-black hover:bg-slate-200 disabled:bg-slate-400 disabled:cursor-not-allowed font-black uppercase tracking-widest rounded-2xl transition-all hover:scale-105 active:scale-95 disabled:hover:scale-100 disabled:active:scale-100 shadow-[0_0_20px_rgba(255,255,255,0.3)] flex items-center justify-center gap-2 relative"
        >
          {isFinishing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Сохранение...
            </>
          ) : (
            <>
              <RotateCcw className="w-5 h-5" />
              Продолжить
            </>
          )}
        </button>
      </div>
    </div>
  )
};