import React from 'react';
import { Shield, Swords as SwordsIcon, X, Target, Info, Trophy, Skull, Dumbbell } from 'lucide-react';
import { Card, Dungeon, Enemy, BattleProgress, BattleLog } from '../types';
import { rarityConfig } from '@/types/gacha';
import { glassCard, glassButton, ROLE_CONFIG, PROVISION_LIMIT, DECK_SIZE } from '../config';
import { getCardBasePower } from '../utils';
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
}) => {
  const totalProvisionUsed = selectedCards.reduce((acc, c) => acc + (c.provisionCost || 4), 0);
  const isDeckValid = selectedCards.length === DECK_SIZE && totalProvisionUsed <= PROVISION_LIMIT;

  return (
    <div className='xl:col-span-4 sticky top-24 flex flex-col gap-6'>
      <div className={'rounded-[2rem] p-6 ' + glassCard + ' flex flex-col'}>
        <div className='flex items-center justify-between mb-2'>
          <h2 className='text-xl font-black text-white flex items-center gap-2'>
            <Shield className='w-5 h-5 text-indigo-400' />
            Твоя Колода
          </h2>
          <span className='text-xs font-black text-indigo-300'>
            {selectedCards.length} / {DECK_SIZE} карт
          </span>
        </div>

        {/* Provision Progress Bar */}
        <div className='mb-6 bg-black/30 rounded-xl p-3 border border-white/5'>
          <div className='flex justify-between items-center text-xs mb-1'>
            <span className='text-slate-400 font-bold flex items-center gap-1'>
              <Dumbbell className='w-3.5 h-3.5 text-indigo-400' /> Вес колоды
            </span>
            <span className={'font-black ' + (totalProvisionUsed > PROVISION_LIMIT ? 'text-rose-400' : 'text-emerald-400')}>
              {totalProvisionUsed} / {PROVISION_LIMIT}
            </span>
          </div>
          <div className='w-full h-2 bg-slate-800 rounded-full overflow-hidden'>
            <div
              className={'h-full transition-all duration-300 ' + (totalProvisionUsed > PROVISION_LIMIT ? 'bg-rose-500 shadow-[0_0_10px_#f43f5e]' : 'bg-indigo-500 shadow-[0_0_10px_#6366f1]')}
              style={{ width: Math.min(100, (totalProvisionUsed / PROVISION_LIMIT) * 100) + '%' }}
            />
          </div>
        </div>

        {/* Card slots visual grid */}
        <div className='grid grid-cols-4 gap-2 mb-6'>
          {Array.from({ length: DECK_SIZE }).map((_, slot) => {
            const card = selectedCards[slot];
            if (!card) {
              return (
                <button
                  key={slot}
                  onClick={() => setShowTeamBuilder(true)}
                  className="aspect-[2/3] rounded-xl border border-dashed border-white/10 bg-white/[0.01] hover:bg-white/[0.04] transition-all flex flex-col items-center justify-center gap-1 text-slate-500 hover:text-slate-300"
                >
                  <span className="text-sm sm:text-base font-black leading-none">+</span>
                  <span className="text-[6px] xs:text-[8px] uppercase tracking-wider font-bold">Слот {slot + 1}</span>
                </button>
              );
            }

            return (
              <div key={card.uniqueId} className="relative group aspect-[2/3]">
                <BattleCard
                  card={card}
                  size="sm"
                  onRemove={() => toggleCardSelection(card)}
                  className="w-full h-full"
                />
              </div>
            );
          })}
        </div>

        <button
          onClick={() => setShowTeamBuilder(true)}
          className={'w-full py-3 mb-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ' + glassButton + ' text-indigo-300'}
        >
          <Target className='w-4 h-4' /> Редактировать колоду
        </button>

        {/* Strength forecast */}
        <div className='bg-black/30 rounded-2xl p-4 border border-white/5 space-y-4'>
          <div className='flex items-end justify-between'>
            <div>
              <div className='text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1'>Сила колоды</div>
              <div className='text-xl font-black text-white'>{selectedCards.reduce((acc, c) => acc + getCardBasePower(c), 0).toLocaleString()}</div>
            </div>
            {selectedDungeon && (
              <div className='text-right'>
                <div className='text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-1'>Сложность</div>
                <div className='text-sm font-black text-rose-400'>Ур. {selectedDungeon.difficulty * 2}</div>
              </div>
            )}
          </div>

          {selectedDungeon && (
            <div className='pt-3 border-t border-white/5 flex items-center justify-between'>
              <span className='text-xs text-slate-400 flex items-center gap-1.5'>
                <Info className='w-3.5 h-3.5' /> Информация
              </span>
              <span className='text-[10px] text-slate-400 font-bold'>
                Враг ходит скрытно! Анализируйте КНБ роли!
              </span>
            </div>
          )}
        </div>

        <button
          onClick={startBattle}
          disabled={!isDeckValid || !selectedDungeon || (progress ? progress.current_stamina < selectedDungeon.energy_cost : false)}
          className='w-full mt-6 py-4 bg-white text-black hover:bg-slate-200 disabled:bg-white/5 disabled:text-slate-500 disabled:cursor-not-allowed font-black uppercase tracking-widest rounded-2xl transition-all active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.2)] disabled:shadow-none flex items-center justify-center gap-2'
        >
          <SwordsIcon className='w-5 h-5' />
          {selectedCards.length < DECK_SIZE
            ? 'Собери колоду (' + selectedCards.length + '/' + DECK_SIZE + ')'
            : totalProvisionUsed > PROVISION_LIMIT
            ? 'Превышен вес (' + totalProvisionUsed + '/' + PROVISION_LIMIT + ')'
            : !selectedDungeon
            ? 'Выбери локацию'
            : progress && progress.current_stamina < selectedDungeon.energy_cost
            ? 'Мало энергии (' + progress.current_stamina + '/' + selectedDungeon.energy_cost + ')'
            : 'Вступить в дуэль'}
        </button>
      </div>

      {/* Logs history */}
      {logs.length > 0 && (
        <div className={'rounded-[2rem] p-6 ' + glassCard}>
          <h3 className='text-sm font-black text-slate-400 uppercase tracking-widest mb-4'>Сводка операций</h3>
          <div className='space-y-2'>
            {logs.slice(0, 4).map((log) => (
              <div key={log.id} className='flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5'>
                <div className='flex items-center gap-3'>
                  <div
                    className={'p-1.5 rounded-lg ' + (log.result === 'win' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400')}
                  >
                    {log.result === 'win' ? <Trophy className='w-3.5 h-3.5' /> : <Skull className='w-3.5 h-3.5' />}
                  </div>
                  <div>
                    <div className='text-xs font-bold text-white'>{log.result === 'win' ? 'Успешно' : 'Провал'}</div>
                    <div className='text-[10px] text-slate-500'>{log.battle_turns} ходов</div>
                  </div>
                </div>
                {log.result === 'win' && (
                  <div className='text-right'>
                    <div className='text-[10px] font-bold text-yellow-400'>+{log.coins_earned} 💰</div>
                    <div className='text-[10px] font-bold text-blue-400'>+{log.xp_earned} XP</div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};