"use client"

import { useEffect, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { Zap } from "lucide-react"

export function GlobalLoading() {
  const [isLoading, setIsLoading] = useState(false)
  const resetTimeoutRef = useRef<number | null>(null)
  const pathname = usePathname()
  const searchParams = useSearchParams()

  useEffect(() => {
    setIsLoading(false)
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
      setIsLoading(true)
      clearResetTimeout()
      resetTimeoutRef.current = window.setTimeout(() => {
        setIsLoading(false)
        resetTimeoutRef.current = null
      }, 10000)
    }

    const stopLoading = () => {
      clearResetTimeout()
      setIsLoading(false)
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
    window.addEventListener("pageshow", stopLoading)

    // SPA-навигация
    document.addEventListener("click", onDocumentClick, true)
    window.addEventListener("popstate", onPopState)

    return () => {
      clearResetTimeout()
      window.removeEventListener("beforeunload", startLoading)
      window.removeEventListener("load", stopLoading)
      window.removeEventListener("pageshow", stopLoading)
      document.removeEventListener("click", onDocumentClick, true)
      window.removeEventListener("popstate", onPopState)
    }
  }, [])

  if (!isLoading) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        {/* Анимированный логотип */}
        <div className="flex items-center gap-3 z-50 group">
          <div className="relative w-9 h-9 flex items-center justify-center">
            <div className="absolute inset-0 bg-orange-600 rounded-xl rotate-6 opacity-50 blur-[4px] group-hover:opacity-80 transition-opacity"></div>
            <div className="absolute inset-0 bg-red-600 rounded-xl -rotate-6 opacity-50 blur-[4px] group-hover:opacity-80 transition-opacity"></div>
            <div className="relative w-full h-full bg-gradient-to-br from-zinc-800 to-black border border-white/10 rounded-xl flex items-center justify-center shadow-2xl">
              <Zap className="w-5 h-5 text-orange-500 fill-orange-500" />
            </div>
          </div>
          <div className="flex flex-col justify-center">
            <h1 className="text-xl font-black tracking-tighter text-white leading-none font-unbounded">Weeb.<span className="text-orange-500">X</span></h1>
            <span className="text-[9px] font-bold tracking-[0.2em] text-zinc-500 uppercase leading-none group-hover:text-zinc-300 transition-colors">Stream</span>
          </div>
        </div>
        
        {/* Спиннер загрузки */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        
        {/* Текст загрузки */}
        <p className="text-zinc-400 text-sm animate-pulse">Загрузка...</p>
      </div>
    </div>
  )
}
