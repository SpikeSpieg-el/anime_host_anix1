"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown, Loader2, Store, X, Zap } from "lucide-react"
import type { Card } from "@/app/gacha/types"
import {
  computeMaxListingPrice,
  computeMinListingPrice,
  getFairCardValue,
  getInstantSellPrice,
  getNetProceeds,
} from "@/lib/market-floor"
import { INSTANT_SELL_RATE, MARKET_TAX_RATE } from "@/lib/economy"
import { getDismantleValue, rarityConfig } from "@/types/gacha"
import { useAuth } from "@/components/auth/auth-provider"
import { AnalyticsEvent, trackEvent } from "@/lib/analytics"

/**
 * Окно продажи карты.
 *
 * Принцип: по умолчанию видно ровно то, нужно для решения — две цены и две
 * кнопки. Всё остальное (разбор цены, реальные продажи, спрос/предложение,
 * сравнение способов сбыта) спрятано за «Подробнее» и грузится только когда
 * его реально открыли: обычному игроку аналитика не нужна, а хардкору нужна.
 */
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
  const [analyticsLoading, setAnalyticsLoading] = useState(false)
  const [analyticsLoaded, setAnalyticsLoaded] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [instantSelling, setInstantSelling] = useState(false)
  const [confirmInstant, setConfirmInstant] = useState(false)

  // Получаем сессию напрямую из провайдера, не дергая базу лишний раз
  const { session } = useAuth()

  const formatPrice = useCallback((value: string): string => {
    const cleanValue = value.replace(/\s/g, '')
    if (!cleanValue) return ""
    const num = parseInt(cleanValue, 10)
    if (Number.isNaN(num)) return value
    return num.toLocaleString("ru-RU")
  }, [])

  // Очистка значения от пробелов для парсинга (включая неразрывные пробелы)
  const cleanPriceInput = priceInput.replace(/[\s\u00A0]/g, "")

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
      onNotify("Маркет", `Карта продана за ${Number(data.price).toLocaleString()} монет.`, "info")
      setConfirmInstant(false)
      onClose()
      await onListed()
    } catch (e) {
      onNotify("Маркет", e instanceof Error ? e.message : "Ошибка", "error")
    } finally {
      setInstantSelling(false)
    }
  }, [card, onClose, onListed, onNotify, session])

  // Закрытие по Escape — окно теперь настоящий модальный слой (backdrop перехватывает клики)
  useEffect(() => {
    if (!card) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }, [card, onClose])

  useEffect(() => {
    if (!card) return
    setPriceInput(minSellPrice.toLocaleString("ru-RU"))
    setConfirmInstant(false)

    // Рекомендуемая цена нужна всегда — по ней заполняется поле.
    const loadSuggestedPrice = async () => {
      setLoadingSuggestedPrice(true)
      try {
        const response = await fetch("/api/market/suggested-price", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token && { Authorization: `Bearer ${session.access_token}` }),
          },
          body: JSON.stringify({
            card: {
              rarity: card.rarity,
              stats: card.stats,
              isMainCharacter: card.isMainCharacter,
              frameModifier: card.frameModifier,
              coatingModifier: card.coatingModifier,
            },
          }),
        })

        if (response.ok) {
          const data = await response.json()
          setSuggestedPrice(data.suggestedPrice)
          setPriceExplanation(data.priceExplanation)
          setMarketData(data.marketData)
        }
      } catch (error) {
        console.warn("Failed to load suggested price:", error)
      } finally {
        setLoadingSuggestedPrice(false)
      }
    }

    loadSuggestedPrice()
  }, [card, minSellPrice, session])

  // Аналитика спроса и предложения грузится только при раскрытии «Подробнее».
  useEffect(() => {
    if (!expanded || analyticsLoaded || !card) return
    let cancelled = false
    setAnalyticsLoading(true)

    const loadAnalytics = async () => {
      const params = new URLSearchParams()
      params.append("rarity", card.rarity)
      if (card.frameModifier) params.append("frameModifier", card.frameModifier)
      if (card.coatingModifier) params.append("coatingModifier", card.coatingModifier)
      params.append("days", "7")

      try {
        const response = await fetch(`/api/market/analytics?${params}`)
        if (response.ok && !cancelled) {
          setAnalyticsData(await response.json())
          setAnalyticsLoaded(true)
        }
      } catch (error) {
        console.warn("Failed to load analytics:", error)
      } finally {
        if (!cancelled) setAnalyticsLoading(false)
      }
    }

    void loadAnalytics()
    return () => {
      cancelled = true
    }
  }, [expanded, analyticsLoaded, card])

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
      if (!session?.access_token) {
        onNotify("Маркет", "Войдите в аккаунт, чтобы продавать карты.", "warning")
        return
      }

      const res = await fetch("/api/market/list", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ uniqueId: card.uniqueId, price }),
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
  }, [card, maxSellPrice, minSellPrice, onClose, onListed, onNotify, cleanPriceInput, session])

  if (!card) return null

  const rarity = rarityConfig[card.rarity]
  const typedPrice = parseInt(cleanPriceInput, 10)
  const netAtTyped = Number.isFinite(typedPrice) ? getNetProceeds(typedPrice) : 0

  const Ratio = ({ label, value }: { label: string; value: number | undefined }) => {
    if (value === undefined) return null
    return (
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="text-slate-400">{label}</span>
        <span
          className={`font-black ${
            value > 1 ? "text-emerald-400" : value < 0.5 ? "text-rose-400" : "text-amber-400"
          }`}
        >
          {value.toFixed(2)}
        </span>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-[130] flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/85 backdrop-blur-xl"
      role="dialog"
      aria-modal="true"
      aria-labelledby="sell-market-title"
    >
      <div className="w-full sm:max-w-md flex flex-col max-h-[92dvh] sm:max-h-[88dvh] bg-slate-900 border border-cyan-500/25 sm:rounded-2xl rounded-t-2xl shadow-2xl shadow-cyan-500/10 overflow-hidden">
        {/* Шапка: всегда на виду */}
        <div className="shrink-0 flex items-start gap-3 px-4 py-3 border-b border-white/10">
          <div className="min-w-0 flex-1">
            <h3 id="sell-market-title" className="text-base font-black text-white leading-tight">
              Продать карту
            </h3>
            <p className="text-xs text-slate-400 truncate mt-0.5">{card.name}</p>
            <span
              className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-black bg-gradient-to-r ${rarity.color} text-slate-950`}
            >
              {rarity.label}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть"
            className="shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Тело: скроллится, если не влезает */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-3">
          {/* Две цены — всё, что нужно обычному игроку */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-3 py-2">
              <p className="text-[10px] font-black uppercase tracking-wider text-amber-300/80">
                Продать сразу
              </p>
              <p className="text-lg font-black text-amber-200 leading-tight">
                {instantSellPrice.toLocaleString()}
              </p>
              <p className="text-[10px] text-slate-400">монет, без ожидания</p>
            </div>

            <button
              type="button"
              onClick={() =>
                suggestedPrice && setPriceInput(suggestedPrice.toLocaleString("ru-RU"))
              }
              disabled={!suggestedPrice || loadingSuggestedPrice}
              title={suggestedPrice ? "Подставить в поле цены" : undefined}
              className="rounded-xl border border-cyan-500/25 bg-cyan-500/5 px-3 py-2 text-left hover:bg-cyan-500/10 disabled:opacity-70 disabled:hover:bg-cyan-500/5 transition-colors"
            >
              <p className="text-[10px] font-black uppercase tracking-wider text-cyan-300/80">
                Рекомендуемая цена
              </p>
              <p className="text-lg font-black text-cyan-200 leading-tight flex items-center gap-1.5">
                {loadingSuggestedPrice ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  suggestedPrice?.toLocaleString()
                )}
              </p>
              <p className="text-[10px] text-slate-400">
                {suggestedPrice ? "нажми, чтобы подставить" : "цена лота по сделкам"}
              </p>
            </button>
          </div>

          {/* Поле цены */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="sell-price"
                className="text-[10px] font-black text-slate-500 uppercase tracking-wider"
              >
                Цена лота
              </label>
              <span className="text-[10px] text-slate-500 tabular-nums">
                {minSellPrice.toLocaleString()} — {maxSellPrice.toLocaleString()}
              </span>
            </div>
            <div className="relative">
              <input
                id="sell-price"
                type="text"
                inputMode="numeric"
                min={minSellPrice}
                max={maxSellPrice}
                value={priceInput}
                onChange={(e) => {
                  const value = e.target.value
                  if (/^[0-9\s]*$/.test(value)) {
                    setPriceInput(formatPrice(value))
                  }
                }}
                placeholder={minSellPrice.toLocaleString("ru-RU")}
                className="w-full h-11 pr-14 rounded-xl bg-slate-950 border border-slate-700 px-3 text-white font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/50 tabular-nums"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-500 pointer-events-none">
                монет
              </span>
            </div>
            {Number.isFinite(typedPrice) && typedPrice >= minSellPrice && (
              <p className="text-[10px] text-slate-500 mt-1">
                ты получишь{" "}
                <span className="text-cyan-300 font-black tabular-nums">
                  {netAtTyped.toLocaleString()}
                </span>{" "}
                после комиссии {Math.round(MARKET_TAX_RATE * 100)}%
              </p>
            )}
          </div>

          {/* Подробности — по запросу */}
          <div className="border-t border-white/10 pt-2">
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              className="w-full flex items-center justify-between gap-2 py-1 text-[11px] font-black uppercase tracking-wider text-slate-400 hover:text-slate-200 transition-colors"
            >
              <span>Подробнее: цена, рынок, спрос</span>
              <ChevronDown
                className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
              />
            </button>

            {expanded && (
              <div className="mt-2 space-y-2 pb-1">
                {/* Сравнение способов сбыта */}
                <div className="rounded-xl bg-slate-800/40 px-3 py-2 space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Три способа сбыть карту
                  </p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Распылить</span>
                    <span className="text-slate-300 font-bold tabular-nums">
                      {dustValue} пыли{" "}
                      <span className="text-slate-500 font-normal">
                        (−{Math.round((1 - dustValue / Math.max(fairPrice, 1)) * 100)}%)
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Продать сразу</span>
                    <span className="text-amber-300 font-bold tabular-nums">
                      {instantSellPrice.toLocaleString()} монет (−
                      {Math.round((1 - INSTANT_SELL_RATE) * 100)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Лот по рекомендуемой</span>
                    <span className="text-cyan-300 font-bold tabular-nums">
                      {getNetProceeds(suggestedPrice ?? fairPrice).toLocaleString()} монет (—
                      {Math.round(MARKET_TAX_RATE * 100)}%)
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 pt-0.5">
                    Справедливая цена карты:{" "}
                    <span className="text-slate-300 font-bold tabular-nums">
                      {fairPrice.toLocaleString()}
                    </span>{" "}
                    монет. Лот выгоднее распыления, мгновенная продажа — быстрее.
                  </p>
                </div>

                {/* Разбор цены */}
                {priceExplanation && (
                  <div className="rounded-xl bg-slate-800/40 px-3 py-2 space-y-0.5">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Из чего складывается цена
                    </p>
                    {[
                      priceExplanation.base,
                      priceExplanation.stats,
                      priceExplanation.mainChar,
                      priceExplanation.modifiers,
                    ]
                      .filter(Boolean)
                      .map((line: string, i: number) => (
                        <p key={i} className="text-[11px] text-slate-300">
                          {line}
                        </p>
                      ))}
                  </div>
                )}

                {/* Реальные продажи */}
                <div className="rounded-xl bg-slate-800/40 px-3 py-2 space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Реальные продажи, {marketData?.windowDays ?? 14} дней
                  </p>
                  {marketData && marketData.sampleCount > 0 ? (
                    <>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Сделок</span>
                        <span className="text-slate-300 font-bold tabular-nums">
                          {marketData.sampleCount}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Медиана цены</span>
                        <span className="text-emerald-300 font-bold tabular-nums">
                          {Number(marketData.medianPrice).toLocaleString()}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      {loadingSuggestedPrice
                        ? "Считаем…"
                        : "Продаж пока нет — цена определена по редкости и статам."}
                    </p>
                  )}
                </div>

                {/* Спрос и предложение */}
                <div className="rounded-xl bg-slate-800/40 px-3 py-2 space-y-0.5">
                  <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                    Спрос и предложение, 7 дней
                  </p>
                  {analyticsLoading ? (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                      <Loader2 className="w-3 h-3 animate-spin" /> Загружаем…
                    </div>
                  ) : analyticsData ? (
                    <>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Лотов на рынке</span>
                        <span className="text-cyan-300 font-bold tabular-nums">
                          {analyticsData.supply.total}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Продано</span>
                        <span className="text-emerald-300 font-bold tabular-nums">
                          {analyticsData.demand.total}
                        </span>
                      </div>
                      <div className="pt-1 space-y-0.5 border-t border-white/5 mt-1">
                        <Ratio
                          label="Индекс редкости"
                          value={analyticsData.ratios.byRarity[card.rarity]}
                        />
                        {card.frameModifier && (
                          <Ratio
                            label="Индекс рамки"
                            value={analyticsData.ratios.byFrameModifier[card.frameModifier]}
                          />
                        )}
                        {card.coatingModifier && (
                          <Ratio
                            label="Индекс покрытия"
                            value={analyticsData.ratios.byCoatingModifier[card.coatingModifier]}
                          />
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 pt-1">
                        {">"}1 — спрос выше предложения, {"<"}0.5 — избыток лотов
                      </p>
                    </>
                  ) : (
                    <p className="text-[11px] text-slate-500">Данных пока нет.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Действия: всегда на виду, на любой высоте экрана */}
        <div className="shrink-0 border-t border-white/10 px-4 py-3">
          {confirmInstant ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmInstant(false)}
                className="px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 font-bold text-sm"
              >
                Отмена
              </button>
              <button
                type="button"
                disabled={instantSelling}
                onClick={() => void instantSell()}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-sm flex items-center justify-center gap-2"
              >
                {instantSelling ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                Продать за {instantSellPrice.toLocaleString()}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setConfirmInstant(true)}
                className="py-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-200 font-bold text-sm"
              >
                Продать сразу
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void submit()}
                className="py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-black uppercase text-sm flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Store className="w-4 h-4" />
                )}
                Выставить
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}