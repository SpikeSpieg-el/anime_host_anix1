"use client"

import { useState } from "react"
import { Settings, Map, Plus, Check, Trash2, ImageIcon, Power, Edit3, X } from "lucide-react"
import type { PvPRule, PvPLocation, BattleBackground } from "./types"

interface PvPTabProps {
  pvpRules: PvPRule[]
  pvpLocations: PvPLocation[]
  isPvPLoading: boolean
  showAddLocation: boolean
  onToggleAddLocation: () => void
  newLocation: { name: string; name_ru: string; description: string; description_ru: string; is_empty: boolean }
  onNewLocationChange: (location: PvPTabProps["newLocation"]) => void
  selectedRuleIds: string[]
  onToggleRuleId: (id: string) => void
  onCreateLocation: (e: React.FormEvent) => void
  onToggleRule: (id: string, currentStatus: boolean) => void
  onDeleteLocation: (id: string) => void
  battleBackgrounds: BattleBackground[]
  onAddBackground: (bg: { name: string; image_url: string; mode: string; scale: number; position_x: number; position_y: number; opacity: number }) => void
  onUpdateBackground: (id: string, updates: { name?: string; image_url?: string; mode?: string; scale?: number; position_x?: number; position_y?: number; opacity?: number }) => void
  onDeleteBackground: (id: string) => void
  onToggleBackground: (id: string, currentStatus: boolean) => void
}

