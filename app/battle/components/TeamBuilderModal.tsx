import React from "react"
import { X, ShieldHalf, CheckCircle2, Heart, Swords as SwordsIcon, Shield, Zap, Star } from "lucide-react"
import { Card } from "../types"
import { rarityConfig } from "@/types/gacha"
import { DECK_SIZE, ROLE_CONFIG, PROVISION_LIMIT } from "../config"
import { BattleCard } from "./BattleCard"

interface TeamBuilderModalProps {
  showTeamBuilder: boolean
  setShowTeamBuilder: (show: boolean) => void
  selectedCards: Card[]
  toggleCardSelection: (card: Card) => void
  teamSearch: string
  setTeamSearch: (search: string) => void
  selectedRole: string
  setSelectedRole: (role: any) => void
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
  selectedRole,
  setSelectedRole,
  sortBy,
  setSortBy,
  filteredCards,
}) => {
  if (!showTeamBuilder) return null

  const totalProvisionUsed = selectedCards.reduce((acc, c) => acc + (c.provisionCost || 4), 0)

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
            <p className="text-sm text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span>Сборка колоды: <span className="text-indigo-400 font-bold">{selectedCards.length} / {DECK_SIZE}</span> карт</span>
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700 hidden sm:inline" />
              <span>Вес колоды: <span className={`font-bold ${totalProvisionUsed > PROVISION_LIMIT ? 'text-rose-400' : 'text-emerald-400'}`}>{totalProvisionUsed} / {PROVISION_LIMIT}</span></span>
            </p>
          </div>
          <button
            onClick={() => setShowTeamBuilder(false)}
            className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0">
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

        {/* Фильтр по ролям */}
        <div className="flex flex-col md:flex-row gap-3 mb-6 shrink-0 bg-white/[0.02] border border-white/5 p-3 rounded-2xl md:items-center md:justify-between">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedRole("all")}
              className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all ${
                selectedRole === "all"
                  ? "bg-white text-black font-black"
                  : "bg-white/5 text-slate-400 hover:text-white hover:bg-white/10"
              }`}
            >
              Все роли
            </button>
            {Object.entries(ROLE_CONFIG).map(([key, config]) => {
              const isSelected = selectedRole === key
              return (
                <button
                  key={key}
                  onClick={() => setSelectedRole(key as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border ${
                    isSelected
                      ? `${config.bg} ${config.color} ${config.border} font-black shadow-[0_0_15px_rgba(255,255,255,0.05)]`
                      : "bg-white/5 text-slate-400 border-transparent hover:text-white hover:bg-white/10"
                  }`}
                >
                  <span className={config.color}>●</span>
                  {config.name}
                </button>
              )
            })}
          </div>
          <div className="text-[10px] text-slate-500 font-bold max-w-sm leading-relaxed">
            💡 <span className="text-slate-400 font-semibold">Роль (тип) карты</span> присваивается по наивысшему стату: <span className="text-rose-400">ATK</span> → Авангард, <span className="text-blue-400">HP/DEF</span> → Страж, <span className="text-amber-400">SPD/LUCK</span> → Плут.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1 pb-4">
          {filteredCards.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
              <ShieldHalf className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-bold">Коллекция пуста или не найдено совпадений</p>
            </div>
          )}
          {filteredCards.map((card) => {
            const isSelected = selectedCards.some((c) => c.uniqueId === card.uniqueId)
            const config = rarityConfig[card.rarity] || { bg: "from-slate-500 to-slate-700", color: "text-slate-400", label: "Обычная" }
            const role = card.role || "vanguard"
            const roleConf = ROLE_CONFIG[role] || ROLE_CONFIG.vanguard

            return (
              <button
                key={card.uniqueId}
                onClick={() => toggleCardSelection(card)}
                disabled={!isSelected && selectedCards.length >= DECK_SIZE}
                className={"relative text-left rounded-2xl p-2.5 border transition-all duration-200 flex items-center gap-3.5 " + (
                  isSelected
                    ? "bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                    : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                )}
              >
                {/* Visual Thumbnail (BattleCard sm) */}
                <div className="relative w-[50px] sm:w-[56px] aspect-[2/3] shrink-0 rounded-lg overflow-hidden shadow-lg">
                  <BattleCard
                    card={card}
                    size="sm"
                    className="w-full h-full"
                    isInteractive={false}
                    showPower={false}
                  />
                  {isSelected && (
                    <div className="absolute inset-0 bg-indigo-500/40 backdrop-blur-[0.5px] rounded-lg flex items-center justify-center z-30">
                      <CheckCircle2 className="w-5 h-5 text-white drop-shadow-md animate-bounce" />
                    </div>
                  )}
                </div>

                {/* Details Column */}
                <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                  <div className="flex items-start justify-between gap-1">
                    <p className="text-xs sm:text-sm font-black text-white truncate drop-shadow-sm flex-1">{card.name}</p>
                    <div className="text-right shrink-0 flex items-center gap-1 bg-indigo-950/80 border border-indigo-500/20 px-1.5 py-0.5 rounded shadow-sm">
                      <span className="text-[7px] text-slate-400 font-bold uppercase">Вес</span>
                      <span className="text-xs font-black text-indigo-300 leading-none">{card.provisionCost || 4}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 items-center mt-1 mb-1.5">
                    <span className={"text-[8px] font-black uppercase tracking-wider bg-gradient-to-r " + config.color + " bg-clip-text text-transparent"}>
                      {config.label}
                    </span>
                    <span className={"text-[8px] px-1.5 py-0.5 rounded " + roleConf.bg + " " + roleConf.color + " " + roleConf.border + " border font-black uppercase tracking-wider"}>
                      {roleConf.name}
                    </span>
                  </div>

                  {/* Complete comparative numeric stats */}
                  <div className="grid grid-cols-5 gap-1.5 text-[9px] font-bold text-slate-300 bg-black/20 p-1 rounded-md border border-white/5">
                    <span className="flex items-center gap-0.5 justify-center" title="HP">
                      <Heart className="w-2.5 h-2.5 text-rose-500" /> {card.stats.hp}
                    </span>
                    <span className="flex items-center gap-0.5 justify-center" title="ATK">
                      <SwordsIcon className="w-2.5 h-2.5 text-orange-400" /> {card.stats.atk}
                    </span>
                    <span className="flex items-center gap-0.5 justify-center" title="DEF">
                      <Shield className="w-2.5 h-2.5 text-blue-400" /> {card.stats.def}
                    </span>
                    <span className="flex items-center gap-0.5 justify-center" title="SPD">
                      <Zap className="w-2.5 h-2.5 text-emerald-400" /> {card.stats.spd}
                    </span>
                    <span className="flex items-center gap-0.5 justify-center" title="LUCK">
                      <Star className="w-2.5 h-2.5 text-yellow-400 fill-yellow-400" /> {card.stats.luck || 0}
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-white/10 shrink-0 flex flex-col gap-3">
          {totalProvisionUsed > PROVISION_LIMIT && (
            <div className="text-xs text-rose-400 font-bold bg-rose-500/10 border border-rose-500/20 rounded-xl px-4 py-2.5 text-center">
              ⚠️ Общий вес превышает {PROVISION_LIMIT} очков ({totalProvisionUsed} / {PROVISION_LIMIT}). Вы можете подтвердить выбор, но перед началом дуэли вам потребуется убрать лишний вес или сделать замену.
            </div>
          )}
          <button
            onClick={() => setShowTeamBuilder(false)}
            className="w-full py-4 bg-white text-black hover:bg-slate-200 font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)]"
          >
            Подтвердить выбор ({selectedCards.length} / {DECK_SIZE})
          </button>
        </div>
      </div>
    </div>
  )
};