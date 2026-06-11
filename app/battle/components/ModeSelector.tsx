import React from "react"
import { Swords, Mountain, Trophy, Zap, AlertCircle, Lock } from "lucide-react"
import { glassCard } from "../config"

interface ModeSelectorProps {
  onPvEMode: () => void
  onPvPMode: () => void
  isPvPAvailable?: boolean
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  onPvEMode,
  onPvPMode,
  isPvPAvailable = true,
}) => {
  return (
    <div className="flex flex-col gap-4">
      <div className="text-center mb-4">
        <h2 className="text-2xl font-black text-white flex items-center justify-center gap-3 drop-shadow-sm">
          <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            <Swords className="w-5 h-5" />
          </span>
          Выбор Режима
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PVE Mode Card */}
        <button
          onClick={onPvEMode}
          className="relative text-left rounded-[1.5rem] p-6 overflow-hidden transition-all duration-300 group bg-white/[0.02] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 hover:shadow-lg backdrop-blur-md"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-600/20 via-blue-600/20 to-cyan-600/20 opacity-50" />

          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-start justify-between mb-4">
              <div className="p-3 rounded-xl bg-indigo-500/20 border border-indigo-500/30 backdrop-blur-sm shadow-inner">
                <Mountain className="w-6 h-6 text-indigo-400" />
              </div>
              <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-black text-yellow-400">PVE</span>
              </div>
            </div>

            <div className="mb-auto">
              <h3 className="text-xl font-black text-white mb-2 drop-shadow-md">PvE Битвы</h3>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-3">
                Против ИИ
              </div>
              <p className="text-sm text-slate-400/80 line-clamp-2 leading-relaxed mb-4">
                Сразитесь с ИИ в различных локациях. Получайте монеты, опыт и пыль!
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                <Mountain className="w-4 h-4 text-indigo-400" />
                <span className="text-[11px] font-bold text-slate-300">Локации</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                <Zap className="w-4 h-4 text-yellow-400" />
                <span className="text-[11px] font-bold text-slate-300">Награды</span>
              </div>
            </div>
          </div>
        </button>

        {/* PvP Mode Card */}
        <button
          onClick={isPvPAvailable ? onPvPMode : undefined}
          disabled={!isPvPAvailable}
          className={`relative text-left rounded-[1.5rem] p-6 overflow-hidden transition-all duration-300 group backdrop-blur-md ${
            isPvPAvailable 
              ? 'bg-white/[0.02] border border-white/10 hover:bg-white/[0.06] hover:border-white/20 hover:shadow-lg cursor-pointer'
              : 'bg-black/30 border border-white/5 opacity-50 cursor-not-allowed'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-purple-600/30 via-pink-600/30 to-red-600/30 opacity-50" />

          {isPvPAvailable ? (
            <div className="absolute top-0 right-0 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-bl-xl shadow-lg z-10">
              Онлайн
            </div>
          ) : (
            <div className="absolute top-0 right-0 bg-gradient-to-r from-red-500 to-orange-500 text-white text-[10px] font-black uppercase px-4 py-1.5 rounded-bl-xl shadow-lg z-10 flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              Недоступно
            </div>
          )}

          <div className="relative z-10 flex flex-col h-full">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-3 rounded-xl backdrop-blur-sm shadow-inner ${
                isPvPAvailable 
                  ? 'bg-purple-500/20 border border-purple-500/30'
                  : 'bg-slate-500/20 border border-slate-500/30'
              }`}>
                <Swords className={`w-6 h-6 ${isPvPAvailable ? 'text-purple-400' : 'text-slate-400'}`} />
              </div>
              <div className="flex items-center gap-1.5 bg-black/40 px-3 py-1.5 rounded-lg border border-white/5">
                <Trophy className="w-4 h-4 text-yellow-400" />
                <span className="text-xs font-black text-yellow-400">MMR</span>
              </div>
            </div>

            <div className="mb-auto">
              <h3 className="text-xl font-black text-white mb-2 drop-shadow-md">Арена PvP</h3>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-3">
                Рейтинговый бой
              </div>
              {isPvPAvailable ? (
                <p className="text-sm text-slate-400/80 line-clamp-2 leading-relaxed mb-4">
                  Сразитесь с реальными игроками в онлайн-битве! Побеждайте и поднимайтесь в рейтинге.
                </p>
              ) : (
                <div className="flex items-start gap-2 mb-4">
                  <Lock className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300/90 leading-relaxed">
                    PvP сервер недоступен. Ведутся технические работы. Попробуйте позже.
                  </p>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 pt-4 border-t border-white/5">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                <Trophy className={`w-4 h-4 ${isPvPAvailable ? 'text-purple-400' : 'text-slate-400'}`} />
                <span className="text-[11px] font-bold text-slate-300">Рейтинг</span>
              </div>
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/40 border border-white/5">
                <Swords className={`w-4 h-4 ${isPvPAvailable ? 'text-pink-400' : 'text-slate-400'}`} />
                <span className="text-[11px] font-bold text-slate-300">Онлайн</span>
              </div>
            </div>
          </div>
        </button>
      </div>
    </div>
  )
}
