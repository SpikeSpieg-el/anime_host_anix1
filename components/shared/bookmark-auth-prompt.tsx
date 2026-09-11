"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { GuestHookToast } from "@/components/shared/guest-hook-banner"
import {
  GuestHookId,
  canShowGuestHook,
  isOngoingStatus,
  type GuestHookIdValue,
} from "@/lib/guest-hooks"

interface BookmarkDetail {
  anime?: {
    id?: string
    title?: string
    status?: string
  }
}

/**
 * При добавлении закладки гостем:
 *  - ongoing → крючок «Колокольчик онгоингов»
 *  - иначе → стартовый пак (реже, каждые 2 закладки)
 */
export function BookmarkAuthPrompt() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [hookId, setHookId] = useState<GuestHookIdValue>(GuestHookId.STARTER_PACK)
  const [animeMeta, setAnimeMeta] = useState<{
    id?: string
    title?: string
    status?: string
  }>({})
  const [trigger, setTrigger] = useState("bookmark")

  useEffect(() => {
    if (user) {
      setOpen(false)
      return
    }

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

      setAnimeMeta({
        id: anime?.id,
        title: anime?.title,
        status,
      })

      if (ongoing) {
        const id = GuestHookId.ONGOING_BELL
        if (!canShowGuestHook(id)) return
        setHookId(id)
        setTrigger("bookmark_ongoing")
        setOpen(true)
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
        const id = GuestHookId.STARTER_PACK
        if (!canShowGuestHook(id)) return
        setHookId(id)
        setTrigger("bookmark_batch")
        setOpen(true)
      }
    }

    window.addEventListener("bookmark-added", handleBookmarkAdded)
    return () => window.removeEventListener("bookmark-added", handleBookmarkAdded)
  }, [user])

  if (user) return null

  return (
    <GuestHookToast
      open={open}
      hookId={hookId}
      trigger={trigger}
      surface="banner"
      animeId={animeMeta.id}
      animeTitle={animeMeta.title}
      animeStatus={animeMeta.status}
      respectFrequency={false}
      onDismiss={() => setOpen(false)}
    />
  )
}
