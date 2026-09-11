"use client"

/**
 * Баннеры мотивации регистрации на странице просмотра.
 * Варианты завязаны на уникальные фичи Weebx (гача, колода, онгоинги),
 * а не на банальное «сохраните прогресс».
 */

import { useEffect, useRef, useState } from "react"
import { useAuth } from "@/components/auth/auth-provider"
import { GuestHookBanner } from "@/components/shared/guest-hook-banner"
import {
  GuestHookId,
  canShowGuestHook,
  type GuestHookIdValue,
} from "@/lib/guest-hooks"

export type AuthPromptVariant =
  | "under-player"
  | "bookmarks"
  | "exit"
  | "starter-pack"
  | "title-deck"
  | "ongoing-bell"

interface AuthPromptBannerProps {
  variant?: AuthPromptVariant
  onDismiss?: () => void
  className?: string
  animeId?: string
  animeTitle?: string
  animeStatus?: string
  /** После N серий / первого просмотра. */
  trigger?: string
}

const VARIANT_TO_HOOK: Record<AuthPromptVariant, GuestHookIdValue> = {
  "under-player": GuestHookId.STARTER_PACK,
  bookmarks: GuestHookId.ONGOING_BELL,
  exit: GuestHookId.TITLE_DECK,
  "starter-pack": GuestHookId.STARTER_PACK,
  "title-deck": GuestHookId.TITLE_DECK,
  "ongoing-bell": GuestHookId.ONGOING_BELL,
}

const VARIANT_TRIGGER: Record<AuthPromptVariant, string> = {
  "under-player": "watch_under_player",
  bookmarks: "bookmark",
  exit: "exit_intent",
  "starter-pack": "watch_first_episode",
  "title-deck": "watch_title_deck",
  "ongoing-bell": "bookmark_ongoing",
}

export function AuthPromptBanner({
  variant = "under-player",
  onDismiss,
  className,
  animeId,
  animeTitle,
  animeStatus,
  trigger,
}: AuthPromptBannerProps) {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [allowed, setAllowed] = useState(false)
  const checked = useRef(false)

  const hookId = VARIANT_TO_HOOK[variant]

  useEffect(() => {
    if (user || dismissed || checked.current) return
    checked.current = true
    setAllowed(canShowGuestHook(hookId))
  }, [user, dismissed, hookId])

  if (user || dismissed || !allowed) return null

  return (
    <GuestHookBanner
      hookId={hookId}
      trigger={trigger ?? VARIANT_TRIGGER[variant]}
      surface="banner"
      animeId={animeId}
      animeTitle={animeTitle}
      animeStatus={animeStatus}
      respectFrequency={false}
      className={className}
      onDismiss={() => {
        setDismissed(true)
        onDismiss?.()
      }}
    />
  )
}
