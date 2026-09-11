"use client"

import { useEffect } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import {
  GuestHookId,
  canShowGuestHook,
  isOngoingStatus,
  requestGuestHook,
} from "@/lib/guest-hooks"

interface BookmarkDetail {
  anime?: {
    id?: string
    title?: string
    status?: string
  }
}

/**
 * При добавлении закладки гостем просит глобальный контроллер показать крючок:
 *  - ongoing → крючок «Колокольчик онгоингов»
 *  - иначе → стартовый пак (реже, каждые 2 закладки)
 *
 * Сам компонент ничего не рендерит: тост рисует только GuestHooksController,
 * чтобы не было двух перекрывающихся тостов в одном углу.
 */
export function BookmarkAuthPrompt() {
  const { user } = useAuth()

  useEffect(() => {
    if (user) return

    let nonOngoingCount = 0
    try {
      nonOngoingCount = parseInt(localStorage.getItem("weebx_bookmark_count") || "0", 10) || 0
    } catch {
      nonOngoingCount = 0
    }

    const handleBookmarkAdded = (event: Event) => {
      if (user) return

      const detail = (event as CustomEvent<BookmarkDetail>).detail
      const anime = detail?.anime
      const status = anime?.status
      const ongoing = isOngoingStatus(status)

      const meta = {
        animeId: anime?.id,
        animeTitle: anime?.title,
        animeStatus: status,
      }

      if (ongoing) {
        const hookId = GuestHookId.ONGOING_BELL
        if (!canShowGuestHook(hookId)) return
        requestGuestHook({
          hookId,
          surface: "banner",
          trigger: "bookmark_ongoing",
          ...meta,
        })
        return
      }

      nonOngoingCount += 1
      try {
        localStorage.setItem("weebx_bookmark_count", String(nonOngoingCount))
      } catch {
        /* ignore */
      }

      // Каждые 2 обычные закладки — стартовый пак
      if (nonOngoingCount % 2 === 0) {
        const hookId = GuestHookId.STARTER_PACK
        if (!canShowGuestHook(hookId)) return
        requestGuestHook({
          hookId,
          surface: "banner",
          trigger: "bookmark_batch",
          ...meta,
        })
      }
    }

    window.addEventListener("bookmark-added", handleBookmarkAdded)
    return () => window.removeEventListener("bookmark-added", handleBookmarkAdded)
  }, [user])

  return null
}
