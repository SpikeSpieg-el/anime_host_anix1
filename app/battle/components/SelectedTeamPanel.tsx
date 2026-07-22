import React, { useState } from 'react';
import { Shield, Swords as SwordsIcon, Target, Info, Trophy, Skull, Dumbbell, Crown, Sparkles, Zap, X, Mountain, Footprints, Wand2 } from 'lucide-react';
import { Card, Dungeon, Enemy, BattleProgress, BattleLog, DeckSynergy } from '../types';
import { glassCard, glassButton, PROVISION_LIMIT, DECK_SIZE, FORMATION_CONFIG, SYNERGY_DEFINITIONS, SYNERGY_TOTAL_CAP, FormationId, THEME_CONFIG, LEADER_AURA_CONFIG, LEADER_AURA_VALUE, ROLE_CONFIG } from '../config';
import { getDeckPowerModifier } from '../utils';
import { getCardBasePower, computeDeckSynergies, getCardProvision, getCardRole } from '../utils';
import { BattleCard } from './BattleCard';

export const SelectedTeamPanelSkeleton: React.FC = () => {
  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4 p-2 sm:p-4 lg:max-w-none">
      <div className={`rounded-3xl p-5 ${glassCard} border border-white/10 backdrop-blur-xl relative overflow-hidden shadow-2xl animate-pulse`}>
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-white/10 w-8 h-8" />
            <div className="space-y-1">
              <div className="h-4 w-24 bg-white/10 rounded" />
              <div className="h-2 w-16 bg-white/5 rounded" />
            </div>
          </div>
          <div className="px-2.5 py-1 rounded-full bg-white/10 w-12 h-5" />
        </div>

        <div className="mb-5 bg-black/40 rounded-2xl p-3 border border-white/5 relative z-10">
          <div className="flex justify-between items-center mb-1.5">
            <div className="h-2.5 w-20 bg-white/10 rounded" />
            <div className="h-2.5 w-12 bg-white/10 rounded" />
          </div>
          <div className="w-full h-2.5 bg-slate-900 rounded-full overflow-hidden p-[2px] border border-white/5">
            <div className="h-full rounded-full bg-white/10 w-3/4" />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mb-5 relative z-10">
          {Array.from({ length: DECK_SIZE }).map((_, slot) => (
            <div key={slot} className="aspect-[2/3] rounded-xl bg-white/5 border border-white/5" />
          ))}
        </div>

        <div className="w-full py-3 mb-4 rounded-xl bg-white/5 h-10" />

        <div className="mb-4 bg-black/40 rounded-2xl p-3 border border-white/5 relative z-10">
          <div className="flex items-center justify-between mb-2">
            <div className="h-2.5 w-16 bg-white/10 rounded" />
          </div>
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 py-2 rounded-lg bg-white/5 h-8" />
            ))}
          </div>
        </div>

        <div className="bg-black/40 rounded-2xl p-3.5 border border-white/5 space-y-3 relative z-10">
          <div className="flex items-center justify-between pb-2.5 border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-3.5 h-3.5 bg-white/10 rounded" />
              <div className="space-y-0.5">
                <div className="h-2 w-12 bg-white/5 rounded" />
                <div className="h-3 w-16 bg-white/10 rounded" />
              </div>
            </div>
            <div className="text-right">
              <div className="h-2 w-8 bg-white/5 rounded mb-0.5" />
              <div className="h-3 w-10 bg-white/10 rounded" />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="h-2 w-16 bg-white/5 rounded" />
              <div className="h-5 w-20 bg-white/10 rounded" />
            </div>
            <div className="text-right space-y-1">
              <div className="h-2.5 w-10 bg-white/10 rounded" />
              <div className="h-2.5 w-10 bg-white/10 rounded" />
            </div>
          </div>
        </div>

        <div className="w-full mt-4 py-4 rounded-2xl bg-white/5 h-12" />
      </div>
    </div>
  )
}

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
  onAutoBuild?: () => void
  isPvPOnly?: boolean
}

// Helper function to convert difficulty to vague threat description
function getThreatDescription(difficulty: number): string {
  if (difficulty <= 1) return 'Слабая'
  if (difficulty <= 2) return 'Легкая'
  if (difficulty <= 3) return 'Средняя'
  if (difficulty <= 4) return 'Высокая'
  if (difficulty <= 5) return 'Очень высокая'
  return 'Экстремальная'
}

