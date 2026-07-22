"use client"

import { Calendar, Plus, Check, Edit, Trash2, Sparkles } from "lucide-react"
import { rarityConfig } from "@/types/gacha"
import type { Rarity } from "@/types/gacha"
import type { Banner, BannerCard } from "./types"
import { GRADIENT_PRESETS } from "./constants"

interface BannerFormData {
  name: string
  description: string
  image_url: string
  promo_image_url: string
  featured_anime_ids: string
  boosted_rarity: Rarity | ""
  price: string
  color: string
  start_date: string
  end_date: string
  is_active: boolean
  sort_order: number
  guaranteed_card_json: string
  guaranteed_card_pity: string
  banner_type: "standard" | "dynamic"
}

interface EventsTabProps {
  banners: Banner[]
  isBannersLoading: boolean
  showCreateBanner: boolean
  onToggleCreateBanner: () => void
  newBanner: BannerFormData
  onNewBannerChange: (banner: BannerFormData) => void
  onCreateBanner: (e: React.FormEvent) => void
  editingBannerId: string | null
  editBanner: BannerFormData | null
  onEditBannerChange: (banner: BannerFormData) => void
  onStartEditBanner: (banner: Banner) => void
  onSaveEditBanner: () => void
  onCancelEditBanner: () => void
  onDeleteBanner: (id: string) => void
  onToggleBannerActive: (banner: Banner) => void
  expandedBannerId: string | null
  onToggleBannerExpand: (bannerId: string) => void
  bannerCards: Record<string, BannerCard[]>
  bannerCardsLoading: string | null
  newBannerCardJson: Record<string, string>
  onNewBannerCardJsonChange: (bannerId: string, value: string) => void
  newBannerCardWeight: Record<string, number>
  onNewBannerCardWeightChange: (bannerId: string, value: number) => void
  newBannerCardFeatured: Record<string, boolean>
  onNewBannerCardFeaturedChange: (bannerId: string, value: boolean) => void
  onAddBannerCard: (bannerId: string) => void
  onUpdateBannerCard: (card: BannerCard) => void
  onDeleteBannerCard: (cardId: string, bannerId: string) => void
  onBannerCardsChange: (bannerId: string, cards: BannerCard[]) => void
  formatDate: (dateString: string | null) => string
}

