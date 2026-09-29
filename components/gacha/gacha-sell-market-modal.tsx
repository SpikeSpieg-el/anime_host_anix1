"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Store, Zap, TrendingUp } from "lucide-react"
import type { Card } from "@/app/gacha/types"
import {
  computeMaxListingPrice,
  computeMinListingPrice,
  getFairCardValue,
  getInstantSellPrice,
  getNetProceeds,
} from "@/lib/market-floor"
import { MARKET_TAX_RATE } from "@/lib/economy"
import { getDismantleValue } from "@/types/gacha"
import { useAuth } from "@/components/auth/auth-provider" // Импортируем хук авторизации
import { AnalyticsEvent, trackEvent } from "@/lib/analytics"

export function GachaSellMarketModal({
  card,
  collectedCards,
  onClose,
  onListed,
  onNotify,
}: {
  card: Card | null
  collectedCards: Card[]
  onClose: () => void
  onListed: () => Promise<void>
  onNotify: (title: string, message: string, type?: "error" | "info" | "warning") => void
}) {
  const [priceInput, setPriceInput] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [suggestedPrice, setSuggestedPrice] = useState<number | null>(null)
  const [priceExplanation, setPriceExplanation] = useState<any>(null)
  const [marketData, setMarketData] = useState<any>(null)
  const [loadingSuggestedPrice, setLoadingSuggestedPrice] = useState(false)
  const [analyticsData, setAnalyticsData] = useState<any>(null)
  const [instantSelling, setInstantSelling] = useState(false)
  const [confirmInstant, setConfirmInstant] = useState(false)
  
  // Получаем сессию напрямую из провайдера, не дергая базу лишний раз
  const { session } = useAuth()

  // Форматирование числа с разделением тысяч
  const formatPrice = (value: string): string => {
    const cleanValue = value.replace(/\s/g, '') // Удаляем все пробелы
    if (!cleanValue) return ""
    const num = parseInt(cleanValue, 10)
    if (Number.isNaN(num)) return value
    return num.toLocaleString('ru-RU')
  }

  // Очистка значения от пробелов для парсинга (включая неразрывные пробелы)
  const cleanPriceInput = priceInput.replace(/[\s\u00A0]/g, '')

  const minSellPrice = useMemo(() => {
    if (!card) return 0
    return computeMinListingPrice(
      card,
      collectedCards.filter((c) => c.uniqueId !== card.uniqueId)
    )
  }, [card, collectedCards])

  const maxSellPrice = useMemo(() => {
    if (!card) return 0
    return computeMaxListingPrice(
      card,
      collectedCards.filter((c) => c.uniqueId !== card.uniqueId)
    )
  }, [card, collectedCards])

  // Мгновенная продажа: монеты сразу, но 30% справедливой цены уходит в никуда.
  // Это плата за ликвидность — выбирать её стоит, только когда крутить надо сейчас.
  const instantSellPrice = useMemo(() => (card ? getInstantSellPrice(card) : 0), [card])
  const fairPrice = useMemo(() => (card ? getFairCardValue(card) : 0), [card])
  const dustValue = useMemo(() => (card ? getDismantleValue(card.rarity) : 0), [card])

  const instantSell = useCallback(async () => {
    if (!card || !session?.access_token) {
      onNotify("Маркет", "Войдите в аккаунт, чтобы продавать карты.", "warning")
      return
    }

    setInstantSelling(true)
    try {
      const res = await fetch("/api/market/instant-sell", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ uniqueId: card.uniqueId }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Не удалось продать карту")
      }

      trackEvent(AnalyticsEvent.MARKET_LIST, {
        price: data.price,
        rarity: card.rarity,
        anime: card.anime,
        instant: true,
      })
      onNotify(
        "Маркет",
        `Карта продана за ${Number(data.price).toLocaleString()} монет.`,
        "info"
      )
      setConfirmInstant(false)
      onClose()
      await onListed()
    } catch (e) {
      onNotify("Маркет", e instanceof Error ? e.message : "Ошибка", "error")
    } finally {
      setInstantSelling(false)
    }
  }, [card, onClose, onListed, onNotify, session])

  useEffect(() => {
    if (!card) return
    setPriceInput(minSellPrice.toLocaleString('ru-RU'))
    setConfirmInstant(false)
    
    // Загружаем рекомендуемую цену
    const loadSuggestedPrice = async () => {
      setLoadingSuggestedPrice(true)
      try {
        const response = await fetch('/api/market/suggested-price', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
          },
          body: JSON.stringify({
            card: {
              rarity: card.rarity,
              stats: card.stats,
              isMainCharacter: card.isMainCharacter,
              frameModifier: card.frameModifier,
              coatingModifier: card.coatingModifier
            }
          })
        })
        
        if (response.ok) {
          const data = await response.json()
          setSuggestedPrice(data.suggestedPrice)
          setPriceExplanation(data.priceExplanation)
          setMarketData(data.marketData)
        }
      } catch (error) {
        console.warn('Failed to load suggested price:', error)
      } finally {
        setLoadingSuggestedPrice(false)
      }
    }

    // Загружаем аналитику рынка (спрос/предложение)
    const loadAnalytics = async () => {
      try {
        const params = new URLSearchParams()
        params.append('rarity', card.rarity)
        if (card.frameModifier) params.append('frameModifier', card.frameModifier)
        if (card.coatingModifier) params.append('coatingModifier', card.coatingModifier)
        params.append('days', '7')

        const response = await fetch(`/api/market/analytics?${params}`)
        if (response.ok) {
          const data = await response.json()
          setAnalyticsData(data)
        }
      } catch (error) {
        console.warn('Failed to load analytics:', error)
      }
    }
    
    loadSuggestedPrice()
    loadAnalytics()
  }, [card, minSellPrice, session])

  const submit = useCallback(async () => {
    if (!card) return

    const price = parseInt(cleanPriceInput, 10)
    if (!Number.isFinite(price) || price < minSellPrice) {
      onNotify(
        "Цена",
        `Минимально можно выставить ${minSellPrice.toLocaleString()} монет (защита от обвала цен).`,
        "warning"
      )
      return
    }
    if (price > maxSellPrice) {
      onNotify(
        "Цена",
        `Максимум для этой карты — ${maxSellPrice.toLocaleString()} монет (2.5× справедливой цены; выше рынок не купит).`,
        "warning"
      )
      return
    }

    setSubmitting(true)
    try {
      // КРИТИЧНО: Убрали await supabase.auth.getSession(), теперь берем токен из провайдера
      if (!session?.access_token) {
        onNotify("Маркет", "Войдите в аккаунт, чтобы продавать карты.", "warning")
        return
      }

      const res = await fetch("/api/market/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`, // Используем токен из хука
        },
        body: JSON.stringify({
          uniqueId: card.uniqueId,
          price,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Не удалось выставить карту")
      }

      trackEvent(AnalyticsEvent.MARKET_LIST, {
        price,
        rarity: card?.rarity ?? null,
        anime: card?.anime ?? null,
      })
      onNotify("Маркет", "Карта выставлена на продажу.", "info")
      onClose()
      await onListed()
    } catch (e) {
      onNotify("Маркет", e instanceof Error ? e.message : "Ошибка", "error")
    } finally {
      setSubmitting(false)
    }
  }, [card, maxSellPrice, minSellPrice, onClose, onListed, onNotify, cleanPriceInput, session]) // Добавили session в зависимости

  if (!card) return null

  return (
    <div
      className="fixed inset-0 z-[130] flex items-center justify-center p-4 sm:p-6 bg-slate-950/85 backdrop-blur-xl pointer-events-none"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sell-market-title"
    >
      <div className="bg-slate-900 border border-cyan-500/30 rounded-2xl sm:rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl shadow-cyan-500/10 pointer-events-auto z-[110]">
        <h3 id="sell-market-title" className="text-xl font-black text-white mb-2">
          Выставить на маркет
        </h3>
        <p className="text-sm text-slate-400 mb-1 font-bold truncate">{card.name}</p>
        <p className="text-xs text-slate-500 mb-2 leading-relaxed">
          Диапазон:{" "}
          <span className="text-cyan-300 font-black">{minSellPrice.toLocaleString()}</span>
          {" — "}
          <span className="text-amber-300 font-black">{maxSellPrice.toLocaleString()}</span> монет.
          {loadingSuggestedPrice ? (
            <span className="text-blue-300 font-black ml-2 flex items-center gap-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              Расчёт рекомендуемой цены...
            </span>
          ) : suggestedPrice ? (
            <span className="text-green-300 font-black">
              Рекомендуется: {suggestedPrice.toLocaleString()}
            </span>
          ) : null}
        </p>
        
        {!loadingSuggestedPrice && marketData && marketData.sampleCount > 0 && (
          <p className="text-xs text-slate-400 mb-2">
            Продано за 14 дней: {marketData.sampleCount} шт. по медиане{" "}
            <span className="text-green-300 font-black">
              {Number(marketData.medianPrice).toLocaleString()}
            </span>{" "}
            монет
          </p>
        )}

        {!loadingSuggestedPrice && analyticsData && (
          <div className="mb-2 p-2 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-400 mb-1 font-bold">Спрос и предложение (7 дней):</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Предложение:</span>
                <span className="text-cyan-300 font-black">{analyticsData.supply.total} лотов</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-slate-300">Спрос (продажи):</span>
                <span className="text-green-300 font-black">{analyticsData.demand.total} шт.</span>
              </div>
              {analyticsData.ratios.byRarity[card?.rarity || ''] !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Индекс редкости:</span>
                  <span className={`font-black ${analyticsData.ratios.byRarity[card?.rarity || ''] > 1 ? 'text-green-400' : analyticsData.ratios.byRarity[card?.rarity || ''] < 0.5 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {analyticsData.ratios.byRarity[card?.rarity || ''].toFixed(2)}
                  </span>
                </div>
              )}
              {card?.frameModifier && analyticsData.ratios.byFrameModifier[card.frameModifier] !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Индекс рамки:</span>
                  <span className={`font-black ${analyticsData.ratios.byFrameModifier[card.frameModifier] > 1 ? 'text-green-400' : analyticsData.ratios.byFrameModifier[card.frameModifier] < 0.5 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {analyticsData.ratios.byFrameModifier[card.frameModifier].toFixed(2)}
                  </span>
                </div>
              )}
              {card?.coatingModifier && analyticsData.ratios.byCoatingModifier[card.coatingModifier] !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300">Индекс покрытия:</span>
                  <span className={`font-black ${analyticsData.ratios.byCoatingModifier[card.coatingModifier] > 1 ? 'text-green-400' : analyticsData.ratios.byCoatingModifier[card.coatingModifier] < 0.5 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {analyticsData.ratios.byCoatingModifier[card.coatingModifier].toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">{">"}1 высокий спрос, {"<"}0.5 избыток предложения</p>
          </div>
        )}

        {!loadingSuggestedPrice && priceExplanation && (
          <div className="mb-3 p-2 bg-slate-800/50 rounded-lg">
            <p className="text-xs text-slate-400 mb-1 font-bold">
              Справедливая цена карты: {priceExplanation.fair?.toLocaleString()} монет
            </p>
            <div className="space-y-1">
              {priceExplanation.base && (
                <p className="text-xs text-slate-300">{priceExplanation.base}</p>
              )}
              {priceExplanation.stats && (
                <p className="text-xs text-slate-300">{priceExplanation.stats}</p>
              )}
              {priceExplanation.mainChar && (
                <p className="text-xs text-slate-300">{priceExplanation.mainChar}</p>
              )}
              {priceExplanation.modifiers && (
                <p className="text-xs text-slate-300">{priceExplanation.modifiers}</p>
              )}
              <p className="text-[10px] text-slate-500">
                Распылить карту даст {dustValue} пыли (пыль тратится на смену арта, в монеты не переводится).
              </p>
            </div>
          </div>
        )}
        <label className="block text-xs font-black text-slate-500 uppercase tracking-wider mb-2">
          Цена (монеты)
        </label>
        <input
          type="text"
          inputMode="numeric"
          min={minSellPrice}
          max={maxSellPrice}
          value={priceInput}
          onChange={(e) => {
            const value = e.target.value
            // Разрешаем только цифры и пробелы
            if (/^[0-9\s]*$/.test(value)) {
              setPriceInput(formatPrice(value))
            }
          }}
          placeholder={minSellPrice.toLocaleString('ru-RU')}
          className="w-full h-12 rounded-xl bg-slate-950 border border-slate-700 px-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/50 mb-2"
        />
        
        {suggestedPrice && !loadingSuggestedPrice && (
          <button
            type="button"
            onClick={() => setPriceInput(suggestedPrice.toLocaleString('ru-RU'))}
            className="w-full py-2 rounded-xl bg-green-600/20 hover:bg-green-600/30 text-green-300 text-xs font-bold border border-green-500/30 mb-4"
          >
            Установить рекомендуемую цену ({suggestedPrice.toLocaleString()})
          </button>
        )}
        {loadingSuggestedPrice && (
          <div className="w-full py-2 rounded-xl bg-blue-600/20 text-blue-300 text-xs font-bold border border-blue-500/30 mb-4 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Расчёт рекомендуемой цены...
          </div>
        )}
        <div className="mb-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-3">
          <div className="flex items-center gap-2 mb-1">
            <Zap className="w-4 h-4 text-amber-300" />
            <span className="text-xs font-black text-amber-200 uppercase tracking-wider">
              Продать сразу
            </span>
          </div>
          <p className="text-xs text-slate-300 mb-2">
            {instantSellPrice.toLocaleString()} монет сразу, без ожидания покупателя. Это
            примерно столько же, сколько даст разбор в пыль, но монетками — и можно сразу крутить
            дальше. Выставляя лот, ты получаешь до{" "}
            <span className="text-cyan-300 font-black">
              {getNetProceeds(maxSellPrice).toLocaleString()}
            </span>{" "}
            монет, но только если кто-то купит.
          </p>
          {confirmInstant ? (
            <div className="flex gap-2">
              <button
                type="button"
                disabled={instantSelling}
                onClick={() => void instantSell()}
                className="flex-1 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center justify-center gap-2"
              >
                {instantSelling ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Продать за {instantSellPrice.toLocaleString()}
              </button>
              <button
                type="button"
                onClick={() => setConfirmInstant(false)}
                className="px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 font-bold text-xs"
              >
                Отмена
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmInstant(true)}
              className="w-full py-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 font-bold text-xs border border-amber-500/30"
            >
              Продать сразу за {instantSellPrice.toLocaleString()} монет
            </button>
          )}
        </div>

        <p className="text-[10px] text-slate-500 mb-2 flex items-center gap-1">
          <TrendingUp className="w-3 h-3" />
          Комиссия маркета {Math.round(MARKET_TAX_RATE * 100)}% — из цены лота. Справедливая цена
          карты: {fairPrice.toLocaleString()} монет.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            disabled={submitting}
            onClick={() => void submit()}
            className="flex-1 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-black uppercase text-sm flex items-center justify-center gap-2"
          >
            {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Store className="w-5 h-5" />}
            Выставить
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => onClose()}
            className="flex-1 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-200 font-bold text-sm"
          >
            Отмена
          </button>
        </div>
      </div>
    </div>
  )
}