export function PvPTab({
  pvpRules,
  pvpLocations,
  showAddLocation,
  onToggleAddLocation,
  newLocation,
  onNewLocationChange,
  selectedRuleIds,
  onToggleRuleId,
  onCreateLocation,
  onToggleRule,
  onDeleteLocation,
  battleBackgrounds,
  onAddBackground,
  onDeleteBackground,
  onToggleBackground,
  onUpdateBackground,
}: PvPTabProps) {
  const [showAddBg, setShowAddBg] = useState(false)
  const [newBg, setNewBg] = useState({ name: '', image_url: '', mode: 'both' as string, scale: 1.0, position_x: 50.0, position_y: 50.0, opacity: 0.35 })
  const [editingBgId, setEditingBgId] = useState<string | null>(null)
  const [editBg, setEditBg] = useState({ name: '', image_url: '', mode: 'both' as string, scale: 1.0, position_x: 50.0, position_y: 50.0, opacity: 0.35 })

  return (
    <div className="space-y-8 sm:space-y-12">
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            <Settings size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            PvP Rules (Modifiers)
          </h2>
          <div className="text-xs sm:text-sm text-muted-foreground">
            {pvpRules.filter(r => r.is_active).length} active / {pvpRules.length} total
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pvpRules.map((rule) => (
            <div key={rule.id} className={`p-4 rounded-lg border transition ${rule.is_active ? 'bg-card border-primary/20' : 'bg-muted/50 border-transparent opacity-60'}`}>
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-sm">{rule.name_ru}</h3>
                <button
                  onClick={() => onToggleRule(rule.id, rule.is_active)}
                  className={`w-10 h-5 rounded-full relative transition-colors ${rule.is_active ? 'bg-primary' : 'bg-muted'}`}
                >
                  <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${rule.is_active ? 'left-6' : 'left-1'}`} />
                </button>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{rule.description_ru}</p>
              <div className="text-[10px] uppercase tracking-wider text-primary font-bold">{rule.category}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            <Map size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Custom Locations
          </h2>
          <button
            onClick={onToggleAddLocation}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-sm w-fit"
          >
            <Plus size={18} />
            Add Location
          </button>
        </div>

        {showAddLocation && (
          <div className="bg-card border border-primary/30 rounded-xl p-4 sm:p-6 mb-6 sm:mb-8 shadow-xl">
            <form onSubmit={onCreateLocation} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Name (Internal)</label>
                  <input
                    type="text"
                    required
                    value={newLocation.name}
                    onChange={(e) => onNewLocationChange({ ...newLocation, name: e.target.value })}
                    placeholder="e.g. leaf_village"
                    className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Name (Russian)</label>
                  <input
                    type="text"
                    required
                    value={newLocation.name_ru}
                    onChange={(e) => onNewLocationChange({ ...newLocation, name_ru: e.target.value })}
                    placeholder="e.g. Деревня Листа"
                    className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Description (Internal)</label>
                  <textarea
                    required
                    value={newLocation.description}
                    onChange={(e) => onNewLocationChange({ ...newLocation, description: e.target.value })}
                    className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-20"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Description (Russian)</label>
                  <textarea
                    required
                    value={newLocation.description_ru}
                    onChange={(e) => onNewLocationChange({ ...newLocation, description_ru: e.target.value })}
                    className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-20"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 mb-4">
                <input
                  type="checkbox"
                  id="is_empty"
                  checked={newLocation.is_empty}
                  onChange={(e) => onNewLocationChange({ ...newLocation, is_empty: e.target.checked })}
                />
                <label htmlFor="is_empty" className="text-sm cursor-pointer">Neutral Location (No rules)</label>
              </div>

              {!newLocation.is_empty && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Select Rules (Max 1 per location usually)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-2 border border-border rounded bg-muted/30">
                    {pvpRules.filter(r => r.is_active).map(rule => (
                      <div
                        key={rule.id}
                        onClick={() => onToggleRuleId(rule.id)}
                        className={`p-2 rounded text-[10px] cursor-pointer transition flex items-center justify-between ${selectedRuleIds.includes(rule.id) ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted-foreground/10'}`}
                      >
                        <span className="truncate">{rule.name_ru}</span>
                        {selectedRuleIds.includes(rule.id) && <Check size={10} />}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={onToggleAddLocation}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition shadow-lg"
                >
                  Create Location
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
          {pvpLocations.map((loc) => (
            <div key={loc.id} className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm group">
              <div className="flex items-start justify-between mb-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-xl font-bold flex items-center gap-2">
                    {loc.name_ru}
                    {loc.is_empty && <span className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full uppercase tracking-tighter">Neutral</span>}
                  </h3>
                  <p className="text-sm text-muted-foreground italic">{loc.name}</p>
                </div>
                <button
                  onClick={() => onDeleteLocation(loc.id)}
                  className="p-2 text-muted-foreground hover:text-destructive transition sm:opacity-0 sm:group-hover:opacity-100 flex-shrink-0"
                >
                  <Trash2 size={20} />
                </button>
              </div>
              <p className="text-sm mb-4 line-clamp-3 break-words">{loc.description_ru}</p>

              <div className="flex flex-wrap gap-2">
                {loc.rules.map((ruleMapping: any) => {
                  const rule = pvpRules.find(r => r.id === ruleMapping.rule_id)
                  return (
                    <span key={ruleMapping.rule_id} className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-1 rounded-md font-semibold">
                      {rule?.name_ru || ruleMapping.rule_id}
                    </span>
                  )
                })}
                {loc.rules.length === 0 && !loc.is_empty && (
                  <span className="text-[10px] text-destructive font-bold uppercase">No rules assigned</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* BATTLE BACKGROUNDS */}
      <section>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 sm:mb-6">
          <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
            <ImageIcon size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
            Фоны битв (Battle Backgrounds)
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs sm:text-sm text-muted-foreground">
              {battleBackgrounds.filter(b => b.is_active).length} active / {battleBackgrounds.length} total
            </span>
            <button
              onClick={() => setShowAddBg(!showAddBg)}
              className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-sm w-fit"
            >
              <Plus size={18} />
              Добавить фон
            </button>
          </div>
        </div>

        {/* ADD FORM WITH PREVIEW + SLIDERS */}
        {showAddBg && (
          <div className="bg-card border border-primary/30 rounded-xl p-4 sm:p-6 mb-6 shadow-xl">
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!newBg.name || !newBg.image_url) return
                onAddBackground(newBg)
                setNewBg({ name: '', image_url: '', mode: 'both', scale: 1.0, position_x: 50.0, position_y: 50.0, opacity: 0.35 })
                setShowAddBg(false)
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Название</label>
                  <input
                    type="text"
                    required
                    value={newBg.name}
                    onChange={(e) => setNewBg({ ...newBg, name: e.target.value })}
                    placeholder="Напр. Лес Скрытого Листа"
                    className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Режим</label>
                  <select
                    value={newBg.mode}
                    onChange={(e) => setNewBg({ ...newBg, mode: e.target.value })}
                    className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  >
                    <option value="both">PvP и PvE</option>
                    <option value="pvp">Только PvP</option>
                    <option value="pve">Только PvE</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">URL изображения</label>
                <input
                  type="url"
                  required
                  value={newBg.image_url}
                  onChange={(e) => setNewBg({ ...newBg, image_url: e.target.value })}
                  placeholder="https://example.com/background.jpg"
                  className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                />
              </div>

              {/* LIVE PREVIEW */}
              {newBg.image_url && (
                <BattlePreview
                  imageUrl={newBg.image_url}
                  scale={newBg.scale}
                  positionX={newBg.position_x}
                  positionY={newBg.position_y}
                  opacity={newBg.opacity}
                />
              )}

              {/* SLIDERS */}
              {newBg.image_url && (
                <BgSliders values={newBg} onChange={setNewBg} />
              )}

              <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowAddBg(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition">
                  Отмена
                </button>
                <button type="submit" className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition shadow-lg">
                  Добавить
                </button>
              </div>
            </form>
          </div>
        )}

        {/* EDIT MODAL */}
        {editingBgId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4" onClick={() => setEditingBgId(null)}>
            <div className="bg-card border border-primary/30 rounded-xl p-4 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Edit3 size={20} className="text-primary" />
                  Редактирование фона
                </h3>
                <button onClick={() => setEditingBgId(null)} className="p-1.5 rounded-md hover:bg-muted transition">
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Название</label>
                    <input
                      type="text"
                      value={editBg.name}
                      onChange={(e) => setEditBg({ ...editBg, name: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Режим</label>
                    <select
                      value={editBg.mode}
                      onChange={(e) => setEditBg({ ...editBg, mode: e.target.value })}
                      className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                    >
                      <option value="both">PvP и PvE</option>
                      <option value="pvp">Только PvP</option>
                      <option value="pve">Только PvE</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">URL изображения</label>
                  <input
                    type="url"
                    value={editBg.image_url}
                    onChange={(e) => setEditBg({ ...editBg, image_url: e.target.value })}
                    className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
                  />
                </div>

                {/* LIVE PREVIEW */}
                {editBg.image_url && (
                  <BattlePreview
                    imageUrl={editBg.image_url}
                    scale={editBg.scale}
                    positionX={editBg.position_x}
                    positionY={editBg.position_y}
                    opacity={editBg.opacity}
                  />
                )}

                {/* SLIDERS */}
                {editBg.image_url && (
                  <BgSliders values={editBg} onChange={setEditBg} />
                )}

                <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
                  <button type="button" onClick={() => setEditingBgId(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition">
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onUpdateBackground(editingBgId, editBg)
                      setEditingBgId(null)
                    }}
                    className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition shadow-lg"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* GRID OF BACKGROUNDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {battleBackgrounds.map((bg) => (
            <div key={bg.id} className={`bg-card border rounded-xl overflow-hidden shadow-sm group transition ${bg.is_active ? 'border-border' : 'border-transparent opacity-50'}`}>
              <div className="relative h-28 bg-muted">
                <img src={bg.image_url} alt={bg.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.2' }} />
                <div className="absolute top-2 right-2 flex gap-1.5">
                  <button
                    onClick={() => {
                      setEditingBgId(bg.id)
                      setEditBg({ name: bg.name, image_url: bg.image_url, mode: bg.mode, scale: bg.scale ?? 1.0, position_x: bg.position_x ?? 50.0, position_y: bg.position_y ?? 50.0, opacity: bg.opacity ?? 0.35 })
                    }}
                    className="p-1.5 rounded-md bg-blue-500/80 text-white backdrop-blur-md hover:bg-blue-600 transition"
                    title="Редактировать"
                  >
                    <Edit3 size={14} />
                  </button>
                  <button
                    onClick={() => onToggleBackground(bg.id, bg.is_active)}
                    className={`p-1.5 rounded-md backdrop-blur-md transition ${bg.is_active ? 'bg-green-500/80 text-white hover:bg-green-600' : 'bg-muted/80 text-muted-foreground hover:bg-muted'}`}
                    title={bg.is_active ? 'Активен' : 'Выключен'}
                  >
                    <Power size={14} />
                  </button>
                  <button
                    onClick={() => onDeleteBackground(bg.id)}
                    className="p-1.5 rounded-md bg-destructive/80 text-white backdrop-blur-md hover:bg-destructive transition"
                    title="Удалить"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <div className="p-3">
                <h3 className="font-semibold text-sm truncate">{bg.name}</h3>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-[10px] uppercase tracking-wider font-bold ${bg.mode === 'pvp' ? 'text-violet-400' : bg.mode === 'pve' ? 'text-cyan-400' : 'text-emerald-400'}`}>
                    {bg.mode === 'both' ? 'PvP + PvE' : bg.mode.toUpperCase()}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {Math.round((bg.scale ?? 1) * 100)}% | {Math.round((bg.opacity ?? 0.35) * 100)}%
                  </span>
                </div>
              </div>
            </div>
          ))}
          {battleBackgrounds.length === 0 && (
            <div className="col-span-full text-center py-12 text-muted-foreground text-sm">
              Нет добавленных фонов. Нажмите «Добавить фон» для создания.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

// ============================================================
// Battle Preview Component — mimics the battle arena look
// ============================================================
function BattlePreview({ imageUrl, scale, positionX, positionY, opacity }: { imageUrl: string; scale: number; positionX: number; positionY: number; opacity: number }) {
  return (
    <div className="relative w-full aspect-[9/16] sm:aspect-[16/10] max-h-64 rounded-xl overflow-hidden bg-[#05050a] border border-border">
      {/* Background image with transform */}
      <img
        src={imageUrl}
        alt="Preview"
        className="absolute inset-0 w-full h-full"
        style={{
          objectFit: 'cover',
          objectPosition: `${positionX}% ${positionY}%`,
          transform: `scale(${scale})`,
          opacity: opacity,
        }}
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
      />
      {/* Dark gradient overlay — same as BattleArena */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#05050a]/60 via-[#05050a]/70 to-[#05050a]/85" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(99,102,241,0.08),transparent_70%)]" />

      {/* Mock battle arena UI elements */}
      <div className="absolute inset-0 flex flex-col justify-between p-2 sm:p-3 pointer-events-none">
        {/* Mock header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="px-2 py-1 rounded-md bg-violet-500/10 border border-violet-500/30 flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-violet-400" />
              <span className="text-[7px] font-black uppercase tracking-wider text-violet-400">PvP</span>
            </div>
            <div className="px-2 py-1 rounded-md bg-slate-950/60 border border-white/5 backdrop-blur-md">
              <span className="text-[7px] font-bold text-white/80">Round 1/3</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <div className="px-2 py-1 rounded-md bg-slate-950/60 border border-white/5 backdrop-blur-md">
              <span className="text-[7px] font-bold text-amber-400">100</span>
            </div>
          </div>
        </div>

        {/* Mock zones */}
        <div className="flex-1 flex flex-col gap-1.5 justify-center max-w-sm mx-auto w-full">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 sm:h-12 rounded-lg border border-white/10 bg-white/[0.02] backdrop-blur-sm flex items-center justify-center gap-2">
              <div className="w-6 h-8 rounded bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/20" />
              <div className="w-6 h-8 rounded bg-gradient-to-br from-rose-500/20 to-pink-500/20 border border-rose-500/20" />
              <span className="text-[7px] text-white/30 font-bold uppercase">Zone {i}</span>
            </div>
          ))}
        </div>

        {/* Mock hand */}
        <div className="flex justify-center gap-1.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-8 h-10 sm:w-10 sm:h-12 rounded-md bg-gradient-to-br from-slate-800/80 to-slate-900/80 border border-white/10" />
          ))}
        </div>
      </div>

      {/* Label */}
      <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-md">
        <span className="text-[8px] font-bold text-white/60 uppercase tracking-wider">Предпросмотр</span>
      </div>
    </div>
  )
}

// ============================================================
// Background Sliders Component
// ============================================================
function BgSliders({ values, onChange }: {
  values: { scale: number; position_x: number; position_y: number; opacity: number }
  onChange: (v: any) => void
}) {
  const sliderClass = "w-full h-2 rounded-lg appearance-none cursor-pointer bg-muted accent-primary"

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border">
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-muted-foreground uppercase">Масштаб</label>
          <span className="text-xs font-bold text-primary tabular-nums">{values.scale.toFixed(2)}x</span>
        </div>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.05"
          value={values.scale}
          onChange={(e) => onChange({ ...values, scale: parseFloat(e.target.value) })}
          className={sliderClass}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-muted-foreground uppercase">Прозрачность</label>
          <span className="text-xs font-bold text-primary tabular-nums">{Math.round(values.opacity * 100)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={values.opacity}
          onChange={(e) => onChange({ ...values, opacity: parseFloat(e.target.value) })}
          className={sliderClass}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-muted-foreground uppercase">Позиция X</label>
          <span className="text-xs font-bold text-primary tabular-nums">{Math.round(values.position_x)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={values.position_x}
          onChange={(e) => onChange({ ...values, position_x: parseFloat(e.target.value) })}
          className={sliderClass}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-xs font-medium text-muted-foreground uppercase">Позиция Y</label>
          <span className="text-xs font-bold text-primary tabular-nums">{Math.round(values.position_y)}%</span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={values.position_y}
          onChange={(e) => onChange({ ...values, position_y: parseFloat(e.target.value) })}
          className={sliderClass}
        />
      </div>
    </div>
  )
}
