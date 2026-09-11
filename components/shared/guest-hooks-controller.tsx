"use client"

/**
 * Глобальный контроллер контекстных крючков.
 * Слушает CustomEvent `weebx-guest-hook-show` и показывает toast/modal
 * без перекрытия активного плеера (fixed bottom).
 *
 * UX-координация:
 *  - только один крючок за раз (все источники идут через этот контроллер);
 *  - пока висит cookie-consent (z-9999, перекрывал бы кнопки) — крючок ждёт;
 *  - Chibi-маскот уезжает вниз, пока виден тост (событие TOAST_VISIBILITY);
 *  - dismiss проигрывает exit-анимацию до анмаунта.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { GuestHookToast } from "@/components/shared/guest-hook-banner"
import { GuestHookModal } from "@/components/shared/guest-hook-modal"
import {
  COOKIE_CONSENT_RESOLVED_EVENT,
  GUEST_HOOK_EVENTS,
  GuestHookId,
  canShowGuestHook,
  isCookieConsentDecided,
  setGuestHookToastVisibility,
  type GuestHookIdValue,
  type GuestHookShowDetail,
  type GuestHookSurface,
} from "@/lib/guest-hooks"

interface ActiveHook {
  hookId: GuestHookIdValue
  surface: GuestHookSurface
  trigger?: string
  animeId?: string
  animeTitle?: string
  animeStatus?: string
}

/** Пути, где toast не показываем (полноэкранные gate уже на месте). */
const GATE_PATHS = ["/battle", "/pvp"]

/** Модалке (Radix) нужно время доиграть exit до анмаунта. */
const MODAL_EXIT_MS = 350

export function GuestHooksController() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [active, setActive] = useState<ActiveHook | null>(null)
  const [open, setOpen] = useState(false)
  /** Крючок, отложенный из-за незакрытого cookie-consent. */
  const pendingRef = useRef<GuestHookShowDetail | null>(null)
  const clearTimerRef = useRef<number | null>(null)

  const scheduleClear = useCallback(() => {
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current)
    clearTimerRef.current = window.setTimeout(() => setActive(null), MODAL_EXIT_MS)
  }, [])

  /** Начать закрытие (анимация) — вызывается dismiss/сменой роута/конкуренцией. */
  const closeCurrent = useCallback(() => {
    setOpen(false)
    setGuestHookToastVisibility(false)
    scheduleClear()
  }, [scheduleClear])

  const activate = useCallback((detail: GuestHookShowDetail) => {
    // Отменяем отложенный анмаунт предыдущего крючка (гонка close→show)
    if (clearTimerRef.current) window.clearTimeout(clearTimerRef.current)
    setActive({
      hookId: detail.hookId,
      surface: detail.surface ?? "banner",
      trigger: detail.trigger,
      animeId: detail.animeId,
      animeTitle: detail.animeTitle,
      animeStatus: detail.animeStatus,
    })
    setGuestHookToastVisibility((detail.surface ?? "banner") === "banner")
    setOpen(true)
  }, [])

  useEffect(() => {
    if (user) {
      setOpen(false)
      setActive(null)
      pendingRef.current = null
      setGuestHookToastVisibility(false)
      return
    }

    const onShow = (event: Event) => {
      const detail = (event as CustomEvent<GuestHookShowDetail>).detail
      if (!detail?.hookId) return

      // Не спамим поверх gate-экранов арены
      if (GATE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
        if (detail.surface !== "modal" && detail.hookId !== GuestHookId.ARENA_MARKET) {
          return
        }
      }

      if (!detail.force && !canShowGuestHook(detail.hookId)) return

      // Cookie-consent (z-9999) перекрывает тост и его кнопки — ждём решения.
      if (!isCookieConsentDecided()) {
        pendingRef.current = detail
        return
      }

      activate(detail)
    }

    const onConsentResolved = () => {
      const pending = pendingRef.current
      pendingRef.current = null
      if (!pending) return
      if (!pending.force && !canShowGuestHook(pending.hookId)) return
      activate(pending)
    }

    window.addEventListener(GUEST_HOOK_EVENTS.SHOW, onShow)
    window.addEventListener(COOKIE_CONSENT_RESOLVED_EVENT, onConsentResolved)
    return () => {
      window.removeEventListener(GUEST_HOOK_EVENTS.SHOW, onShow)
      window.removeEventListener(COOKIE_CONSENT_RESOLVED_EVENT, onConsentResolved)
    }
  }, [user, pathname, activate])

  // Смена маршрута — закрываем тост (контекст сменился)
  useEffect(() => {
    setOpen(false)
    setGuestHookToastVisibility(false)
    scheduleClear()
  }, [pathname, scheduleClear])

  // Тост доиграл exit-анимацию — можно анмаунтить
  const handleToastExitComplete = useCallback(() => setActive(null), [])

  if (user || !active) return null

  if (active.surface === "modal") {
    return (
      <GuestHookModal
        hookId={active.hookId}
        open={open}
        onOpenChange={(next) => {
          if (!next) closeCurrent()
          else setOpen(true)
        }}
        trigger={active.trigger}
        respectFrequency={false}
      />
    )
  }

  return (
    <GuestHookToast
      open={open}
      hookId={active.hookId}
      trigger={active.trigger}
      surface={active.surface}
      animeId={active.animeId}
      animeTitle={active.animeTitle}
      animeStatus={active.animeStatus}
      respectFrequency={false}
      onDismiss={closeCurrent}
      onExitComplete={handleToastExitComplete}
    />
  )
}
