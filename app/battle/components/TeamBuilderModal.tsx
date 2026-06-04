import React from "react"
import { X, ShieldHalf, CheckCircle2, Heart, Swords as SwordsIcon, Shield, Zap } from "lucide-react"
import { Card } from "../types"
import { rarityConfig } from "@/types/gacha"

interface TeamBuilderModalProps {
  showTeamBuilder: boolean
  setShowTeamBuilder: (show: boolean) => void
  selectedCards: Card[]
  toggleCardSelection: (card: Card) => void
  teamSearch: string
  setTeamSearch: (search: string) => void
  sortBy: "power" | "rarity" | "hp" | "atk"
  setSortBy: (sort: "power" | "rarity" | "hp" | "atk") => void
  filteredCards: Card[]
}

export const TeamBuilderModal: React.FC<TeamBuilderModalProps> = ({
  showTeamBuilder,
  setShowTeamBuilder,
  selectedCards,
  toggleCardSelection,
  teamSearch,
  setTeamSearch,
  sortBy,
  setSortBy,
  filteredCards,
}) => {
  if (!showTeamBuilder) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={() => setShowTeamBuilder(false)}
    >
      <div
        className="bg-[#0a0a0f]/90 border border-white/10 rounded-[2rem] p-6 max-w-4xl w-full max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-white">Казармы</h2>
            <p className="text-sm text-slate-400 mt-1">
              Выбрано бойцов: <span className="text-indigo-400 font-bold">{selectedCards.length}/3</span>
            </p>
          </div>
          <button
            onClick={() => setShowTeamBuilder(false)}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-6 shrink-0">
          <input
            type="text"
            placeholder="Поиск по имени / аниме..."
            value={teamSearch}
            onChange={(e) => setTeamSearch(e.target.value)}
            className="flex-1 h-12 rounded-xl bg-black/50 border border-white/10 px-4 text-sm text-white focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/50 transition-all placeholder:text-slate-600"
          />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-12 rounded-xl bg-black/50 border border-white/10 px-4 text-sm text-white focus:outline-none cursor-pointer"
          >
            <option value="power">Сортировка: Сила</option>
            <option value="rarity">Сортировка: Редкость</option>
            <option value="hp">Сортировка: Здоровье</option>
            <option value="atk">Сортировка: Атака</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1 pb-4">
          {filteredCards.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
              <ShieldHalf className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-bold">Коллекция пуста или не найдено совпадений</p>
            </div>
          )}
          {filteredCards.map((card) => {
            const isSelected = selectedCards.some((c) => c.uniqueId === card.uniqueId)
            const config = rarityConfig[card.rarity] || { bg: "from-slate-500 to-slate-700", color: "text-slate-400", label: "Обычная" }

            return (
              <button
                key={card.uniqueId}
                onClick={() => toggleCardSelection(card)}
                disabled={!isSelected && selectedCards.length >= 3}
                className={`relative text-left rounded-2xl p-3 border transition-all duration-200 flex items-center gap-4 ${
                  isSelected
                    ? "bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                    : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                }`}
              >
                <div className="relative w-14 h-20 rounded-xl overflow-hidden shrink-0 shadow-lg">
                  <img src={card.imageUrl} className="w-full h-full object-cover" alt={card.name} />
                  <div className={`absolute bottom-0 inset-x-0 h-1 bg-gradient-to-r ${config.color}`} />
                  {isSelected && (
                    <div className="absolute inset-0 bg-indigo-500/40 backdrop-blur-[2px] flex items-center justify-center">
                      <CheckCircle2 className="w-6 h-6 text-white drop-shadow-md" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-white truncate drop-shadow-sm">{card.name}</p>
                  <p className={`text-[9px] font-bold uppercase tracking-wider mb-2 bg-gradient-to-r ${config.color} bg-clip-text text-transparent`}>
                    {config.label}
                  </p>
                  <div className="grid grid-cols-2 gap-y-1 text-[10px] font-medium text-slate-300">
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3 text-rose-400" /> {card.stats.hp}
                    </span>
                    <span className="flex items-center gap-1">
                      <SwordsIcon className="w-3 h-3 text-amber-400" /> {card.stats.atk}
                    </span>
                    <span className="flex items-center gap-1">
                      <Shield className="w-3 h-3 text-blue-400" /> {card.stats.def}
                    </span>
                    <span className="flex items-center gap-1">
                      <Zap className="w-3 h-3 text-emerald-400" /> {card.stats.spd}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-white/10 shrink-0">
          <button
            onClick={() => setShowTeamBuilder(false)}
            className="w-full py-4 bg-white text-black hover:bg-slate-200 font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            Подтвердить выбор ({selectedCards.length})
          </button>
        </div>
      </div>
    </div>
  )
}