// Helper function to calculate vague enemy deck power range
function getEnemyPowerRange(dungeon: Dungeon): string {
  // Base power estimate based on difficulty
  const basePower = dungeon.difficulty * 100
  
  // Add variance (±15%)
  const variance = Math.round(basePower * 0.15)
  const minPower = basePower - variance
  const maxPower = basePower + variance
  
  return `${minPower} - ${maxPower}`
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
  onAutoBuild,
  isPvPOnly = false,
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

  // Calculate formation bonus for deck power display
  let formationBonus = 0
  selectedCards.forEach(card => {
    const cardRole = card.role || getCardRole(card)
    const formationConfig = FORMATION_CONFIG[formation]
    if (formationConfig) {
      formationBonus += formationConfig[cardRole] || 0
    }
  })

  return (
    <div className="w-full flex flex-col gap-4 p-2 sm:p-4">
      {/* Основной контейнер колоды */}
      <div data-tutorial="battle-deck" className={`rounded-3xl p-5 lg:p-8 ${glassCard} border border-white/10 backdrop-blur-xl relative overflow-hidden shadow-2xl`}>
        {/* Фоновое декоративное свечение */}
        <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between mb-4 relative z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base lg:text-lg font-black text-white uppercase tracking-wider">Ваша колода</h2>
              <p className="text-[10px] lg:text-xs text-slate-400 font-bold">Собрано карт для дуэли</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-500/30 text-xs lg:text-sm font-black text-indigo-300">
            {selectedCards.length} / {DECK_SIZE}
          </span>
        </div>

        {/* Шкала лимита веса (Provision) */}
        <div data-tutorial="battle-provision" className="mb-5 bg-black/40 rounded-2xl p-3 border border-white/5 relative z-10">
          <div className="flex justify-between items-center text-[10px] lg:text-xs font-bold mb-1.5 uppercase tracking-wider">
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

        {/* Desktop: двухколоночная сетка тела */}
        <div className="lg:grid lg:grid-cols-5 lg:gap-8">
          {/* ЛЕВАЯ КОЛОНКА — Карты */}
          <div className="lg:col-span-3 flex flex-col gap-4">
            {/* Сетка слотов (Мини-карты) */}
            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4 lg:gap-4 relative z-10 justify-items-center">
              {Array.from({ length: DECK_SIZE }).map((_, slot) => {
                const card = selectedCards[slot];
                if (!card) {
                  return (
                    <button
                      key={slot}
                      onClick={() => setShowTeamBuilder(true)}
                      className="w-[160px] h-[240px] lg:w-[170px] lg:h-[255px] rounded-xl border-2 border-dashed border-white/10 bg-white/[0.02] hover:bg-white/[0.05] active:scale-95 transition-all flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-300"
                    >
                      <span className="text-lg font-black text-indigo-400/60">+</span>
                      <span className="text-[7px] uppercase tracking-wider font-extrabold text-slate-500">Слот {slot + 1}</span>
                    </button>
                  );
                }

                return (
                  <div key={card.uniqueId} className="relative transform transition-transform active:scale-95">
                    <BattleCard
                      card={card}
                      size="lg"
                      onRemove={() => toggleCardSelection(card)}
                      onClick={() => onCardClick?.(card)}
                      className="shadow-lg w-[160px] h-[240px] lg:w-[170px] lg:h-[255px]"
                    />
                  </div>
                );
              })}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowTeamBuilder(true)}
                className={`flex-1 py-3 lg:py-4 rounded-xl text-xs lg:text-base font-black uppercase tracking-wider flex items-center justify-center gap-2 ${glassButton} text-indigo-300 border border-indigo-500/20 active:scale-98 transition-all`}
              >
                <Target className="w-3.5 h-3.5 lg:w-5 lg:h-5" /> Изменить состав
              </button>
              {onAutoBuild && (
                <button
                  onClick={onAutoBuild}
                  className="px-3 lg:px-4 py-3 lg:py-4 rounded-xl text-xs lg:text-sm font-black uppercase tracking-wider flex items-center justify-center gap-2 bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 border border-violet-500/30 active:scale-95 transition-all"
                  title="Автоматически собрать лучшую колоду из ваших карт"
                >
                  <Wand2 className="w-3.5 h-3.5 lg:w-5 lg:h-5" />
                  <span className="hidden sm:inline">Авто</span>
                </button>
              )}
            </div>
          </div>

          {/* ПРАВАЯ КОЛОНКА — Управление и статы */}
          <div className="lg:col-span-2 flex flex-col gap-4 mt-4 lg:mt-0 lg:gap-5">
            {/* Formation Selector */}
            <div data-tutorial="battle-formation" className="bg-black/40 rounded-2xl p-3 lg:p-4 border border-white/5 relative z-10">
              <div className="flex items-center justify-between text-[10px] lg:text-sm font-bold mb-2 lg:mb-3 uppercase tracking-wider">
                <span className="text-slate-400 flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 lg:w-5 lg:h-5 text-amber-400" /> Формация
                </span>
              </div>
              <div className="flex gap-2 lg:gap-3">
                {(Object.keys(FORMATION_CONFIG) as FormationId[]).map((fid) => {
                  const f = FORMATION_CONFIG[fid]
                  const isSelected = formation === fid
                  return (
                    <button
                      key={fid}
                      onClick={() => setFormation(fid)}
                      className={`flex-1 py-2 lg:py-3 rounded-lg text-[10px] lg:text-sm font-black uppercase tracking-wider border transition-all ${
                        isSelected
                          ? `${f.bg} ${f.color} ${f.border} shadow-[0_0_10px_rgba(255,255,255,0.05)]`
                          : "bg-white/5 text-slate-400 border-transparent hover:bg-white/10"
                      }`}
                      title={f.description}
                    >
                      {f.nameRu}
                    </button>
                  )
                })}
              </div>
              <div className="mt-2 text-[9px] lg:text-xs text-slate-400 font-medium leading-tight">
                {FORMATION_CONFIG[formation].description}
              </div>
            </div>

            {/* Leader Display */}
            {leaderId && (
              <div className="bg-amber-500/5 rounded-2xl p-3 lg:p-4 border border-amber-500/20 relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Crown className="w-4 h-4 lg:w-5 lg:h-5 text-amber-400" />
                    <span className="text-[10px] lg:text-sm font-black text-amber-300 uppercase tracking-wider">Лидер</span>
                  </div>
                  <button
                    onClick={() => setLeaderId(null)}
                    className="text-[8px] lg:text-sm text-slate-400 hover:text-rose-400 font-black uppercase transition-colors"
                  >
                    Убрать
                  </button>
                </div>
                <div className="mt-2">
                  <div className="text-xs lg:text-base font-bold text-white truncate">
                    {selectedCards.find(c => c.uniqueId === leaderId)?.name || "Не найден"}
                  </div>
                  <div className="mt-1.5 text-[9px] lg:text-sm text-amber-200/80 font-medium leading-tight">
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
              <div className="bg-violet-500/5 rounded-2xl p-3 lg:p-4 border border-violet-500/20 relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 lg:w-5 lg:h-5 text-violet-400" />
                    <span className="text-[10px] lg:text-sm font-black text-violet-300 uppercase tracking-wider">Синергии</span>
                  </div>
                  <span className="text-[10px] lg:text-sm font-black text-emerald-400">+{totalBonus}</span>
                </div>
                <div className="flex flex-wrap gap-1.5 lg:gap-2">
                  {synergyResult.active.map((syn) => (
                    <div
                      key={syn.id}
                      onClick={() => setViewedSynergy(syn)}
                      className={`px-2 py-1 lg:px-3 lg:py-1.5 rounded-md border cursor-pointer hover:scale-105 transition-transform ${SYNERGY_DEFINITIONS[syn.id]?.bg} ${SYNERGY_DEFINITIONS[syn.id]?.border} ${SYNERGY_DEFINITIONS[syn.id]?.color} text-[8px] lg:text-sm font-black uppercase tracking-wider`}
                      title={syn.description}
                    >
                      {syn.nameRu}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Сводка силы колоды */}
            <div data-tutorial="battle-power" className="bg-black/40 rounded-2xl p-3.5 lg:p-5 border border-white/5 space-y-3 relative z-10 flex-1">
              {selectedDungeon && (
                <div className="flex items-center justify-between pb-2.5 border-b border-white/5">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const theme = THEME_CONFIG[selectedDungeon.theme] || THEME_CONFIG.dark_forest
                      const ThemeIcon = theme.icon
                      return <ThemeIcon className={`w-3.5 h-3.5 lg:w-4 lg:h-4 ${theme.color}`} />
                    })()}
                    <div>
                      <div className="text-[8px] lg:text-xs text-slate-500 uppercase font-black tracking-widest">Локация</div>
                      <div className="text-xs lg:text-sm font-bold text-white">{selectedDungeon.name_ru}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[8px] lg:text-xs text-slate-500 uppercase font-black tracking-widest mb-0.5">Угроза</div>
                    <div className="text-xs lg:text-sm font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                      {getThreatDescription(selectedDungeon.difficulty)}
                    </div>
                    <div className="text-[8px] lg:text-xs text-slate-500 uppercase font-black tracking-widest mb-0.5 mt-1">Сила врага</div>
                    <div className="text-xs lg:text-sm font-black text-white bg-white/10 px-2 py-0.5 rounded-md border border-white/20">
                      {getEnemyPowerRange(selectedDungeon)}
                    </div>
                  </div>
                </div>
              )}

              <div 
                className="flex items-center justify-between cursor-pointer hover:bg-white/5 rounded-lg p-2 -mx-2 transition-colors"
                onClick={() => setShowPowerBreakdown(true)}
              >
                <div>
                  <div className="text-[8px] lg:text-xs text-slate-500 uppercase font-black tracking-widest mb-0.5">Сила колоды</div>
                  <div className="text-lg lg:text-3xl font-black text-white flex items-center gap-1">
                    <Zap className="w-4 h-4 lg:w-6 lg:h-6 text-emerald-400" />
                    {(selectedCards.reduce((acc, c) => acc + getCardBasePower(c), 0) + totalBonus + leaderAuraBonus + formationBonus).toLocaleString()}
                  </div>
                </div>
                <div className="text-right space-y-1">
                  {totalBonus > 0 && (
                    <div>
                      <div className="text-[8px] lg:text-xs text-slate-500 uppercase font-black tracking-widest mb-0.5">Синергии</div>
                      <div className="text-xs lg:text-sm font-black text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20">
                        +{totalBonus}
                      </div>
                    </div>
                  )}
                  {leaderAuraBonus > 0 && (
                    <div>
                      <div className="text-[8px] lg:text-xs text-slate-500 uppercase font-black tracking-widest mb-0.5">Аура лидера</div>
                      <div className="text-xs lg:text-sm font-black text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                        +{leaderAuraBonus}
                      </div>
                    </div>
                  )}
                  {formationBonus !== 0 && (
                    <div>
                      <div className="text-[8px] lg:text-xs text-slate-500 uppercase font-black tracking-widest mb-0.5">Формация</div>
                      <div className={`text-xs lg:text-sm font-black ${formationBonus > 0 ? 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'} px-2 py-0.5 rounded-md border`}>
                        {formationBonus > 0 ? '+' : ''}{formationBonus}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {selectedDungeon && (
                <div className="pt-2.5 border-t border-white/5 flex items-center justify-between">
                  <span className="text-[9px] lg:text-xs text-slate-400 flex items-center gap-1">
                    <Info className="w-3 h-3 text-slate-500" /> Подсказка
                  </span>
                  <span className="text-[8px] lg:text-xs text-indigo-300 font-extrabold uppercase">
                    Анализируйте КНБ-эффект ролей!
                  </span>
                </div>
              )}
            </div>

            {/* Главная кнопка боя */}
            {!selectedDungeon && !isPvPOnly ? (
              <button
                data-tutorial="battle-location"
                onClick={onOpenLocationSelector}
                className="w-full py-4 lg:py-5 rounded-2xl font-black uppercase tracking-widest text-xs lg:text-base transition-all duration-300 active:scale-95
                  bg-gradient-to-r from-indigo-400 via-blue-500 to-indigo-500 text-white shadow-[0_4px_20px_rgba(99,102,241,0.4)] border-b-4 border-indigo-700 hover:brightness-110"
              >
                Выбрать локацию
              </button>
            ) : isPvPOnly ? (
              <button
                data-tutorial="battle-start"
                onClick={startBattle}
                disabled={selectedCards.length < DECK_SIZE || totalProvisionUsed > PROVISION_LIMIT}
                className="w-full py-4 lg:py-5 rounded-2xl font-black uppercase tracking-widest text-xs lg:text-base transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-40
                  bg-gradient-to-r from-purple-400 via-pink-500 to-purple-500 text-white shadow-[0_4px_20px_rgba(168,85,247,0.4)] border-b-4 border-purple-700 hover:brightness-110"
              >
                {selectedCards.length < DECK_SIZE
                  ? `Собери колоду (${selectedCards.length}/${DECK_SIZE})`
                  : totalProvisionUsed > PROVISION_LIMIT
                  ? 'Превышен вес колоды'
                  : 'В PvP Арену'}
              </button>
            ) : (
              <div className="flex gap-3">
                <button
                  data-tutorial="battle-start"
                  onClick={startBattle}
                  disabled={!isDeckValid || (progress ? progress.current_stamina < selectedDungeon!.energy_cost : false)}
                  className="flex-1 py-4 lg:py-5 rounded-2xl font-black uppercase tracking-widest text-xs lg:text-base transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-40
                    bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-black shadow-[0_4px_20px_rgba(245,158,11,0.4)] border-b-4 border-amber-700 hover:brightness-110"
                >
                  {selectedCards.length < DECK_SIZE
                    ? `Собери колоду (${selectedCards.length}/${DECK_SIZE})`
                    : totalProvisionUsed > PROVISION_LIMIT
                    ? 'Превышен вес колоды'
                    : progress && progress.current_stamina < selectedDungeon!.energy_cost
                    ? `Мало энергии (${progress.current_stamina}/${selectedDungeon!.energy_cost})`
                    : 'Вступить в дуэль'}
                </button>
                <button
                  data-tutorial="battle-location"
                  onClick={onOpenLocationSelector}
                  className="px-4 py-4 lg:px-6 lg:py-5 rounded-2xl font-black uppercase tracking-widest text-[10px] lg:text-sm transition-all duration-300 active:scale-95
                    bg-gradient-to-r from-indigo-400 via-blue-500 to-indigo-500 text-white shadow-[0_4px_20px_rgba(99,102,241,0.4)] border-b-4 border-indigo-700 hover:brightness-110"
                >
                  Локация
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* История игр */}
      {logs.length > 0 && (
        <div className={`rounded-3xl p-5 lg:p-6 ${glassCard} border border-white/5 shadow-xl`}>
          <h3 className="text-[10px] lg:text-sm font-black text-slate-400 uppercase tracking-widest mb-3 lg:mb-4">История игр</h3>
          <div className="space-y-2 lg:space-y-3">
            {logs.slice(0, 3).map((log) => (
              <div key={log.id} className="flex items-center justify-between p-2.5 lg:p-4 rounded-xl bg-black/40 border border-white/5">
                <div className="flex items-center gap-2.5 lg:gap-4">
                  <div className={`p-1.5 lg:p-2.5 rounded-lg ${log.result === 'win' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>
                    {log.result === 'win' ? <Trophy className="w-3.5 h-3.5 lg:w-5 lg:h-5" /> : <Skull className="w-3.5 h-3.5 lg:w-5 lg:h-5" />}
                  </div>
                  <div>
                    <div className="text-xs lg:text-base font-black text-white">{log.result === 'win' ? 'Победа' : 'Поражение'}</div>
                    <div className="text-[9px] lg:text-sm text-slate-500">{log.battle_turns} раундов</div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  {log.result === 'win' ? (
                    <>
                      <div className="text-[10px] lg:text-sm font-black text-yellow-400">+{log.coins_earned} 💰</div>
                      {log.dust_earned > 0 && (
                        <div className="text-[9px] lg:text-xs font-black text-amber-400">+{log.dust_earned} ✨</div>
                      )}
                      <div className="text-[9px] lg:text-xs font-black text-blue-400">+{log.xp_earned} XP</div>
                    </>
                  ) : (
                    <div className="text-[9px] lg:text-xs font-black text-slate-500">Нет наград</div>
                  )}
                  <div className="text-[8px] lg:text-[10px] font-black text-orange-400/70">
                    -{log.energy_cost || 1} ⚡
                  </div>
                </div>
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

                // Calculate formation bonus directly from config
                const formationConfig = FORMATION_CONFIG[formation]
                const formationBonus = formationConfig ? (formationConfig[role] || 0) : 0
                const totalBonus = totalSynergyBonus + leaderBonus + formationBonus
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
                        {(totalSynergyBonus !== 0 || leaderBonus !== 0 || formationBonus !== 0) && (
                          <div className="flex items-center gap-1 text-slate-500 mt-0.5 text-[10px]">
                            {totalSynergyBonus !== 0 && <span className="text-violet-400">син:{totalSynergyBonus}</span>}
                            {totalSynergyBonus !== 0 && (leaderBonus !== 0 || formationBonus !== 0) && <span>+</span>}
                            {leaderBonus !== 0 && <span className="text-amber-400">аура:{leaderBonus}</span>}
                            {leaderBonus !== 0 && formationBonus !== 0 && <span>+</span>}
                            {formationBonus !== 0 && <span className="text-cyan-400">форм:{formationBonus}</span>}
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
                  {(selectedCards.reduce((acc, c) => acc + getCardBasePower(c), 0) + totalBonus + leaderAuraBonus + formationBonus).toLocaleString()}
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