import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Save, 
  Trash2, 
  Download, 
  Plus, 
  X, 
  Edit2, 
  Check, 
  Swords, 
  Shield, 
  Sparkles, 
  AlertCircle, 
  Loader2,
  Crown 
} from 'lucide-react';
import { Card } from '../types';
import { FormationId } from '../config';
import { glassCard } from '../config';
import { getProxiedSrc } from '@/lib/image-loader';
import Image from 'next/image';

export interface DeckPreset {
  id: string;
  slot_number: number;
  name: string;
  card_ids: string[];
  leader_id: string | null;
  formation: FormationId;
  is_pvp: boolean;
  created_at?: string;
  updated_at?: string;
}

interface DeckPresetsProps {
  selectedCards: Card[];
  leaderId: string | null;
  formation: FormationId;
  isPvPMode?: boolean;
  onLoadPreset: (preset: DeckPreset) => void;
  session: any;
  collectedCards?: Card[];
}

export const DeckPresets: React.FC<DeckPresetsProps> = ({
  selectedCards,
  leaderId,
  formation,
  isPvPMode = false,
  onLoadPreset,
  session,
  collectedCards = []
}) => {
  const [presets, setPresets] = useState<DeckPreset[]>([]);
  const [activeTab, setActiveTab] = useState<'pve' | 'pvp'>(isPvPMode ? 'pvp' : 'pve');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Модальные окна
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [targetSlot, setTargetSlot] = useState<number>(1);
  const [presetNameInput, setPresetNameInput] = useState('');
  
  // Состояния подтверждений
  const [deletingSlot, setDeletingSlot] = useState<number | null>(null);
  const [loadedSlotId, setLoadedSlotId] = useState<number | null>(null);

  // Синхронизация вкладки с внешним режимом (если передан)
  useEffect(() => {
    setActiveTab(isPvPMode ? 'pvp' : 'pve');
  }, [isPvPMode]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const loadPresets = useCallback(async () => {
    if (!session?.access_token) return;
    try {
      setLoading(true);
      setError(null);
      const isPvP = activeTab === 'pvp';
      const res = await fetch(`/api/battle/presets?isPvP=${isPvP}`, {
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (!res.ok) {
        throw new Error('Не удалось загрузить пресеты');
      }

      const data = await res.json();
      setPresets(data.presets || []);
    } catch (err: any) {
      console.error('[DeckPresets] Load error:', err);
      setError(err.message || 'Ошибка сети при загрузке');
    } finally {
      setLoading(false);
    }
  }, [session?.access_token, activeTab]);

  useEffect(() => {
    loadPresets();
  }, [loadPresets]);

  const currentPresetsMap = useMemo(() => {
    const map = new Map<number, DeckPreset>();
    presets.forEach((p) => map.set(p.slot_number, p));
    return map;
  }, [presets]);

  // Helper to get card data from IDs
  const getCardById = useCallback((cardId: string | null): Card | null => {
    if (!cardId || !collectedCards.length) return null;
    return collectedCards.find(c => c.uniqueId === cardId) || null;
  }, [collectedCards]);

  // Helper to get first 3 cards from preset
  const getPresetCardPreview = useCallback((preset: DeckPreset): Card[] => {
    if (!collectedCards.length) return [];
    const cardIds = preset.card_ids || [];
    const firstThreeIds = cardIds.slice(0, 3);
    return firstThreeIds
      .map(id => getCardById(id))
      .filter((c): c is Card => c !== null);
  }, [getCardById, collectedCards]);

  // Custom image component with loading state
  const CardImage = ({ card }: { card: Card }) => {
    const [imageLoading, setImageLoading] = useState(true);

    useEffect(() => {
      setImageLoading(true);
    }, [card.uniqueId]);

    return (
      <>
        {imageLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-10">
            <Loader2 className="w-4 h-4 text-white/60 animate-spin" />
          </div>
        )}
        <Image
          src={getProxiedSrc(card.imageUrl)}
          alt={card.name}
          fill
          className="object-cover"
          sizes="32px"
          unoptimized
          onLoad={() => setImageLoading(false)}
          onError={() => setImageLoading(false)}
        />
      </>
    );
  };

  const handleOpenSaveModal = (slotNumber: number) => {
    setTargetSlot(slotNumber);
    const existing = currentPresetsMap.get(slotNumber);
    setPresetNameInput(existing ? existing.name : `Пресет ${slotNumber}`);
    setShowSaveModal(true);
  };

  const handleSavePreset = async () => {
    if (!session?.access_token) return;
    if (selectedCards.length === 0) {
      setError('Колода пуста. Выберите карты перед сохранением.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);

      const cardIds = selectedCards.map((c) => c.uniqueId);
      const cleanName = presetNameInput.trim() || `Пресет ${targetSlot}`;
      const isPvP = activeTab === 'pvp';

      const res = await fetch('/api/battle/presets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}` 
        },
        body: JSON.stringify({
          slotNumber: targetSlot,
          name: cleanName,
          cardIds,
          leaderId,
          formation,
          isPvP
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Ошибка при сохранении пресета');
      }

      await loadPresets();
      setShowSaveModal(false);
      showToast(`Пресет "${cleanName}" сохранён в слот ${targetSlot}!`);
    } catch (err: any) {
      console.error('[DeckPresets] Save error:', err);
      setError(err.message || 'Не удалось сохранить');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeletePreset = async (slotNumber: number) => {
    if (!session?.access_token) return;

    try {
      setActionLoading(true);
      setError(null);

      const isPvP = activeTab === 'pvp';
      const res = await fetch(`/api/battle/presets?slotNumber=${slotNumber}&isPvP=${isPvP}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` }
      });

      if (!res.ok) {
        throw new Error('Не удалось удалить пресет');
      }

      await loadPresets();
      setDeletingSlot(null);
      showToast(`Слот ${slotNumber} очищен`);
    } catch (err: any) {
      console.error('[DeckPresets] Delete error:', err);
      setError(err.message || 'Ошибка удаления');
    } finally {
      setActionLoading(false);
    }
  };

  const handleLoad = (preset: DeckPreset) => {
    onLoadPreset(preset);
    setLoadedSlotId(preset.slot_number);
    showToast(`Колода "${preset.name}" активирована!`);
    setTimeout(() => setLoadedSlotId(null), 2000);
  };

  return (
    <div className={`w-full rounded-2xl p-3.5 sm:p-5 ${glassCard} border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden`}>
      
      {/* Toast Alert */}
      {toastMessage && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 bg-emerald-500/90 text-white text-xs font-bold py-1.5 px-4 rounded-full shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          {toastMessage}
        </div>
      )}

      {/* Header bar with Mode Tabs */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-white/5 border border-white/10">
            {activeTab === 'pvp' ? (
              <Swords className="w-4 h-4 text-rose-400" />
            ) : (
              <Shield className="w-4 h-4 text-indigo-400" />
            )}
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider">
              Колоды
            </h3>
            <p className="text-[10px] text-white/50">Сохранение и быстрая смена ростеров</p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('pve')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'pve'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            PvE
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('pvp')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'pvp'
                ? 'bg-rose-600 text-white shadow-md'
                : 'text-white/60 hover:text-white'
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            PvP
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-3.5 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="p-1 hover:bg-rose-500/20 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Slots Grid: 1 col on ultra-narrow, 2 col on mobile, 3 col on tablets & desktop */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
        {(() => {
          // Показываем все слоты до последнего заполненного + один пустой
          const filledSlots = Array.from(currentPresetsMap.keys());
          const maxSlot = filledSlots.length > 0 ? Math.max(...filledSlots) : 0;
          const slotsToShow = Math.min(maxSlot + 1, 6); // максимум 6 слотов
          
          return Array.from({ length: slotsToShow }).map((_, i) => {
            const slotNumber = i + 1;
            const preset = currentPresetsMap.get(slotNumber);
            const isDeleting = deletingSlot === slotNumber;
            const isJustLoaded = loadedSlotId === slotNumber;

          return (
            <div
              key={slotNumber}
              className={`relative rounded-xl p-3 sm:p-3.5 border transition-all flex flex-col justify-between min-h-[110px] ${
                preset
                  ? isJustLoaded
                    ? 'bg-emerald-500/15 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                    : 'bg-white/[0.04] border-white/10 hover:border-white/25 hover:bg-white/[0.07]'
                  : 'bg-black/30 border-dashed border-white/15 hover:border-white/30 hover:bg-white/[0.02]'
              }`}
            >
              {preset ? (
                <>
                  {/* Card Header inside slot */}
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-white/10 text-white/70">
                        #{slotNumber}
                      </span>
                      <span className="text-xs font-bold text-white truncate" title={preset.name}>
                        {preset.name}
                      </span>
                    </div>

                    {/* Actions: Edit Name / Overwrite & Delete */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenSaveModal(slotNumber)}
                        className="p-1 rounded-md text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                        title="Перезаписать / Переименовать"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      {isDeleting ? (
                        <div className="flex items-center gap-1 animate-in fade-in duration-150">
                          <button
                            onClick={() => handleDeletePreset(slotNumber)}
                            disabled={actionLoading}
                            className="p-1 rounded-md bg-rose-500/20 text-rose-400 hover:bg-rose-500/40"
                            title="Подтвердить удаление"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => setDeletingSlot(null)}
                            className="p-1 rounded-md bg-white/10 text-white/70 hover:bg-white/20"
                            title="Отмена"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeletingSlot(slotNumber)}
                          className="p-1 rounded-md text-white/40 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                          title="Очистить слот"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Card Previews - Leader + First 3 Cards */}
                  <div className="mb-3 space-y-2">
                    {/* Leader Card */}
                    {(() => {
                      const leaderCard = getCardById(preset.leader_id);
                      if (!leaderCard) return null;
                      return (
                        <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/20 rounded-lg p-1.5">
                          <div className="relative w-8 h-8 rounded-md overflow-hidden shrink-0 bg-black/50">
                            <CardImage card={leaderCard} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <Crown className="w-3 h-3 text-amber-400 shrink-0" />
                              <span className="text-[10px] font-bold text-amber-200 truncate">
                                {leaderCard.name}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* First 3 Cards Preview */}
                    {(() => {
                      const previewCards = getPresetCardPreview(preset);
                      if (previewCards.length === 0) return null;
                      return (
                        <div className="flex gap-1.5">
                          {previewCards.map((card, idx) => (
                            <div
                              key={card.uniqueId}
                              className="relative w-8 h-8 rounded-md overflow-hidden shrink-0 bg-black/50 border border-white/10"
                              title={card.name}
                            >
                              <CardImage card={card} />
                            </div>
                          ))}
                          {preset.card_ids.length > 3 && (
                            <div className="w-8 h-8 rounded-md bg-white/5 border border-white/10 flex items-center justify-center">
                              <span className="text-[9px] font-bold text-white/60">
                                +{preset.card_ids.length - 3}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Metadata */}
                  <div className="flex items-center justify-between text-[10px] text-white/50 font-medium mb-3">
                    <span>{preset.card_ids?.length || 0} карт</span>
                    <span className="px-1.5 py-0.5 rounded bg-white/5 text-white/70 capitalize border border-white/5">
                      {preset.formation || 'balance'}
                    </span>
                  </div>

                  {/* Load Button */}
                  <button
                    onClick={() => handleLoad(preset)}
                    disabled={loading || actionLoading}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] ${
                      isJustLoaded
                        ? 'bg-emerald-500 text-white shadow-md'
                        : 'bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-200 border border-indigo-500/30'
                    }`}
                  >
                    {isJustLoaded ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        Активна
                      </>
                    ) : (
                      <>
                        <Download className="w-3.5 h-3.5" />
                        Загрузить
                      </>
                    )}
                  </button>
                </>
              ) : (
                /* Empty Slot Button */
                <button
                  type="button"
                  onClick={() => handleOpenSaveModal(slotNumber)}
                  disabled={selectedCards.length === 0}
                  className="w-full h-full min-h-[90px] flex flex-col items-center justify-center gap-1.5 text-white/40 hover:text-white/80 transition-colors group disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-110 group-hover:border-white/30 transition-all">
                    <Plus className="w-4 h-4 text-white/60 group-hover:text-white" />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] font-black uppercase tracking-wider text-white/60">
                      Слот {slotNumber}
                    </span>
                    <span className="text-[9px] text-white/40">
                      {selectedCards.length > 0 ? 'Сохранить колоду' : 'Пусто'}
                    </span>
                  </div>
                </button>
              )}
            </div>
          );
        });
        })()}
      </div>

      {/* Quick Save floating action if current deck is not empty */}
      {selectedCards.length > 0 && (
        <div className="mt-3.5 pt-3 border-t border-white/5 flex flex-wrap items-center justify-between gap-2">
          <div className="text-[11px] text-white/60 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>В текущей колоде: <strong className="text-white">{selectedCards.length}</strong> карт</span>
          </div>
          <button
            onClick={() => handleOpenSaveModal(1)}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
          >
            <Save className="w-3.5 h-3.5" />
            Сохранить в слот...
          </button>
        </div>
      )}

      {/* Save / Edit Modal */}
      {showSaveModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setShowSaveModal(false)}
        >
          <div
            className="bg-[#0e0e18] border border-white/15 rounded-2xl p-5 sm:p-6 max-w-sm w-full shadow-2xl relative animate-in zoom-in-95 duration-200 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowSaveModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-lg bg-white/5 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <h3 className="text-base font-black text-white mb-1">Сохранить колоду</h3>
            <p className="text-xs text-white/50 mb-4">
              Режим: <strong className="text-white uppercase">{activeTab}</strong> • Карт: {selectedCards.length}
            </p>

            {/* Выбор слота внутри модалки */}
            <div className="mb-4">
              <label className="block text-[11px] font-bold text-white/70 uppercase mb-2">Выберите слот</label>
              <div className="grid grid-cols-6 gap-1.5">
                {Array.from({ length: 6 }).map((_, i) => {
                  const s = i + 1;
                  const isSelected = targetSlot === s;
                  const isOccupied = currentPresetsMap.has(s);

                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        setTargetSlot(s);
                        const existing = currentPresetsMap.get(s);
                        setPresetNameInput(existing ? existing.name : `Пресет ${s}`);
                      }}
                      className={`py-2 rounded-lg text-xs font-black transition-all border ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-400 text-white shadow-lg'
                          : isOccupied
                          ? 'bg-white/10 border-white/15 text-white/90'
                          : 'bg-black/30 border-dashed border-white/15 text-white/40'
                      }`}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
              {currentPresetsMap.has(targetSlot) && (
                <p className="text-[10px] text-amber-400/90 mt-1.5">
                  ⚠️ Слот {targetSlot} уже занят. Сохранение перезапишет его.
                </p>
              )}
            </div>

            {/* Поле имени */}
            <div className="mb-5">
              <label className="block text-[11px] font-bold text-white/70 uppercase mb-1.5">
                Название пресета
              </label>
              <input
                type="text"
                maxLength={24}
                value={presetNameInput}
                onChange={(e) => setPresetNameInput(e.target.value)}
                className="w-full bg-black/60 border border-white/20 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                placeholder={`Пресет ${targetSlot}`}
                autoFocus
              />
            </div>

            {/* Кнопки действий */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setShowSaveModal(false)}
                className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 font-bold text-xs uppercase tracking-wider"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSavePreset}
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-600 hover:from-indigo-600 hover:to-violet-700 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-500/20 disabled:opacity-40 flex items-center justify-center gap-1.5 transition-all"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Сохранение...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5" />
                    Сохранить
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};