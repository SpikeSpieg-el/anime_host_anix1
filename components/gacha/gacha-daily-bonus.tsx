"use client"

import { useCallback, useEffect, useState } from "react"
import { CalendarCheck, Check, Coins, Loader2, Sparkles } from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { DAILY_REWARDS, getMilestoneProgress } from "@/lib/economy"

type DailyState = {
  claimedToday: boolean
  streak: number
  nextDay: number
  nextReward: { day: number; coins: number; dust: number }
}

/**
 * Воронка возврата в игру.
 *
 * Гача сама по себе окупает себя, но «крутить, пока есть монеты» — это про
 * один вечер, а не про возвращение завтра. Ежедневная серия и веха коллекции
 * дают причину зайти снова: забрал бонус → потратил его на крутки → увидел,
 * как растёт коллекция и приближается следующая веха.
 */
export function GachaDailyBonus({ collectedCount }: { collectedCount: number }) {
  const { user, session } = useAuth()
  const [state, setState] = useState<DailyState | null>(null)
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [milestone, setMilestone] = useState<{ coins: number; title: string } | null>(null)

  const load = useCallback(async () => {
    if (!session?.access_token) {
      setState(null)
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/economy/daily", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (res.ok) {
        setState(await res.json())
      }
    } catch {
      // Не блокируем гачу из-за ежедневки
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    void load()
  }, [load])

  const claim = useCallback(async () => {
    if (!session?.access_token) return
    setClaiming(true)
    try {
      const res = await fetch("/api/economy/daily", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setState((prev) =>
          prev
            ? { ...prev, claimedToday: true, streak: data.day, nextDay: (data.day % 7) + 1 }
            : prev
        )
        window.dispatchEvent(new CustomEvent("economy-coins-changed"))
        await load()
      }
    } catch {
      // тихо игнорируем
    } finally {
      setClaiming(false)
    }
  }, [load, session])

  // Веха коллекции: одна проверка за сессию, награда начисляется автоматически,
  // когда размер коллекции перевалил через порог.
  useEffect(() => {
    if (!session?.access_token || !user) return
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch("/api/economy/daily", {
          method: "PUT",
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (!cancelled && res.ok) {
          const data = await res.json()
          if (data.success && data.coins > 0) {
            setMilestone({ coins: data.coins, title: data.title || "Веха коллекции" })
            window.dispatchEvent(new CustomEvent("economy-coins-changed"))
          }
        }
      } catch {
        // тихо игнорируем
      }
    }
    const timer = setTimeout(check, 2500)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [session, user, collectedCount])

  if (!user) return null

  const progress = getMilestoneProgress(collectedCount)
  const next = state ? DAILY_REWARDS[state.nextDay - 1] : null

  return (
    <div className="mt-4 w-full max-w-[260px] sm:max-w-full space-y-2">
      {/* Ежедневная серия */}
      <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 rounded-xl">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
            <span className="text-amber-200 font-semibold text-[11px] sm:text-sm truncate">
              День {state?.streak || 0}/7
            </span>
          </div>
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 text-amber-300 animate-spin" />
          ) : state?.claimedToday ? (
            <span className="flex items-center gap-1 text-[10px] sm:text-xs text-emerald-300 font-bold shrink-0">
              <Check className="w-3 h-3" /> Получено
            </span>
          ) : (
            <button
              type="button"
              onClick={() => void claim()}
              disabled={claiming}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-100 text-[10px] sm:text-xs font-bold disabled:opacity-50 shrink-0"
            >
              {claiming ? <Loader2 className="w-3 h-3 animate-spin" /> : <Coins className="w-3 h-3" />}
              {next ? `Забрать ${next.coins}` : "Забрать"}
            </button>
          )}
        </div>
        <div className="flex gap-1 mt-1.5">
          {DAILY_REWARDS.map((reward) => {
            const done = (state?.streak || 0) >= reward.day
            return (
              <div
                key={reward.day}
                title={`День ${reward.day}: ${reward.coins} монет`}
                className={`h-1.5 flex-1 rounded-full ${done ? "bg-amber-400" : "bg-slate-700/70"}`}
              />
            )
          })}
        </div>
      </div>

      {/* Веха коллекции */}
      {progress.next && (
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 rounded-xl">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="flex items-center gap-1.5 text-indigo-200 font-semibold text-[11px] sm:text-sm truncate">
              <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 shrink-0" />
              {progress.next.title}
            </span>
            <span className="text-indigo-300 text-[10px] sm:text-xs font-black shrink-0">
              {collectedCount}/{progress.next.cards}
            </span>
          </div>
          <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-400 transition-all duration-500"
              style={{ width: `${progress.progress * 100}%` }}
            />
          </div>
          <p className="text-[10px] sm:text-xs text-indigo-200/80 mt-1">
            Ещё {progress.remaining} карт — награда {progress.next.coins} монет
          </p>
        </div>
      )}

      {milestone && (
        <div className="px-3 py-2 sm:px-4 sm:py-2.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-200 text-[11px] sm:text-sm font-bold">
          Веха «{milestone.title}»: начислено {milestone.coins} монет
        </div>
      )}
    </div>
  )
}
