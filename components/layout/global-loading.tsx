"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { AnimatedLogo } from "./animated-logo"

const MIN_DISPLAY_MS = 500
const STOP_DELAY_MS = 600

export function GlobalLoading() {
  const [isLoading, setIsLoading] = useState(false)
  const resetTimeoutRef = useRef<number | null>(null)
  const stopDelayRef = useRef<number | null>(null)
  const startedAtRef = useRef<number | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    const clearStopDelay = () => {
      if (stopDelayRef.current !== null) {
        window.clearTimeout(stopDelayRef.current)
        stopDelayRef.current = null
      }
    }

    if (startedAtRef.current === null) return

    const elapsed = Date.now() - startedAtRef.current
    const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)

    clearStopDelay()
    stopDelayRef.current = window.setTimeout(() => {
      setIsLoading(false)
      startedAtRef.current = null
      stopDelayRef.current = null
    }, remaining + STOP_DELAY_MS)
  }, [pathname, searchParams])

  useEffect(() => {
    // Показываем загрузчик при начале навигации
    const clearResetTimeout = () => {
      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current)
        resetTimeoutRef.current = null
      }
    }

    const startLoading = () => {
      startedAtRef.current = Date.now()
      setIsLoading(true)
      clearResetTimeout()
      resetTimeoutRef.current = window.setTimeout(() => {
        setIsLoading(false)
        startedAtRef.current = null
        resetTimeoutRef.current = null
      }, 10000)
    }

    const stopLoading = () => {
      clearResetTimeout()
      if (startedAtRef.current !== null) {
        const elapsed = Date.now() - startedAtRef.current
        const remaining = Math.max(0, MIN_DISPLAY_MS - elapsed)
        if (remaining > 0) {
          window.setTimeout(() => {
            setIsLoading(false)
            startedAtRef.current = null
          }, remaining)
          return
        }
      }
      setIsLoading(false)
      startedAtRef.current = null
    }

    const onPopState = () => {
      startLoading()
      // При back/forward браузер может восстановить страницу из BFCache,
      // и тогда никакие "load"/router-events не придут. Делаем fail-safe.
      window.setTimeout(() => {
        stopLoading()
      }, 1500)
    }

    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return
      if (event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const target = event.target as HTMLElement | null

      // Если клик пришел из интерактивного контрола (кнопка/инпут и т.п.),
      // не включаем глобальную загрузку: такие клики часто не означают навигацию
      // (например, кнопка "Сохранить" внутри карточки-ссылки).
      if (target?.closest?.("button, [role='button'], input, select, textarea")) return

      const anchor = target?.closest?.("a") as HTMLAnchorElement | null
      if (!anchor) return

      if (anchor.target && anchor.target !== "_self") return
      if (anchor.hasAttribute("download")) return

      const href = anchor.getAttribute("href")
      if (!href) return
      if (href.startsWith("#")) return
      if (href.startsWith("mailto:") || href.startsWith("tel:")) return

      // Внутренние ссылки (SPA)
      if (href.startsWith("/")) {
        startLoading()
        return
      }

      // Абсолютные URL на текущий origin
      try {
        const url = new URL(href, window.location.href)
        if (url.origin !== window.location.origin) return
        if (url.hash && url.pathname === window.location.pathname && url.search === window.location.search) return
        startLoading()
      } catch {
        // ignore
      }
    }

    // Слушаем события начала и окончания загрузки страницы (fallback)
    window.addEventListener("beforeunload", startLoading)
    window.addEventListener("load", stopLoading)

    // SPA-навигация
    document.addEventListener("click", onDocumentClick, true)
    window.addEventListener("popstate", onPopState)

    return () => {
      clearResetTimeout()
      if (stopDelayRef.current !== null) {
        window.clearTimeout(stopDelayRef.current)
        stopDelayRef.current = null
      }
      window.removeEventListener("beforeunload", startLoading)
      window.removeEventListener("load", stopLoading)
      document.removeEventListener("click", onDocumentClick, true)
      window.removeEventListener("popstate", onPopState)
    }
  }, [])

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/95 backdrop-blur-md px-2 xs:px-4">
      <div className="flex flex-col items-center justify-center gap-3 xs:gap-4 sm:gap-6 max-w-full w-full">
        {/* Анимированный ASCII логотип */}
        <div className="w-full flex justify-center items-center overflow-hidden">
          <AnimatedLogo />
        </div>
        
        <div className="flex flex-col items-center gap-3">
          {/* Спиннер загрузки */}
          <div className="relative w-8 h-8 xs:w-10 xs:h-10 sm:w-12 sm:h-12">
            <div className="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
            <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
          </div>
          
          {/* Текст загрузки */}
          <p className="text-zinc-400 text-[10px] xs:text-xs sm:text-sm animate-pulse">Загрузка...</p>
        </div>
      </div>
    </div>
  )
}