export function EventsTab(props: EventsTabProps) {
  const {
    banners,
    isBannersLoading,
    showCreateBanner,
    onToggleCreateBanner,
    newBanner,
    onNewBannerChange,
    onCreateBanner,
    editingBannerId,
    editBanner,
    onEditBannerChange,
    onStartEditBanner,
    onSaveEditBanner,
    onCancelEditBanner,
    onDeleteBanner,
    onToggleBannerActive,
    expandedBannerId,
    onToggleBannerExpand,
    bannerCards,
    bannerCardsLoading,
    newBannerCardJson,
    onNewBannerCardJsonChange,
    newBannerCardWeight,
    onNewBannerCardWeightChange,
    newBannerCardFeatured,
    onNewBannerCardFeaturedChange,
    onAddBannerCard,
    onUpdateBannerCard,
    onDeleteBannerCard,
    onBannerCardsChange,
    formatDate,
  } = props

  const renderBannerForm = (
    form: BannerFormData,
    onFormChange: (form: BannerFormData) => void,
    onSubmit: (e: React.FormEvent) => void,
    onCancel: () => void,
    submitLabel: string,
    isForm: boolean
  ) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex gap-2 p-1 bg-muted rounded-lg">
        <button
          type="button"
          onClick={() => onFormChange({ ...form, banner_type: "standard" })}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition ${form.banner_type === "standard" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Стандартный
        </button>
        <button
          type="button"
          onClick={() => onFormChange({ ...form, banner_type: "dynamic" })}
          className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition ${form.banner_type === "dynamic" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          Ивент (Онгоинги)
        </button>
      </div>
      {form.banner_type === "dynamic" && (
        <div className="p-3 bg-cyan-500/5 border border-cyan-500/20 rounded-lg text-xs text-cyan-300">
          Баннер будет автоматически выбирать онгоинг-тайтл и его главных персонажей (1-3 ГГ). Тайтл меняется каждые 3 дня. Пул роллов — все онгоинги, гарант — одна из 3 ГГ карт. Название и описание будут показаны вместо автоматических.
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Название *</label>
          <input
            type="text"
            required
            value={form.name}
            onChange={(e) => onFormChange({ ...form, name: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">URL фона баннера</label>
          <input
            type="text"
            value={form.image_url}
            onChange={(e) => onFormChange({ ...form, image_url: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
            placeholder="https://... (фон карточки баннера)"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">URL промо-арта (шапка 7:5)</label>
        <input
          type="text"
          value={form.promo_image_url}
          onChange={(e) => onFormChange({ ...form, promo_image_url: e.target.value })}
          className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          placeholder="https://... (промо-арт для шапки баннера, соотношение 7:5)"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Описание</label>
        <textarea
          value={form.description}
          onChange={(e) => onFormChange({ ...form, description: e.target.value })}
          className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm h-20"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Featured anime IDs (через запятую)</label>
          <input
            type="text"
            value={form.featured_anime_ids}
            onChange={(e) => onFormChange({ ...form, featured_anime_ids: e.target.value })}
            placeholder="1, 21, 5114"
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Буст редкости</label>
          <select
            value={form.boosted_rarity}
            onChange={(e) => onFormChange({ ...form, boosted_rarity: e.target.value as Rarity | "" })}
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          >
            <option value="">Нет</option>
            {Object.entries(rarityConfig).map(([key, config]) => (
              <option key={key} value={key}>{config.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Цена</label>
          <input
            type="number"
            value={form.price}
            onChange={(e) => onFormChange({ ...form, price: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-muted-foreground mb-2 uppercase">Цвет (gradient)</label>
          <div className="flex flex-wrap gap-2">
            {GRADIENT_PRESETS.map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => onFormChange({ ...form, color: g })}
                className={`relative w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-to-br ${g} transition-all ${form.color === g ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'}`}
                title={g}
              >
                {form.color === g && (
                  <Check className="absolute inset-0 m-auto w-5 h-5 text-white drop-shadow-lg" />
                )}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={form.color}
            onChange={(e) => onFormChange({ ...form, color: e.target.value })}
            placeholder="from-purple-600 to-pink-700"
            className="w-full mt-2 px-3 py-1.5 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-xs font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Дата начала</label>
          <input
            type="datetime-local"
            value={form.start_date}
            onChange={(e) => onFormChange({ ...form, start_date: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Дата окончания</label>
          <input
            type="datetime-local"
            value={form.end_date}
            onChange={(e) => onFormChange({ ...form, end_date: e.target.value })}
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={isForm ? "banner_active" : "edit_banner_active"}
            checked={form.is_active}
            onChange={(e) => onFormChange({ ...form, is_active: e.target.checked })}
          />
          <label htmlFor={isForm ? "banner_active" : "edit_banner_active"} className="text-sm cursor-pointer">Активен</label>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Порядок (sort_order)</label>
          <input
            type="number"
            value={form.sort_order}
            onChange={(e) => onFormChange({ ...form, sort_order: parseInt(e.target.value) || 0 })}
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          />
        </div>
      </div>

      <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-amber-500" />
          <label className="text-xs font-bold text-amber-500 uppercase">Гарантированная карта</label>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">JSON гарантированной карты</label>
          <textarea
            value={form.guaranteed_card_json}
            onChange={(e) => onFormChange({ ...form, guaranteed_card_json: e.target.value })}
            placeholder="Вставьте объект Card в формате JSON. Можно получить в редакторе карт..."
            className="w-full px-3 py-2 bg-muted border border-border rounded text-xs font-mono h-24"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1 uppercase">Пулл до гарантии (0 = выключено)</label>
          <input
            type="number"
            value={form.guaranteed_card_pity}
            onChange={(e) => onFormChange({ ...form, guaranteed_card_pity: e.target.value })}
            placeholder="Напр. 50 — гарантия через 50 круток"
            className="w-full px-3 py-2 bg-muted border border-border rounded focus:outline-none focus:ring-1 focus:ring-primary text-sm"
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition"
        >
          {isForm ? "Отмена" : "Отмена"}
        </button>
        <button
          type="submit"
          className="px-6 py-2 bg-primary text-primary-foreground rounded-lg font-semibold hover:bg-primary/90 transition"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  )

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <h2 className="text-lg sm:text-2xl font-bold flex items-center gap-2">
          <Calendar size={24} className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
          Баннеры и события
        </h2>
        <button
          onClick={onToggleCreateBanner}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition text-sm w-fit"
        >
          <Plus size={18} />
          Создать баннер
        </button>
      </div>

      {showCreateBanner && (
        <div className="bg-card border border-primary/30 rounded-xl p-4 sm:p-6 space-y-4">
          {renderBannerForm(newBanner, onNewBannerChange, onCreateBanner, onToggleCreateBanner, "Создать баннер", true)}
        </div>
      )}

      {isBannersLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : banners.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          Баннеров пока нет. Создайте первый баннер.
        </div>
      ) : (
        <div className="space-y-4">
          {banners.map((banner) => (
            <div key={banner.id} className="bg-card border border-border rounded-xl p-4 sm:p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    {banner.name}
                    {banner.banner_type === 'dynamic' && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-cyan-500/10 text-cyan-500 border border-cyan-500/20">
                        Ивент
                      </span>
                    )}
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase ${banner.is_active ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-muted text-muted-foreground'}`}>
                      {banner.is_active ? 'Активен' : 'Неактивен'}
                    </span>
                  </h3>
                  {banner.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{banner.description}</p>
                  )}
                  <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
                    {banner.boosted_rarity && (
                      <span>Буст: {rarityConfig[banner.boosted_rarity as Rarity]?.label || banner.boosted_rarity}</span>
                    )}
                    {banner.price != null && <span>Цена: {banner.price}</span>}
                    {banner.start_date && <span>С: {formatDate(banner.start_date)}</span>}
                    {banner.end_date && <span>До: {formatDate(banner.end_date)}</span>}
                    {banner.featured_anime_ids && banner.featured_anime_ids.length > 0 && (
                      <span>Featured: {banner.featured_anime_ids.join(", ")}</span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0 self-end sm:self-auto">
                  <button
                    onClick={() => onStartEditBanner(banner)}
                    className="p-2 text-muted-foreground hover:text-primary transition"
                    title="Редактировать баннер"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => onToggleBannerActive(banner)}
                    className={`w-10 h-5 rounded-full relative transition-colors ${banner.is_active ? 'bg-primary' : 'bg-muted'}`}
                  >
                    <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${banner.is_active ? 'left-6' : 'left-1'}`} />
                  </button>
                  <button
                    onClick={() => onDeleteBanner(banner.id)}
                    className="p-2 text-muted-foreground hover:text-destructive transition"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              {banner.guaranteed_card_payload && (
                <div className="flex items-center gap-2 mt-2 text-xs">
                  <Sparkles size={12} className="text-amber-500" />
                  <span className="text-amber-500 font-semibold">
                    Гарант-карта: {banner.guaranteed_card_payload?.name || "Без названия"}
                    {banner.guaranteed_card_pity ? ` (через ${banner.guaranteed_card_pity} круток)` : ""}
                  </span>
                </div>
              )}

              {editingBannerId === banner.id && editBanner && (
                <div className="mt-4 pt-4 border-t border-border bg-muted/30 rounded-lg p-3 sm:p-4 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Edit size={16} className="text-primary" />
                    <h4 className="font-semibold text-sm">Редактирование баннера</h4>
                  </div>
                  {renderBannerForm(editBanner, onEditBannerChange, (e) => { e.preventDefault(); onSaveEditBanner() }, onCancelEditBanner, "Сохранить", false)}
                </div>
              )}

              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                <button
                  onClick={() => onToggleBannerExpand(banner.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-muted hover:bg-muted/70 rounded text-sm transition"
                >
                  <Calendar size={14} />
                  Карты баннера
                </button>
              </div>

              {expandedBannerId === banner.id && (
                <div className="mt-4 pt-4 border-t border-border space-y-3 sm:space-y-4">
                  {bannerCardsLoading === banner.id ? (
                    <div className="flex justify-center py-6">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    </div>
                  ) : (
                    <>
                      {(bannerCards[banner.id] || []).length > 0 && (
                        <div className="space-y-2">
                          {(bannerCards[banner.id] || []).map((bc) => (
                            <div key={bc.id} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-muted/50 rounded-lg">
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {bc.card_payload?.name || "Без названия"}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  Редкость: {rarityConfig[bc.card_payload?.rarity as Rarity]?.label || bc.card_payload?.rarity || "—"}
                                </p>
                              </div>
                              <div className="flex flex-wrap items-center gap-2">
                                <label className="text-xs text-muted-foreground">Вес:</label>
                                <input
                                  type="number"
                                  value={bc.weight}
                                  onChange={(e) => {
                                    const w = parseInt(e.target.value) || 0
                                    onBannerCardsChange(banner.id, (bannerCards[banner.id] || []).map(c => c.id === bc.id ? { ...c, weight: w } : c))
                                  }}
                                  className="w-16 px-2 py-1 bg-muted border border-border rounded text-xs"
                                />
                                <label className="text-xs text-muted-foreground flex items-center gap-1">
                                  <input
                                    type="checkbox"
                                    checked={bc.is_featured}
                                    onChange={(e) => {
                                      const f = e.target.checked
                                      onBannerCardsChange(banner.id, (bannerCards[banner.id] || []).map(c => c.id === bc.id ? { ...c, is_featured: f } : c))
                                    }}
                                  />
                                  Featured
                                </label>
                                <button
                                  onClick={() => onUpdateBannerCard(bc)}
                                  className="px-2 py-1 bg-primary/10 text-primary rounded text-xs hover:bg-primary/20 transition"
                                >
                                  <Edit size={12} />
                                </button>
                                <button
                                  onClick={() => onDeleteBannerCard(bc.id, banner.id)}
                                  className="p-1 text-muted-foreground hover:text-destructive transition"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="space-y-2 p-3 bg-muted/30 rounded-lg border border-dashed border-border">
                        <label className="block text-xs font-medium text-muted-foreground uppercase">Добавить карту (JSON)</label>
                        <textarea
                          value={newBannerCardJson[banner.id] || ""}
                          onChange={(e) => onNewBannerCardJsonChange(banner.id, e.target.value)}
                          placeholder="Вставьте объект Card в формате JSON..."
                          className="w-full px-3 py-2 bg-muted border border-border rounded text-xs font-mono h-24"
                        />
                        <div className="flex flex-wrap items-center gap-3">
                          <div className="flex items-center gap-2">
                            <label className="text-xs text-muted-foreground">Вес:</label>
                            <input
                              type="number"
                              value={newBannerCardWeight[banner.id] ?? 1}
                              onChange={(e) => onNewBannerCardWeightChange(banner.id, parseInt(e.target.value) || 1)}
                              className="w-16 px-2 py-1 bg-muted border border-border rounded text-xs"
                            />
                          </div>
                          <label className="text-xs text-muted-foreground flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={newBannerCardFeatured[banner.id] ?? false}
                              onChange={(e) => onNewBannerCardFeaturedChange(banner.id, e.target.checked)}
                            />
                            Featured
                          </label>
                          <button
                            onClick={() => onAddBannerCard(banner.id)}
                            className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded text-xs hover:bg-primary/90 transition"
                          >
                            <Plus size={14} />
                            Добавить карту
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
