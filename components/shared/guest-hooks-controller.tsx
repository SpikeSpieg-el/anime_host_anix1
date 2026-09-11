"use client"

/**
 * Глобальный контроллер контекстных крючков.
 * Слушает CustomEvent `weebx-guest-hook-show` и показывает toast/modal
 * без перекрытия активного плеера (fixed bottom).
 */

import { useCallback, useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { useAuth } from "@/components/auth/auth-provider"
import { GuestHookToast } from "@/components/shared/guest-hook-banner"
import { GuestHookModal } from "@/components/shared/guest-hook-modal"
import {
  GUEST_HOOK_EVENTS,
  GuestHookId,
  canShowGuestHook,
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

export function GuestHooksController() {
  const { user } = useAuth()
  const pathname = usePathname()
  const [active, setActive] = useState<ActiveHook | null>(null)

  const clear = useCallback(() => setActive(null), [])

  useEffect(() => {
    if (user) {
      setActive(null)
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

      setActive({
        hookId: detail.hookId,
        surface: detail.surface ?? "banner",
        trigger: detail.trigger,
        animeId: detail.animeId,
        animeTitle: detail.animeTitle,
        animeStatus: detail.animeStatus,
      })
    }

    window.addEventListener(GUEST_HOOK_EVENTS.SHOW, onShow)
    return () => window.removeEventListener(GUEST_HOOK_EVENTS.SHOW, onShow)
  }, [user, pathname])

  // Смена маршрута — закрываем toast (контекст сменился)
  useEffect(() => {
    setActive(null)
  }, [pathname])

  if (user || !active) return null

  if (active.surface === "modal") {
    return (
      <GuestHookModal
        hookId={active.hookId}
        open={true}
        onOpenChange={(open) => {
          if (!open) clear()
        }}
        trigger={active.trigger}
        respectFrequency={false}
      />
    )
  }

  return (
    <GuestHookToast
      open={true}
      hookId={active.hookId}
      trigger={active.trigger}
      surface={active.surface}
      animeId={active.animeId}
      animeTitle={active.animeTitle}
      animeStatus={active.animeStatus}
      respectFrequency={false}
      onDismiss={clear}
    />
  )
}
