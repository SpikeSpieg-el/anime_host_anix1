import React, { useState } from 'react';
import { Shield, Swords as SwordsIcon, Target, Info, Trophy, Skull, Dumbbell, Crown, Sparkles, Zap, X } from 'lucide-react';
import { Card, Dungeon, Enemy, BattleProgress, BattleLog, DeckSynergy } from '../types';
import { glassCard, glassButton, PROVISION_LIMIT, DECK_SIZE, FORMATION_CONFIG, SYNERGY_DEFINITIONS, SYNERGY_TOTAL_CAP, FormationId } from '../config';
import { getCardBasePower, computeDeckSynergies, getCardProvision } from '../utils';
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
}) => {
  const [viewedSynergy, setViewedSynergy] = useState<DeckSynergy | null>(null)

  const totalProvisionUsed = selectedCards.reduce((acc, c) => acc + (c.provisionCost || getCardProvision(c)), 0);
  const isDeckValid = selectedCards.length === DECK_SIZE && totalProvisionUsed <= PROVISION_LIMIT;

  const synergyResult = computeDeckSynergies(selectedCards);
  const totalBonus = synergyResult.globalBonus;

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
            <div className="mt-2 text-xs font-bold text-white truncate">
              {selectedCards.find(c => c.uniqueId === leaderId)?.name || "Не найден"}
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
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Сила колоды</div>
              <div className="text-lg font-black text-white flex items-center gap-1">
                <span className="text-emerald-400">⚡</span>
                {selectedCards.reduce((acc, c) => acc + getCardBasePower(c), 0).toLocaleString()}
              </div>
            </div>
            {totalBonus > 0 && (
              <div className="text-right">
                <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Бонус колоды</div>
                <div className="text-xs font-black text-violet-400 bg-violet-500/10 px-2 py-0.5 rounded-md border border-violet-500/20">
                  +{totalBonus}
                </div>
              </div>
            )}
            {selectedDungeon && (
              <div className="text-right">
                <div className="text-[8px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Сложность</div>
                <div className="text-xs font-black text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                  Ур. {selectedDungeon.difficulty * 2}
                </div>
              </div>
            )}
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
        <button
          onClick={startBattle}
          disabled={!isDeckValid || !selectedDungeon || (progress ? progress.current_stamina < selectedDungeon.energy_cost : false)}
          className="w-full mt-4 py-4 rounded-2xl font-black uppercase tracking-widest text-xs transition-all duration-300 active:scale-95 disabled:pointer-events-none disabled:opacity-40
            bg-gradient-to-r from-amber-400 via-orange-500 to-amber-500 text-black shadow-[0_4px_20px_rgba(245,158,11,0.4)] border-b-4 border-amber-700 hover:brightness-110"
        >
          {selectedCards.length < DECK_SIZE
            ? `Собери колоду (${selectedCards.length}/${DECK_SIZE})`
            : totalProvisionUsed > PROVISION_LIMIT
            ? 'Превышен вес колоды'
            : !selectedDungeon
            ? 'Выбери локацию'
            : progress && progress.current_stamina < selectedDungeon.energy_cost
            ? `Мало энергии (${progress.current_stamina}/${selectedDungeon.energy_cost})`
            : 'Вступить в дуэль'}
        </button>
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