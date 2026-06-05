import React, { useState } from "react"
import Image from "next/image"
import Link from "next/link"
import { X, ShieldHalf, CheckCircle2, Heart, Swords as SwordsIcon, Shield, Zap, Star, Crown, Sparkles, HelpCircle } from "lucide-react"
import { Card, DeckSynergy } from "../types"
import { rarityConfig } from "@/types/gacha"
import { DECK_SIZE, ROLE_CONFIG, PROVISION_LIMIT, SYNERGY_DEFINITIONS } from "../config"
import { getCardProvision, getCardBasePower } from "../utils"

interface TeamBuilderModalProps {
  showTeamBuilder: boolean
  setShowTeamBuilder: (show: boolean) => void
  selectedCards: Card[]
  toggleCardSelection: (card: Card) => void
  teamSearch: string
  setTeamSearch: (search: string) => void
  selectedRole: string
  setSelectedRole: (role: any) => void
  sortBy: "default" | "power" | "rarity" | "provision" | "name" | "anime"
  setSortBy: (sort: "default" | "power" | "rarity" | "provision" | "name" | "anime") => void
  filteredCards: Card[]
  leaderId: string | null
  setLeaderId: (id: string | null) => void
  activeSynergies: DeckSynergy[]
  onCardClick?: (card: Card) => void
}

const isPinterestUrl = (url: string) => url?.includes("i.pinimg.com") || url?.includes("pinimg.com")

const getProxiedSrc = (url: string) => {
  if (!url) return ""
  if (isPinterestUrl(url)) return `/api/image-proxy?url=${encodeURIComponent(url)}`
  return url
}

