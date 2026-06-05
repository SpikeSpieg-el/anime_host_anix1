import React, { useState } from 'react';
import { Shield, Swords as SwordsIcon, Target, Info, Trophy, Skull, Dumbbell, Crown, Sparkles, Zap, X, Mountain, Footprints } from 'lucide-react';
import { Card, Dungeon, Enemy, BattleProgress, BattleLog, DeckSynergy } from '../types';
import { glassCard, glassButton, PROVISION_LIMIT, DECK_SIZE, FORMATION_CONFIG, SYNERGY_DEFINITIONS, SYNERGY_TOTAL_CAP, FormationId, THEME_CONFIG, LEADER_AURA_CONFIG, LEADER_AURA_VALUE, ROLE_CONFIG } from '../config';
import { getCardBasePower, computeDeckSynergies, getCardProvision, getCardRole } from '../utils';
import { BattleCard } from './BattleCard';

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
  leaderId: string | null
  setLeaderId: (id: string | null) => void
  formation: FormationId
  setFormation: (formation: FormationId) => void
  onCardClick?: (card: Card) => void
  onOpenLocationSelector?: () => void
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
  leaderId,
  setLeaderId,
  formation,
  setFormation,
  onCardClick,
  onOpenLocationSelector,
}) => {
  const [viewedSynergy, setViewedSynergy] = useState<DeckSynergy | null>(null)
  const [showPowerBreakdown, setShowPowerBreakdown] = useState(false)

  const totalProvisionUsed = selectedCards.reduce((acc, c) => acc + (c.provisionCost || getCardProvision(c)), 0);
  const isDeckValid = selectedCards.length === DECK_SIZE && totalProvisionUsed <= PROVISION_LIMIT;

  const synergyResult = computeDeckSynergies(selectedCards);
  const totalBonus = synergyResult.globalBonus;

  // Calculate leader aura bonus for deck power display
  let leaderAuraBonus = 0
  if (leaderId) {
    const leader = selectedCards.find(c => c.uniqueId === leaderId)
    if (leader) {
      const leaderRole = leader.role || getCardRole(leader)
      // Count cards that benefit from leader aura
      const affectedCards = selectedCards.filter(c => {
        const cardRole = c.role || getCardRole(c)
        if (leaderRole === "trickster") {
          // Trickster leader gives bonus to secret cards (we'll estimate as 50% of deck)
          return true // Simplified: all cards could potentially be secret
        } else {
          return cardRole === leaderRole
        }
      })
      leaderAuraBonus = affectedCards.length * LEADER_AURA_VALUE
    }
  }

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 p-2 sm:p-4">
      {/* Основной контейнер колоды */}
      <div className={`rounded-3xl p-5 ${glassCard} border border-white/10 backdrop-blur-xl relative overflow-hidden shadow-2xl`}>
        {/* Фоновое декоративное свечение */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-black text-white uppercase tracking-wider">Ваша колода</h2>
              <p className="text-[10px] text-slate-400 font-bold">Собрано карт для дуэли</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-xs font-black text-indigo-300">
            {selectedCards.length} / {DECK_SIZE}
          </span>
        </div>

        {/* Шкала лимита веса (Provision) */}
        <div className="mb-5 bg-black/40 rounded-2xl p-3 border border-white/5 relative z-10">
          <div className="flex justify-between items-center text-[10px] font-bold mb-1.5 uppercase tracking-wider">
            <span className="text-slate-400 flex items-center gap-1">
              <Dumbbell className="w-3.5 h-3.5 text-indigo-400" /> Вес колоды
            </span>
            <span className={totalProvisionUsed > PROVISION_LIMIT ? 'text-rose-400 font-black' : 'text-emerald-400 font-black'}>
              {totalProvisionUsed} / {PROVISION_LIMIT}
            </span>
          </div>
          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-[2px] border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                totalProvisionUsed > PROVISION_LIMIT 
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 shadow-[0_0_12px_rgba(244,63,94,0.6)]' 
                  : 'bg-gradient-to-r from-indigo-500 to-violet-600 shadow-[0_0_12px_rgba(99,102,241,0.6)]'
              }`}
              style={{ width: `${Math.min(100, (totalProvisionUsed / PROVISION_LIMIT) * 100)}%` }}
            />
          </div>
        </div>

        {/* Сетка слотов (Мини-карты) */}
        <div className="grid grid-cols-2 gap-2 mb-5 relative z-10">
          {Array.from({ length: DECK_SIZE }).map((_, slot) => {
            const card = selectedCards[slot];
            if (!card) {
              return (
                <button
                  key={slot}
                  onClick={() => setShowTeamBuilder(true)}
                  className="aspect-[2/3] rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] active:scale-95 transition-all flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-300"
                >
                  <span className="text-lg font-black text-indigo-400/60">+</span>
                  <span className="text-[7px] uppercase tracking-wider font-extrabold text-slate-500">Слот {slot + 1}</span>
                </button>
              );
            }

            return (
              <div key={card.uniqueId} className="relative aspect-[2/3] transform transition-transform active:scale-95">
                <BattleCard
                  card={card}
                  size="sm"
                  onRemove={() => toggleCardSelection(card)}
                  onClick={() => onCardClick?.(card)}
                  className="w-full h-full shadow-lg"
                />
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setShowTeamBuilder(true)}
          className={`w-full py-3 mb-4 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 ${glassButton} text-indigo-300 border border-indigo-500/20 active:scale-98 transition-all`}
        >
          <Target className="w-3.5 h-3.5" /> Изменить состав
        </button>

        {/* Formation Selector */}
        <div className="mb-4 bg-black/40 rounded-2xl p-3 border border-white/5 relative z-10">
          <div className="flex items-center justify-between text-[10px] font-bold mb-2 uppercase tracking-wider">
            <span className="text-slate-400 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Формация
            </span>
          </div>
          <div className="flex gap-2">
            {(Object.keys(FORMATION_CONFIG) as FormationId[]).map((fid) => {
              const f = FORMATION_CONFIG[fid]
              const isSelected = formation === fid
              return (
                <button
                  key={fid}
                  onClick={() => setFormation(fid)}
                  className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider border transition-all ${
                    isSelected
                      ? `${f.bg} ${f.color} ${f.border} shadow-[0_0_10px_rgba(255,255,255,0.05)]`
                      : "bg-white/5 text-slate-400 border-transparent hover:bg-white/10"
                  }`}
                >
                  {f.nameRu}
                </button>
              )
            })}
          </div>
        </div>

        {/* Leader Display */}
        {leaderId && (
          <div className="mb-4 bg-amber-500/5 rounded-2xl p-3 border border-amber-500/20 relative z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider">Лидер</span>
              </div>
              <button
                onClick={() => setLeaderId(null)}
                className="text-[8px] text-slate-400 hover:text-rose-400 font-black uppercase transition-colors"
              >
                Убрать
              </button>
            </div>
            <div className="mt-2">
              <div className="text-xs font-bold text-white truncate">
                {selectedCards.find(c => c.uniqueId === leaderId)?.name || "Не найден"}
              </div>
              <div className="mt-1.5 text-[9px] text-amber-200/80 font-medium leading-tight">
                {(() => {
                  const leader = selectedCards.find(c => c.uniqueId === leaderId)
                  if (!leader) return ""
                  const role = leader.role || getCardRole(leader)
                  return LEADER_AURA_CONFIG[role]?.description || ""
                })()}
              </div>
            </div>
          </div>
        )}

        {/* Synergies Panel */}
        {synergyResult.active.length > 0 && (
          <div className="mb-4 bg-violet-500/5 rounded-2xl p-3 border border-violet-500/20 relative z-10">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-violet-400" />
                <span className="text-[10px] font-black text-violet-300 uppercase tracking-wider">Синергии</span>
              </div>
              <span className="text-[10px] font-black text-emerald-400">+{totalBonus}</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {synergyResult.active.map((syn) => (
                <div
                  key={syn.id}
                  onClick={() => setViewedSynergy(syn)}
                  className={`px-2 py-1 rounded-md border cursor-pointer hover:scale-105 transition-transform ${SYNERGY_DEFINITIONS[syn.id]?.bg} ${SYNERGY_DEFINITIONS[syn.id]?.border} ${SYNERGY_DEFINITIONS[syn.id]?.color} text-[8px] font-black uppercase tracking-wider`}
                  title={syn.description}
                >
                  {syn.nameRu}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Сводка силы колоды */}
        <div className="bg-black/40 rounded-2xl p-3.5 border border-white/5 space-y-3 relative z-10">
          {selectedDungeon && (
            <div className="flex items-center justify-between pb-2.5 border-b border-white/5">
              <div className="flex items-center gap-2">
                {(() => {
                  const theme = THEME_CONFIG[selectedDungeon.theme] || THEME_CONFIG.dark_forest
                  const ThemeIcon = theme.icon
                  return <ThemeIcon className={`w-3.5 h-3.5 ${theme.color}`} />
                })()}
                <div>
                  <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest">Локация</div>
                  <div className="text-xs font-bold text-white">{selectedDungeon.name_ru}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Угроза</div>
                <div className="text-xs font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                  {selectedDungeon.difficulty}
                </div>
              </div>
            </div>
          )}

          <div 
            className="flex items-center justify-between cursor-pointer hover:bg-white/5 rounded-lg p-2 -mx-2 transition-colors"
            onClick={() => setShowPowerBreakdown(true)}
          >
            <div>
              <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Сила колоды</div>
              <div className="text-lg font-black text-white flex items-center gap-1">
                <Zap className="w-4 h-4 text-emerald-400" />
                {(selectedCards.reduce((acc, c) => acc + getCardBasePower(c), 0) + totalBonus + leaderAuraBonus).toLocaleString()}
              </div>
            </div>
            <div className="text-right space-y-1">
              {totalBonus > 0 && (
                <div>
                  <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Синергии</div>
                  <div className="text-xs font-black text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20">
                    +{totalBonus}
                  </div>
                </div>
              )}
              {leaderAuraBonus > 0 && (
                <div>
                  <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Аура лидера</div>
                  <div className="text-xs font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                    +{leaderAuraBonus}
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedDungeon && (
            <div className="pt-2.5 border-t border-white/5 flex items-center justify-between">
              <span className="text-[9px] text-slate-400 flex items-center gap-1">
                <Info className="w-3 h-3 text-slate-500" /> Подсказка
              </span>
              <span className="text-[8px] text-indigo-300 font-extrabold uppercase">
                Анализируйте КНБ-эффект ролей!
              </span>
            </div>
          )}
        </div>

        {/* Главная кнопка боя (В духе Marvel Snap) */}
        {!selectedDungeon ? (
          <button
            onClick={onOpenLocationSelector}
            className="w-full mt-4 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 active:scale-95
              bg-gradient-to-r from-indigo-400 via-blue-500 to-indigo-500 text-white shadow-[0_4px_20px_rgba(99,102,241,0.4)] border-b-4 border-indigo-700 hover:brightness-110"
          >
            Выбрать локацию
          </button>
        ) : (
          <div className="flex gap-3 mt-4">
            <button
              onClick={startBattle}
              disabled={!isDeckValid || (progress ? progress.current_stamina < selectedDungeon.energy_cost : false)}
              className="flex-1 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-40
                bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-black shadow-[0_4px_20px_rgba(245,158,11,0.4)] border-b-4 border-amber-700 hover:brightness-110"
            >
              {selectedCards.length < DECK_SIZE
                ? `Собери колоду (${selectedCards.length}/${DECK_SIZE})`
                : totalProvisionUsed > PROVISION_LIMIT
                ? 'Превышен вес колоды'
                : progress && progress.current_stamina < selectedDungeon.energy_cost
                ? `Мало энергии (${progress.current_stamina}/${selectedDungeon.energy_cost})`
                : 'Вступить в дуэль'}
            </button>
            <button
              onClick={onOpenLocationSelector}
              className="px-4 py-4 rounded-2xl font-black uppercase tracking-widest text-[10px] transition-all duration-300 active:scale-95
                bg-gradient-to-r from-indigo-400 via-blue-500 to-indigo-500 text-white shadow-[0_4px_20px_rgba(99,102,241,0.4)] border-b-4 border-indigo-700 hover:brightness-110"
            >
              Локация
            </button>
          </div>
        )}
      </div>

      {/* История логов */}
      {logs.length > 0 && (
        <div className={`rounded-3xl p-5 ${glassCard} border border-white/5 shadow-xl`}>
          <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">История операций</h3>
          <div className="space-y-2">
            {logs.slice(0, 3).map((log) => (
              <div key={log.id} className="flex items-center justify-between p-2.5 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${log.result === 'win' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                    {log.result === 'win' ? <Trophy className="w-3.5 h-3.5" /> : <Skull className="w-3.5 h-3.5" />}
                  </div>
                  <div>
                    <div className="text-xs font-black text-white">{log.result === 'win' ? 'Победа' : 'Поражение'}</div>
                    <div className="text-[9px] text-slate-500">{log.battle_turns} ходов</div>
                  </div>
                </div>
                {log.result === 'win' && (
                  <div className="text-right">
                    <div className="text-[10px] font-black text-yellow-400">+{log.coins_earned} 💰</div>
                    <div className="text-[9px] font-black text-blue-400">+{log.xp_earned} XP</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Power Breakdown Modal */}
      {showPowerBreakdown && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setShowPowerBreakdown(false)}
        >
          <div
            className="bg-[#0b0b14] border border-white/10 rounded-2xl p-5 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowPowerBreakdown(false)}
              className="absolute top-3 right-3 p-1.5 rounded-lg bg-white/5 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="mb-4">
              <h3 className="text-sm font-bold text-white">Разбор силы колоды</h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {selectedCards.map((card) => {
                const basePower = getCardBasePower(card)
                const role = card.role || getCardRole(card)
                const roleConfig = ROLE_CONFIG[role]
                const globalSynergyBonus = synergyResult.globalBonus
                const roleSynergyBonus = synergyResult.roleAdjust[role] || 0
                const totalSynergyBonus = globalSynergyBonus + roleSynergyBonus
                const leaderBonus = leaderId ? (() => {
                  const leader = selectedCards.find(c => c.uniqueId === leaderId)
                  if (!leader) return 0
                  const leaderRole = leader.role || getCardRole(leader)
                  if (leaderRole === "trickster") return LEADER_AURA_VALUE
                  return leaderRole === role ? LEADER_AURA_VALUE : 0
                })() : 0
                const totalBonus = totalSynergyBonus + leaderBonus
                const totalCardPower = basePower + totalBonus

                const RoleIcon = role === "vanguard" ? SwordsIcon : role === "guard" ? Shield : Footprints

                return (
                  <div key={card.uniqueId} className="relative rounded-xl p-3 border border-white/5 overflow-hidden">
                    <div className={`absolute inset-0 bg-gradient-to-br ${roleConfig.bg} to-transparent opacity-30`} />
                    <div className="absolute -right-4 -bottom-4 opacity-10">
                      <RoleIcon className="w-20 h-20 text-white" />
                    </div>
                    <div className="relative">
                      <div className="flex items-center gap-1.5 mb-2">
                        <div className={`p-1 rounded-lg ${roleConfig.bg} border ${roleConfig.border} shrink-0`}>
                          <RoleIcon className={`w-3 h-3 ${roleConfig.color}`} />
                        </div>
                        <div className="text-xs font-medium text-white truncate">{card.name}</div>
                      </div>
                      <div className="text-xs">
                        <div className="flex items-center gap-1 text-slate-400">
                          <span>{basePower}</span>
                          <span className="text-white">+{totalBonus}</span>
                          <span>=</span>
                          <span className="font-bold text-emerald-400 text-lg">{totalCardPower}</span>
                        </div>
                        {(totalSynergyBonus !== 0 || leaderBonus !== 0) && (
                          <div className="flex items-center gap-1 text-slate-500 mt-0.5 text-[10px]">
                            {totalSynergyBonus !== 0 && <span className="text-violet-400">син:{totalSynergyBonus}</span>}
                            {totalSynergyBonus !== 0 && leaderBonus !== 0 && <span>+</span>}
                            {leaderBonus !== 0 && <span className="text-amber-400">аура:{leaderBonus}</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div className="mt-4 pt-3 border-t border-white/10">
              <div className="flex justify-between items-center">
                <span className="text-xs font-medium text-slate-400">Итого</span>
                <span className="text-sm font-bold text-emerald-400">
                  {(selectedCards.reduce((acc, c) => acc + getCardBasePower(c), 0) + totalBonus + leaderAuraBonus).toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Synergy Detail Modal */}
      {viewedSynergy && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setViewedSynergy(null)}
        >
          <div
            className="bg-[#0b0b14]/95 border border-white/10 rounded-3xl p-5 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setViewedSynergy(null)}
              className="absolute top-4 right-4 p-1.5 rounded-full bg-white/5 text-slate-400 active:scale-90 transition-colors hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-violet-400 text-xs font-black uppercase mb-3">
              <Sparkles className="w-4 h-4 animate-pulse" /> Синергия
            </div>
            <h3 className={`text-lg font-black text-white uppercase tracking-wider mb-2 ${SYNERGY_DEFINITIONS[viewedSynergy.id]?.color}`}>
              {viewedSynergy.nameRu}
            </h3>
            <div className={`px-3 py-2 rounded-xl border mb-4 text-center text-sm font-black uppercase ${SYNERGY_DEFINITIONS[viewedSynergy.id]?.bg} ${SYNERGY_DEFINITIONS[viewedSynergy.id]?.border} ${SYNERGY_DEFINITIONS[viewedSynergy.id]?.color}`}>
              +{viewedSynergy.value} к силе
            </div>
            <p className="text-sm text-slate-300 leading-relaxed font-semibold">
              {viewedSynergy.description}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};