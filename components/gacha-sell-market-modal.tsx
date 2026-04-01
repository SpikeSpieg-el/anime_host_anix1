"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Store } from "lucide-react"
import type { Card } from "@/app/gacha/page"
import { computeMaxListingPrice, computeMinListingPrice } from "@/lib/market-floor"

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

  useEffect(() => {
    if (!card) return
    setPriceInput(minSellPrice.toLocaleString('ru-RU'))
  }, [card, minSellPrice])

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
        `Максимум для этой карты — ${maxSellPrice.toLocaleString()} монет (не больше от минимума, общий потолок 15 млн).`,
        "warning"
      )
      return
    }

    setSubmitting(true)
    try {
      const { supabase } = await import("@/lib/supabase")
      const {
        data: { session },
      } = await supabase.auth.getSession()

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
        body: JSON.stringify({
          uniqueId: card.uniqueId,
          price,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || "Не удалось выставить карту")
      }

      onNotify("Маркет", "Карта выставлена на продажу.", "info")
      onClose()
      await onListed()
    } catch (e) {
      onNotify("Маркет", e instanceof Error ? e.message : "Ошибка", "error")
    } finally {
      setSubmitting(false)
    }
  }, [card, maxSellPrice, minSellPrice, onClose, onListed, onNotify, priceInput])

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
          Минимум завязан на ценность карты и коллекцию; максимум — не больше от минимума (не выше 15 млн).
        </p>
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
          className="w-full h-12 rounded-xl bg-slate-950 border border-slate-700 px-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-cyan-500/50 mb-6"
        />
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
