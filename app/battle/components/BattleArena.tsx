import React, { useState } from "react"
import { Swords, Eye, Shield, Skull, Zap, HelpCircle, Dumbbell, ArrowRight, BookOpen, Clock, Heart, Swords as SwordsIcon, Info, X } from "lucide-react"
import { Card, BattleZone, CCGBattleState, ZoneCard } from "../types"
import { glassCard, ROLE_CONFIG, TERRITORY_MODIFIERS } from "../config"
import { rarityConfig } from "@/types/gacha"
import { getCardBasePower, getCardRole } from "../utils"
import { BattleCard } from "./BattleCard"

interface BattleArenaProps {
  ccgState: CCGBattleState | null
  placedThisRound: { cardId: string; zoneId: string; isSecret: boolean }[]
  playCardToZone: (cardId: string, zoneId: string) => void
  recallCard: (cardId: string) => void
  confirmRoundPlacement: () => void
  nextRound: () => void
  setBattleState: (state: "idle" | "loading" | "battle" | "result") => void
}

export const BattleArena: React.FC<BattleArenaProps> = ({
  ccgState,
  placedThisRound,
  playCardToZone,
  recallCard,
  confirmRoundPlacement,
  nextRound,
  setBattleState,
}) => {
  const [selectedHandCardId, setSelectedHandCardId] = useState<string | null>(null)
  const [showRules, setShowRules] = useState(false)
  const [activeTerrain, setActiveTerrain] = useState<{ nameRu: string; description: string } | null>(null)

  if (!ccgState) return null

  const isPlacement = ccgState.phase === "placement"
  const isReveal = ccgState.phase === "reveal"

  // Handle deploying card via clicks
  const handleZoneClick = (zoneId: string) => {
    if (!selectedHandCardId || !isPlacement) return
    playCardToZone(selectedHandCardId, zoneId)
    setSelectedHandCardId(null)
  }

  // Real-time Power Calculation for display
  const getZoneLiveScores = (zone: BattleZone) => {
    // 1. Player Confirmed + Pending
    let playerPower = zone.playerCards.reduce((acc, zc) => acc + zc.powerAfterModifier, 0)
    placedThisRound.forEach(p => {
      if (p.zoneId === zone.id) {
        const card = ccgState.hand.find(c => c.uniqueId === p.cardId)
        if (card) playerPower += getCardBasePower(card)
      }
    })

    // 2. AI Confirmed (including tentative in reveal phase)
    const aiPower = zone.aiCards.reduce((acc, zc) => {
      // In placement phase, do not count power of secret AI cards for the current round
      if (zc.isSecret && isPlacement) return acc
      return acc + zc.powerAfterModifier
    }, 0)

    return { playerPower, aiPower }
  }

  return (
    <div className="w-full max-w-6xl mx-auto rounded-3xl bg-[#090911]/90 border border-white/10 overflow-hidden animate-in fade-in zoom-in-95 duration-500 flex flex-col relative min-h-0 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
      
      {/* HEADER BAR */}
      <div className="bg-white/[0.02] border-b border-white/5 p-2.5 sm:p-4 flex flex-row items-center justify-between backdrop-blur-md relative z-20 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <div className="px-2.5 sm:px-4 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 shadow-inner shrink-0">
            <span className="text-[9px] sm:text-[10px] font-black text-indigo-300 uppercase tracking-widest mr-1.5">Раунд</span>
            <span className="text-xs sm:text-sm font-black text-white">{ccgState.round}</span>
            <span className="text-[10px] sm:text-xs text-slate-500 ml-0.5">/ 3</span>
          </div>
          <div className="text-[10px] sm:text-xs font-bold text-slate-400 flex items-center gap-1.5 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span className="truncate">
              {isPlacement ? (
                <span className="text-amber-400 font-black">Планирование (2 карты)</span>
              ) : (
                <span className="text-indigo-400 font-black">Вскрытие карт: дуэль!</span>
              )}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setShowRules(!showRules)}
            className="text-[10px] sm:text-xs px-2 sm:px-3 py-1 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5 rounded-lg sm:rounded-xl transition-all font-bold flex items-center gap-1"
          >
            <BookOpen className="w-3 sm:w-3.5 h-3 sm:h-3.5" />
            <span className="hidden sm:inline">{showRules ? "Скрыть" : "Гайд"}</span>
          </button>
          <button
            onClick={() => setBattleState("idle")}
            className="text-[10px] sm:text-xs px-2.5 sm:px-3.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg sm:rounded-xl transition-all font-bold"
          >
            Сдаться
          </button>
        </div>
      </div>

      {/* QUICK KNB RULES BANNER */}
      {showRules && (
        <div className="bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-transparent border-b border-white/5 p-4 relative z-10 flex flex-col md:flex-row gap-4 items-center justify-between animate-in slide-in-from-top-4 duration-300">
          <div className="flex-1">
            <h4 className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-1">🔥 Механика Боевых Ролей & КНБ</h4>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-2xl">
              Роль карты определяется автоматически по её доминирующей характеристике. При столкновении срабатывает КНБ бонус: побеждающая карта получает <strong>+50% силы</strong> против проигрывающей!
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[10px] font-bold">
              <span className="text-sm">🗡️</span> <strong>Авангард</strong> (ATK) бьет <strong>Плута</strong> (+50%)
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-300 text-[10px] font-bold">
              <span className="text-sm">🛡️</span> <strong>Страж</strong> (HP/DEF) бьет <strong>Авангард</strong> (+50%)
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold">
              <span className="text-sm">⚡</span> <strong>Плут</strong> (SPD/LUCK) бьет <strong>Стража</strong> (+50%)
            </div>
          </div>
        </div>
      )}

      {/* THREE ZONE BATTLEFIELD */}
      <div className="p-2 sm:p-4 md:p-6 pb-[170px] sm:pb-[210px] lg:pb-6 flex-1 flex flex-col gap-4 relative z-10">
        <div className="grid grid-cols-3 gap-3 sm:gap-4 md:gap-6 flex-1 items-stretch overflow-x-auto min-w-full">
          {ccgState.zones.map((zone) => {
            const { playerPower, aiPower } = getZoneLiveScores(zone)

            // Find if any card is currently placed on this zone this round
            const playerPendingOnThisZone = placedThisRound.filter(p => p.zoneId === zone.id).map(p => {
              const card = ccgState.hand.find(c => c.uniqueId === p.cardId)
              return { card, isSecret: p.isSecret }
            })

            const hasWon = zone.owner === "player"
            const hasLost = zone.owner === "ai"

            // Medallion styling based on owner
            const borderGlowClass = 
              hasWon && isReveal
                ? "border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)] bg-emerald-950/40 text-emerald-300"
                : hasLost && isReveal
                ? "border-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.4)] bg-rose-950/40 text-rose-300"
                : "border-indigo-500/30 bg-slate-900/40 text-slate-300 hover:border-indigo-500/60"

            return (
              <div
                key={zone.id}
                onClick={() => handleZoneClick(zone.id)}
                className={"relative rounded-2xl p-2 sm:p-2.5 md:p-4 transition-all flex flex-col justify-between border select-none min-w-[150px] sm:min-w-0 " + (
                  isPlacement && selectedHandCardId 
                    ? "cursor-pointer hover:border-indigo-500/80 hover:bg-indigo-500/5 ring-1 ring-dashed ring-indigo-500/40 bg-white/[0.01] border-white/10" 
                    : "bg-[#0b0b14]/40 border-white/5"
                )}
              >
                {/* AI DEPLOYED CARDS (Top) */}
                <div className="flex-1 flex flex-col justify-start min-h-[110px] sm:min-h-[140px] md:min-h-[160px] pb-2 sm:pb-4">
                  <div className="text-[9px] sm:text-[10px] uppercase font-bold text-rose-500/70 mb-1.5 sm:mb-2 flex justify-between items-center px-0.5">
                    <span>Соперник</span>
                    <span className="text-[10px] sm:text-xs font-black text-rose-400">⚡{aiPower}</span>
                  </div>

                  <div className="flex flex-nowrap gap-1 justify-center items-start">
                    {zone.aiCards.map((zc, idx) => {
                      return (
                        <BattleCard
                          key={idx}
                          card={zc.card}
                          size="sm"
                          isSecret={zc.isSecret && !isReveal}
                          powerValue={zc.powerAfterModifier}
                          roleMatchupBonus={zc.roleMatchupBonus}
                          isInteractive={false}
                        />
                      )
                    })}
                  </div>
                </div>

                {/* ZONE SCORE SUMMARY / MEDALLION (Middle) */}
                <div className="my-3 flex flex-col items-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setActiveTerrain({ nameRu: zone.modifier.nameRu, description: zone.modifier.description })
                    }}
                    className={`relative w-full max-w-[120px] py-2 sm:py-3.5 rounded-xl border flex flex-col items-center justify-center transition-all duration-300 cursor-pointer ${borderGlowClass}`}
                  >
                    {/* AI Score Badge */}
                    <div className="absolute -top-2 px-2 py-0.5 rounded-full bg-rose-950/90 border border-rose-500/30 text-[10px] sm:text-[10px] font-black text-rose-400 shadow-md">
                      {aiPower}
                    </div>

                    {/* Terrain Name */}
                    <div className="px-1 text-center w-full">
                      <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-wider block truncate">
                        {zone.modifier.nameRu}
                      </span>
                      <span className="text-[7px] sm:text-[8px] font-semibold text-slate-500 block">
                        Инфо...
                      </span>
                    </div>

                    {/* Player Score Badge */}
                    <div className="absolute -bottom-2 px-2 py-0.5 rounded-full bg-emerald-950/90 border border-emerald-500/30 text-[10px] sm:text-[10px] font-black text-emerald-400 shadow-md">
                      {playerPower}
                    </div>
                  </button>
                </div>

                {/* PLAYER DEPLOYED CARDS (Bottom) */}
                <div className="flex-1 flex flex-col justify-end pt-2 sm:pt-4 min-h-[110px] sm:min-h-[140px] md:min-h-[160px] border-t border-dashed border-white/5">
                  <div className="text-[9px] sm:text-[10px] uppercase font-bold text-indigo-400/70 mt-1 sm:mt-2 mb-1.5 sm:mb-2 flex justify-between items-center px-0.5">
                    <span>Вы</span>
                    <span className="text-[10px] sm:text-xs font-black text-emerald-400">⚡{playerPower}</span>
                  </div>

                  <div className="flex flex-nowrap gap-1 justify-center items-start">
                    {/* Pre-reveal confirmed cards */}
                    {zone.playerCards.map((zc, idx) => {
                      return (
                        <BattleCard
                          key={idx}
                          card={zc.card}
                          size="sm"
                          powerValue={zc.powerAfterModifier}
                          roleMatchupBonus={zc.roleMatchupBonus}
                          isInteractive={false}
                        />
                      )
                    })}

                    {/* Pending placed cards this round */}
                    {playerPendingOnThisZone.map((p, idx) => {
                      if (!p.card) return null
                      return (
                        <BattleCard
                          key={`pending-${idx}`}
                          card={p.card}
                          size="sm"
                          isSecret={p.isSecret}
                          isPending={true}
                          onRemove={() => recallCard(p.card!.uniqueId)}
                          isInteractive={false}
                        />
                      )
                    })}
                  </div>
                </div>

              </div>
            )
          })}
        </div>
      </div>

      {/* MOVE BATTLE EVENT LOGS */}
      {ccgState.roundHistory.length > 0 && (
        <div className="hidden xl:block px-6 py-3 border-t border-white/5 bg-[#0a0a14] relative z-10">
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase mb-1">
            <Clock className="w-3.5 h-3.5" /> Хроника боя (История ходов)
          </div>
          <div className="max-h-[60px] overflow-y-auto space-y-1.5 scrollbar-thin">
            {ccgState.roundHistory.map((hist, idx) => (
              <div key={idx} className="text-[11px] text-slate-400 flex flex-wrap gap-x-4 items-center bg-white/[0.01] px-2.5 py-1 rounded-lg border border-white/5">
                <span className="font-black text-amber-400 uppercase tracking-wider shrink-0">Раунд {hist.round}:</span>
                <span className="flex items-center gap-1">
                  👤 Вы: {hist.playerActions.map((act, i) => (
                    <strong key={i} className="text-slate-200">
                      {act.cardName} {act.isSecret ? "🤫(Скрыто)" : "👁️(Открыто)"}{i < hist.playerActions.length - 1 ? ", " : ""}
                    </strong>
                  ))}
                </span>
                <span className="hidden md:inline text-slate-600">|</span>
                <span className="flex items-center gap-1">
                  🤖 Соперник: {hist.aiActions.map((act, i) => (
                    <strong key={i} className="text-slate-400">
                      {act.cardName} {act.isSecret ? "🤫(Скрыто)" : "👁️(Открыто)"}{i < hist.aiActions.length - 1 ? ", " : ""}
                    </strong>
                  ))}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* PLAYER HAND BAR */}
      <div className="sticky bottom-0 left-0 right-0 bg-[#0a0a14]/95 border-t border-white/10 px-3 sm:px-4 py-2 sm:py-3.5 backdrop-blur-2xl z-40 shadow-[0_-15px_30px_rgba(0,0,0,0.9)] mt-auto">
        <div className="flex items-center justify-between gap-3 max-w-5xl mx-auto w-full">
          
          {/* Hand Cards */}
          <div className="flex-1 min-w-0 flex flex-col">
            <div className="w-full flex items-center justify-between mb-1 px-1">
              <span className="text-[9px] text-slate-500 font-bold block uppercase tracking-widest leading-none">
                Твоя рука ({ccgState.hand.length})
              </span>
              {selectedHandCardId && (
                <span className="text-[9px] text-amber-400 font-black uppercase tracking-wider animate-pulse">
                  � Выстави на линию!
                </span>
              )}
            </div>
            
            {/* Elegant CCG Card Fan Overlapping layout */}
            <div className="flex flex-nowrap overflow-x-auto scrollbar-none items-end h-[150px] sm:h-[200px] md:h-[250px] pt-6 sm:pt-8 md:pt-14 pb-1 pl-2 gap-1">
              {ccgState.hand.map((card, idx) => {
                const isSelected = selectedHandCardId === card.uniqueId
                const isPlaced = placedThisRound.some(p => p.cardId === card.uniqueId)

                if (isPlaced) return null

                return (
                  <div
                    key={card.uniqueId}
                    className={`relative transition-all duration-300 ease-out shrink-0 -ml-4 sm:-ml-8 md:-ml-12 first:ml-0 hover:z-30 hover:-translate-y-3 sm:hover:-translate-y-5 ${
                      isSelected ? "z-40 -translate-y-4 sm:-translate-y-6 scale-110" : ""
                    }`}
                  >
                    <BattleCard
                      card={card}
                      size="md"
                      onClick={() => isPlacement && setSelectedHandCardId(isSelected ? null : card.uniqueId)}
                      className={isSelected ? "ring-2 ring-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.5)]" : ""}
                    />
                  </div>
                )
              })}
            </div>
          </div>

          {/* Action Button (Marvel Snap style circle on the right!) */}
          <div className="shrink-0 flex items-center justify-center pl-2">
            {isPlacement ? (
              <button
                onClick={confirmRoundPlacement}
                disabled={placedThisRound.length < 2}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 disabled:from-slate-800 disabled:to-slate-900 text-white disabled:text-slate-500 font-black uppercase text-[10px] sm:text-xs tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:shadow-none active:scale-95 border-2 border-emerald-400/30 disabled:border-white/5 flex flex-col items-center justify-center gap-1"
              >
                <Swords className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                <span className="text-center leading-none text-[8px] sm:text-[9px]">
                  В бой <br />({placedThisRound.length}/2)
                </span>
              </button>
            ) : (
              <button
                onClick={nextRound}
                className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-white font-black uppercase text-[10px] sm:text-xs tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(99,102,241,0.4)] active:scale-95 border-2 border-indigo-400/30 flex flex-col items-center justify-center gap-1"
              >
                <ArrowRight className="w-4.5 h-4.5 sm:w-5 sm:h-5 animate-pulse" />
                <span className="text-center leading-none text-[8px] sm:text-[9px]">Шаг</span>
              </button>
            )}
          </div>

        </div>
      </div>

      {/* activeTerrain details popup modal for mobile-first experience */}
      {activeTerrain && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setActiveTerrain(null)}
        >
          <div
            className="bg-[#0b0b14]/95 border border-white/10 rounded-2xl p-5 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveTerrain(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-black uppercase mb-2">
              <Zap className="w-4 h-4 animate-pulse text-yellow-400" /> Спец-эффект локации
            </div>
            <h3 className="text-lg font-black text-white uppercase tracking-wider mb-2">
              {activeTerrain.nameRu}
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              {activeTerrain.description}
            </p>
          </div>
        </div>
      )}

    </div>
  )
};