"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useAuth } from "@/components/auth/auth-provider"

interface UseExitIntentOptions {
  enabled?: boolean
  minWatchTime?: number // минимальное время на странице в секундах (по умолчанию 20)
}

const EXIT_PROMPT_SHOWN_KEY = "weebx_exit_intent_shown"

export function useExitIntent({
  enabled = true,
  minWatchTime = 20
}: UseExitIntentOptions = {}) {
  const { user } = useAuth()
  const [showExitPrompt, setShowExitPrompt] = useState(false)
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!enabled || user) return

    // Если уже показывали в текущей сессии — не спамим
    if (typeof window !== "undefined" && sessionStorage.getItem(EXIT_PROMPT_SHOWN_KEY)) {
      return
    }

    const handleMouseLeave = (e: MouseEvent) => {
      // Пользователь ведет курсор вверх за пределы страницы (к вкладкам или адресной строке)
      if (e.clientY <= 10) {
        const timeSpent = (Date.now() - startTimeRef.current) / 1000
        if (timeSpent >= minWatchTime) {
          setShowExitPrompt(true)
          try {
            sessionStorage.setItem(EXIT_PROMPT_SHOWN_KEY, "true")
          } catch {}
          document.removeEventListener("mouseleave", handleMouseLeave)
        }
      }
    }

    document.addEventListener("mouseleave", handleMouseLeave)

    return () => {
      document.removeEventListener("mouseleave", handleMouseLeave)
    }
  }, [enabled, user, minWatchTime])

  const dismissPrompt = useCallback(() => {
    setShowExitPrompt(false)
  }, [])

  return {
    showExitPrompt,
    dismissPrompt
  }
}