export const TeamBuilderModal: React.FC<TeamBuilderModalProps> = ({
  showTeamBuilder,
  setShowTeamBuilder,
  selectedCards,
  toggleCardSelection,
  onCardClick,
  teamSearch,
  setTeamSearch,
  selectedRole,
  setSelectedRole,
  sortBy,
  setSortBy,
  filteredCards,
  leaderId,
  setLeaderId,
  activeSynergies,
}) => {
  if (!showTeamBuilder) return null

  const [showHelpModal, setShowHelpModal] = useState(false)
  const [mobileViewMode, setMobileViewMode] = useState<"single" | "double">("single")
  const [showSelectedFirst, setShowSelectedFirst] = useState(false)
  const totalProvisionUsed = selectedCards.reduce((acc, c) => acc + (c.provisionCost || getCardProvision(c)), 0)

  // Сортируем: сначала выбранные карты, потом остальные по фильтрам (только если включен режим)
  const sortedCards = [...filteredCards].sort((a, b) => {
    if (!showSelectedFirst) return 0
    
    const aSelected = selectedCards.some(c => c.uniqueId === a.uniqueId)
    const bSelected = selectedCards.some(c => c.uniqueId === b.uniqueId)
    
    if (aSelected && !bSelected) return -1
    if (!aSelected && bSelected) return 1
    
    // Если обе выбраны или обе не выбраны - сохраняем текущий порядок фильтрации
    return 0
  })

  // Группируем по тайтлам при сортировке по anime
  const groupedCards = sortBy === "anime" ? (() => {
    const groups: { anime: string; cards: Card[] }[] = []
    const animeMap = new Map<string, Card[]>()
    
    sortedCards.forEach(card => {
      const anime = card.anime || "Unknown"
      if (!animeMap.has(anime)) {
        animeMap.set(anime, [])
      }
      animeMap.get(anime)!.push(card)
    })
    
    animeMap.forEach((cards, anime) => {
      groups.push({ anime, cards })
    })
    
    // Сортируем группы по названию аниме
    groups.sort((a, b) => a.anime.localeCompare(b.anime))
    
    return groups
  })() : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xl animate-in fade-in duration-200"
      onClick={() => setShowTeamBuilder(false)}
    >
      <div
        className="bg-[#0a0a0f]/90 border border-white/10 rounded-[2rem] p-6 max-w-4xl lg:max-w-6xl w-full max-h-[90vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div>
            <h2 className="text-2xl font-black text-white">Казармы</h2>
            <p className="text-sm text-slate-400 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-700 hidden sm:inline" />
              <span>Вес колоды: <span className={`font-bold ${totalProvisionUsed > PROVISION_LIMIT ? 'text-rose-400' : 'text-emerald-400'}`}>{totalProvisionUsed} / {PROVISION_LIMIT}</span></span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHelpModal(true)}
              className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Справка"
            >
              <HelpCircle className="w-6 h-6" />
            </button>
            <button
              onClick={() => setShowTeamBuilder(false)}
              className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-6 shrink-0">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="h-12 rounded-xl bg-black/50 border border-white/10 px-4 text-sm text-white focus:outline-none cursor-pointer flex-1 min-w-[140px]"
          >
            <option value="default">По умолчанию</option>
            <option value="power">По силе</option>
            <option value="rarity">По редкости</option>
            <option value="provision">По весу</option>
            <option value="name">По имени</option>
            <option value="anime">По тайтлам</option>
          </select>
          <button
            onClick={() => setMobileViewMode(mobileViewMode === "single" ? "double" : "single")}
            className="sm:hidden h-12 px-4 rounded-xl bg-white/5 border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
            title={mobileViewMode === "single" ? "2 колонки" : "1 колонка"}
          >
            {mobileViewMode === "single" ? (
              <div className="flex gap-1">
                <div className="w-1.5 h-3 bg-current rounded-sm" />
                <div className="w-1.5 h-3 bg-current rounded-sm" />
              </div>
            ) : (
              <div className="w-1.5 h-3 bg-current rounded-sm" />
            )}
          </button>
          <button
            onClick={() => setShowSelectedFirst(!showSelectedFirst)}
            className={`h-12 px-4 rounded-xl border transition-colors ${
              showSelectedFirst
                ? "bg-indigo-500/20 border-indigo-500/50 text-indigo-400"
                : "bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10"
            }`}
            title="Сначала выбранные карты"
          >
            <CheckCircle2 className="w-5 h-5" />
          </button>
          <button
            onClick={() => setSelectedRole("all")}
            className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex-1 ${
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
                className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border flex-1 ${
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

        <div className={`grid gap-3 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent flex-1 pb-4 ${
          mobileViewMode === "double" ? "grid-cols-2" : "grid-cols-1"
        } md:grid-cols-2`}>
          {sortedCards.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-slate-500">
              <ShieldHalf className="w-12 h-12 mb-3 opacity-20" />
              <p className="text-sm font-bold mb-4">Коллекция пуста или не найдено совпадений</p>
              <Link
                href="/gacha"
                className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(99,102,241,0.3)]"
              >
                Получить карты
              </Link>
            </div>
          )}
          {groupedCards ? (
            // Режим группировки по тайтлам
            groupedCards.map((group, groupIndex) => (
              <div key={group.anime} className="contents">
                {/* Разделитель группы */}
                <div className="col-span-full py-2 px-1">
                  <div className="flex items-center gap-2">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{group.anime}</span>
                    <div className="h-px bg-white/10 flex-1" />
                  </div>
                </div>
                {/* Карточки группы */}
                {group.cards.map((card) => {
                  const isSelected = selectedCards.some((c) => c.uniqueId === card.uniqueId)
                  const isLeader = leaderId === card.uniqueId
                  const config = rarityConfig[card.rarity] || { bg: "from-slate-500 to-slate-700", color: "text-slate-400", label: "Обычная" }
                  const role = card.role || "vanguard"
                  const roleConf = ROLE_CONFIG[role] || ROLE_CONFIG.vanguard

                  return (
                    <div
                      key={card.uniqueId}
                      onClick={() => toggleCardSelection(card)}
                      className={"relative text-left rounded-2xl p-2.5 border transition-all duration-200 flex items-center gap-3.5 cursor-pointer " + (
                        isSelected
                          ? "bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                          : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                      )}
                    >
                      {/* Visual Thumbnail (Image only) */}
                      <div
                        className="relative w-[50px] sm:w-[56px] aspect-[2/3] shrink-0 rounded-lg overflow-hidden shadow-lg cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation()
                          onCardClick?.(card)
                        }}
                      >
                        <Image
                          src={getProxiedSrc(card.imageUrl)}
                          alt={card.name}
                          unoptimized={true}
                          className="w-full h-full object-cover"
                          fill
                          sizes="(max-width: 640px) 56px, 56px"
                          quality={85}
                        />
                        {isSelected && (
                          <div className="absolute inset-0 bg-indigo-500/40 backdrop-blur-[0.5px] rounded-lg flex items-center justify-center z-30">
                            <CheckCircle2 className="w-5 h-5 text-white drop-shadow-md animate-bounce" />
                          </div>
                        )}
                        {isLeader && (
                          <div className="absolute top-1 right-1 z-40">
                            <div className="bg-amber-500 rounded-full p-1 shadow-lg">
                              <Crown className="w-3 h-3 text-white" />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Details Column */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                        <div className="flex items-start justify-between gap-1">
                          <p className="text-xs sm:text-sm font-black text-white truncate drop-shadow-sm flex-1">{card.name}</p>
                          {isSelected && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setLeaderId(isLeader ? null : card.uniqueId)
                              }}
                              className={`shrink-0 p-1.5 rounded-lg border transition-all ${
                                isLeader
                                  ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                                  : "bg-white/5 border-white/10 text-slate-400 hover:text-amber-400 hover:border-amber-500/30"
                              }`}
                              title={isLeader ? "Убрать лидера" : "Сделать лидером"}
                            >
                              <Crown className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                            <div className="flex items-center gap-1 bg-indigo-950/80 border border-indigo-500/20 px-1.5 py-0.5 rounded shadow-sm">
                              <span className="text-[7px] text-slate-400 font-bold uppercase">Вес</span>
                              <span className="text-xs font-black text-indigo-300 leading-none">{card.provisionCost || getCardProvision(card)}</span>
                            </div>
                            <div className="flex items-center gap-0.5 bg-amber-950/80 border border-amber-500/20 px-1.5 py-0.5 rounded shadow-sm">
                              <Crown className="w-2.5 h-2.5 text-amber-400" />
                              <span className="text-[9px] font-black text-amber-300 leading-none">{getCardBasePower(card)}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 items-center mt-1">
                          <span className={"text-[8px] font-black uppercase tracking-wider bg-gradient-to-r " + config.color + " bg-clip-text text-transparent"}>
                            {config.label}
                          </span>
                          <span className={"text-[8px] px-1.5 py-0.5 rounded " + roleConf.bg + " " + roleConf.color + " " + roleConf.border + " border flex items-center justify-center"}>
                            {role === "vanguard" && <SwordsIcon className="w-3 h-3" />}
                            {role === "guard" && <Shield className="w-3 h-3" />}
                            {role === "trickster" && <Zap className="w-3 h-3" />}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          ) : (
            // Обычный режим без группировки
            sortedCards.map((card) => {
              const isSelected = selectedCards.some((c) => c.uniqueId === card.uniqueId)
              const isLeader = leaderId === card.uniqueId
              const config = rarityConfig[card.rarity] || { bg: "from-slate-500 to-slate-700", color: "text-slate-400", label: "Обычная" }
              const role = card.role || "vanguard"
              const roleConf = ROLE_CONFIG[role] || ROLE_CONFIG.vanguard

              return (
                <div
                  key={card.uniqueId}
                  onClick={() => toggleCardSelection(card)}
                  className={"relative text-left rounded-2xl p-2.5 border transition-all duration-200 flex items-center gap-3.5 cursor-pointer " + (
                    isSelected
                      ? "bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.15)]"
                      : "bg-white/[0.02] border-white/5 hover:bg-white/[0.05] hover:border-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                  )}
                >
                  {/* Visual Thumbnail (Image only) */}
                  <div
                    className="relative w-[50px] sm:w-[56px] aspect-[2/3] shrink-0 rounded-lg overflow-hidden shadow-lg cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation()
                      onCardClick?.(card)
                    }}
                  >
                    <Image
                      src={getProxiedSrc(card.imageUrl)}
                      alt={card.name}
                      unoptimized={true}
                      className="w-full h-full object-cover"
                      fill
                      sizes="(max-width: 640px) 56px, 56px"
                      quality={85}
                    />
                    {isSelected && (
                      <div className="absolute inset-0 bg-indigo-500/40 backdrop-blur-[0.5px] rounded-lg flex items-center justify-center z-30">
                        <CheckCircle2 className="w-5 h-5 text-white drop-shadow-md animate-bounce" />
                      </div>
                    )}
                    {isLeader && (
                      <div className="absolute top-1 right-1 z-40">
                        <div className="bg-amber-500 rounded-full p-1 shadow-lg">
                          <Crown className="w-3 h-3 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Details Column */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between h-full py-0.5">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-xs sm:text-sm font-black text-white truncate drop-shadow-sm flex-1">{card.name}</p>
                      {isSelected && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setLeaderId(isLeader ? null : card.uniqueId)
                          }}
                          className={`shrink-0 p-1.5 rounded-lg border transition-all ${
                            isLeader
                              ? "bg-amber-500/20 border-amber-500/50 text-amber-400"
                              : "bg-white/5 border-white/10 text-slate-400 hover:text-amber-400 hover:border-amber-500/30"
                          }`}
                          title={isLeader ? "Убрать лидера" : "Сделать лидером"}
                        >
                          <Crown className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
                        <div className="flex items-center gap-1 bg-indigo-950/80 border border-indigo-500/20 px-1.5 py-0.5 rounded shadow-sm">
                          <span className="text-[7px] text-slate-400 font-bold uppercase">Вес</span>
                          <span className="text-xs font-black text-indigo-300 leading-none">{card.provisionCost || getCardProvision(card)}</span>
                        </div>
                        <div className="flex items-center gap-0.5 bg-amber-950/80 border border-amber-500/20 px-1.5 py-0.5 rounded shadow-sm">
                          <Crown className="w-2.5 h-2.5 text-amber-400" />
                          <span className="text-[9px] font-black text-amber-300 leading-none">{getCardBasePower(card)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 items-center mt-1">
                      <span className={"text-[8px] font-black uppercase tracking-wider bg-gradient-to-r " + config.color + " bg-clip-text text-transparent"}>
                        {config.label}
                      </span>
                      <span className={"text-[8px] px-1.5 py-0.5 rounded " + roleConf.bg + " " + roleConf.color + " " + roleConf.border + " border flex items-center justify-center"}>
                        {role === "vanguard" && <SwordsIcon className="w-3 h-3" />}
                        {role === "guard" && <Shield className="w-3 h-3" />}
                        {role === "trickster" && <Zap className="w-3 h-3" />}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
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

      {/* Help Modal */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-xl animate-in fade-in duration-200"
          onClick={() => setShowHelpModal(false)}
        >
          <div
            className="bg-[#0a0a0f]/95 border border-white/10 rounded-[2rem] p-6 max-w-2xl lg:max-w-4xl w-full max-h-[85vh] flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6 shrink-0">
              <h2 className="text-2xl font-black text-white">Справка по Казармам</h2>
              <button
                onClick={() => setShowHelpModal(false)}
                className="p-2.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6 text-slate-300">
              {/* Deck Size */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <h3 className="text-lg font-black text-white mb-3 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400" />
                  Размер колоды
                </h3>
                <p className="text-sm leading-relaxed">
                  Вы должны выбрать ровно <span className="text-amber-400 font-bold">8 карт</span> для вашей колоды. Это фиксированное количество — нельзя взять меньше или больше.
                </p>
              </div>

              {/* Provision System */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <h3 className="text-lg font-black text-white mb-3 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  Система веса (Provision)
                </h3>
                <p className="text-sm leading-relaxed mb-3">
                  Каждая карта имеет <span className="text-indigo-400 font-bold">вес</span> в очках. Общий вес вашей колоды не может превышать <span className="text-emerald-400 font-bold">{PROVISION_LIMIT} очков</span>.
                </p>
                <div className="text-xs space-y-1.5 bg-black/30 rounded-xl p-3 border border-white/5">
                  <p className="font-bold text-slate-400 mb-2">Вес по редкости:</p>
                  <div className="grid grid-cols-2 gap-1.5">
                    <div className="flex items-center justify-between bg-gradient-to-r from-stone-500/20 to-stone-700/20 border border-stone-500/30 rounded-lg px-2 py-1">
                      <span className="bg-gradient-to-r from-stone-500 to-stone-700 bg-clip-text text-transparent font-bold text-[10px]">Мусор</span>
                      <span className="text-slate-400 font-bold">0</span>
                    </div>
                    <div className="flex items-center justify-between bg-gradient-to-r from-slate-400/20 to-slate-500/20 border border-slate-400/30 rounded-lg px-2 py-1">
                      <span className="bg-gradient-to-r from-slate-400 to-slate-500 bg-clip-text text-transparent font-bold text-[10px]">Обычная</span>
                      <span className="text-slate-400 font-bold">2</span>
                    </div>
                    <div className="flex items-center justify-between bg-gradient-to-r from-emerald-400/20 to-teal-500/20 border border-emerald-500/30 rounded-lg px-2 py-1">
                      <span className="bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent font-bold text-[10px]">Необычная</span>
                      <span className="text-slate-400 font-bold">3</span>
                    </div>
                    <div className="flex items-center justify-between bg-gradient-to-r from-blue-400/20 to-cyan-500/20 border border-blue-500/30 rounded-lg px-2 py-1">
                      <span className="bg-gradient-to-r from-blue-400 to-cyan-500 bg-clip-text text-transparent font-bold text-[10px]">Редкая</span>
                      <span className="text-slate-400 font-bold">4</span>
                    </div>
                    <div className="flex items-center justify-between bg-gradient-to-r from-indigo-400/20 to-blue-600/20 border border-indigo-500/30 rounded-lg px-2 py-1">
                      <span className="bg-gradient-to-r from-indigo-400 to-blue-600 bg-clip-text text-transparent font-bold text-[10px]">Супер Редкая</span>
                      <span className="text-slate-400 font-bold">5</span>
                    </div>
                    <div className="flex items-center justify-between bg-gradient-to-r from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-lg px-2 py-1">
                      <span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent font-bold text-[10px]">Эпическая</span>
                      <span className="text-slate-400 font-bold">6</span>
                    </div>
                    <div className="flex items-center justify-between bg-gradient-to-r from-fuchsia-400/20 to-rose-500/20 border border-fuchsia-500/30 rounded-lg px-2 py-1">
                      <span className="bg-gradient-to-r from-fuchsia-400 to-rose-500 bg-clip-text text-transparent font-bold text-[10px]">Мифическая</span>
                      <span className="text-slate-400 font-bold">8</span>
                    </div>
                    <div className="flex items-center justify-between bg-gradient-to-r from-pink-400/20 to-rose-600/20 border border-pink-500/30 rounded-lg px-2 py-1">
                      <span className="bg-gradient-to-r from-pink-400 to-rose-600 bg-clip-text text-transparent font-bold text-[10px]">Легендарная</span>
                      <span className="text-slate-400 font-bold">9</span>
                    </div>
                    <div className="flex items-center justify-between bg-gradient-to-r from-amber-400/20 to-orange-500/20 border border-amber-500/30 rounded-lg px-2 py-1">
                      <span className="bg-gradient-to-r from-amber-400 to-orange-500 bg-clip-text text-transparent font-bold text-[10px]">Древняя</span>
                      <span className="text-slate-400 font-bold">10</span>
                    </div>
                    <div className="flex items-center justify-between bg-gradient-to-r from-orange-400/20 to-red-500/20 border border-orange-500/30 rounded-lg px-2 py-1">
                      <span className="bg-gradient-to-r from-orange-400 to-red-500 bg-clip-text text-transparent font-bold text-[10px]">Божественная</span>
                      <span className="text-slate-400 font-bold">11</span>
                    </div>
                    <div className="flex items-center justify-between bg-gradient-to-r from-red-500/20 to-rose-700/20 border border-red-500/30 rounded-lg px-2 py-1">
                      <span className="bg-gradient-to-r from-red-500 to-rose-700 bg-clip-text text-transparent font-bold text-[10px]">Трансцендентная</span>
                      <span className="text-slate-400 font-bold">13</span>
                    </div>
                    <div className="flex items-center justify-between col-span-2 bg-gradient-to-r from-white/20 via-yellow-200/20 to-amber-500/20 border border-white/30 rounded-lg px-2 py-1">
                      <span className="bg-gradient-to-r from-white via-yellow-200 to-amber-500 bg-clip-text text-transparent font-bold text-[10px]">Всемогущая</span>
                      <span className="text-slate-400 font-bold">15</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Roles */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <h3 className="text-lg font-black text-white mb-3 flex items-center gap-2">
                  <Shield className="w-5 h-5 text-amber-400" />
                  Роли карт (Камень-Ножницы-Бумага)
                </h3>
                <p className="text-sm leading-relaxed mb-3">
                  Роль карты определяется её <span className="text-slate-400 font-semibold">наивысшим статом</span> и создаёт систему преимуществ в бою:
                </p>
                <div className="space-y-3 text-xs">
                  <div className="flex items-start gap-3 bg-rose-500/10 border border-rose-500/20 rounded-xl p-3">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0">
                      <SwordsIcon className="w-4 h-4 text-rose-400" />
                    </div>
                    <div>
                      <p className="font-bold text-rose-400">Авангард (Vanguard)</p>
                      <p className="text-slate-400">Наивысший стат: ATK. Получает <span className="text-rose-300 font-bold">+50% бонус</span> против Плутов.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
                      <Shield className="w-4 h-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="font-bold text-blue-400">Страж (Guard)</p>
                      <p className="text-slate-400">Наивысший стат: HP/DEF. Получает <span className="text-blue-300 font-bold">+50% бонус</span> против Авангардов.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                    <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0">
                      <Zap className="w-4 h-4 text-amber-400" />
                    </div>
                    <div>
                      <p className="font-bold text-amber-400">Плут (Trickster)</p>
                      <p className="text-slate-400">Наивысший стат: SPD/LUCK. Получает <span className="text-amber-300 font-bold">+50% бонус</span> против Стражей.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Leader */}
              <div className="bg-white/[0.02] border border-white/5 rounded-2xl p-5">
                <h3 className="text-lg font-black text-white mb-3 flex items-center gap-2">
                  <Crown className="w-5 h-5 text-amber-400" />
                  Лидер колоды
                </h3>
                <p className="text-sm leading-relaxed">
                  После выбора карты вы можете назначить её <span className="text-amber-400 font-bold">лидером</span>, нажав на иконку короны. Лидер даёт дополнительные бонусы в бою.
                </p>
              </div>

              {/* Tips */}
              <div className="bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-2xl p-5">
                <h3 className="text-lg font-black text-white mb-3 flex items-center gap-2">
                  <Star className="w-5 h-5 text-indigo-400" />
                  Советы по сбору
                </h3>
                <ul className="text-sm space-y-2 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 mt-1">•</span>
                    <span>Балансируйте роли: включите карты всех трёх типов для тактического разнообразия</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 mt-1">•</span>
                    <span>Следите за весом: редкие карты сильнее, но занимают больше очков provisions</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-400 mt-1">•</span>
                    <span>Используйте фильтры и сортировку для быстрого поиска нужных карт</span>
                  </li>
                </ul>
              </div>
            </div>

            <button
              onClick={() => setShowHelpModal(false)}
              className="mt-6 w-full py-4 bg-white text-black hover:bg-slate-200 font-black uppercase tracking-widest rounded-xl transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)] shrink-0"
            >
              Понятно
            </button>
          </div>
        </div>
      )}
    </div>
  )
};