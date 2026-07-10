"use client"

import React, { useState, useEffect } from "react"
import { Cookie, Shield, Check } from "lucide-react"
import { cn } from "@/lib/utils"

type CookiePreferences = {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)

  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true,
    analytics: true,
    marketing: false,
  })

  useEffect(() => {
    setMounted(true)
    const consent = localStorage.getItem("cookie-consent-v1")
    if (!consent) {
      const timer = setTimeout(() => setIsVisible(true), 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  const saveConsent = (prefs: CookiePreferences) => {
    localStorage.setItem("cookie-consent-v1", JSON.stringify(prefs))
    localStorage.setItem("cookie-consent-date", new Date().toISOString())
    setClosing(true)
    setTimeout(() => {
      setIsVisible(false)
      setClosing(false)
    }, 400)
    if (prefs.analytics) {
      console.log("Analytics enabled")
    }
  }

  const handleAcceptAll = () => {
    const all = { necessary: true, analytics: true, marketing: true }
    setPreferences(all)
    saveConsent(all)
  }

  const handleRejectAll = () => {
    const only = { necessary: true, analytics: false, marketing: false }
    setPreferences(only)
    saveConsent(only)
  }

  const handleSavePreferences = () => saveConsent(preferences)

  const togglePreference = (key: keyof CookiePreferences) => {
    if (key === "necessary") return
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (!mounted) return null
  if (!isVisible && !closing) return null

  return (
    <div
      className={cn(
        "fixed z-[9999] left-2 right-2 bottom-2 sm:left-auto sm:right-3 sm:bottom-3 sm:max-w-[420px]",
        "transition-all duration-400 ease-out transform",
        isVisible && !closing ? "translate-y-0 opacity-100" : "translate-y-24 opacity-0 pointer-events-none"
      )}
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.6)] overflow-hidden ring-1 ring-white/5">
        {/* Header */}
        <div className="p-3.5 sm:p-4 flex items-start gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-orange-500/10 flex items-center justify-center shrink-0 border border-orange-500/20 text-orange-500">
            <Cookie className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <h3 className="font-semibold text-white text-sm sm:text-base leading-tight">
              Настройки cookies
            </h3>
            <p className="text-xs sm:text-sm text-zinc-400 leading-relaxed">
              Мы используем куки и локальное хранилище для работы сайта и аналитики.
              {!isExpanded && " Вы можете настроить их или принять все."}
            </p>
          </div>
        </div>

        {/* Expandable settings */}
        <div
          className={cn(
            "overflow-hidden transition-[max-height] duration-300 ease-in-out bg-black/20",
            isExpanded ? "max-h-80 border-y border-white/5" : "max-h-0"
          )}
        >
          <div className="p-3 sm:p-4 space-y-2.5">
            <CookieOption
              label="Обязательные"
              description="Нужны для работы авторизации и плеера."
              checked={preferences.necessary}
              disabled
            />
            <CookieOption
              label="Аналитика"
              description="Помогает нам понять, какие аниме популярны."
              checked={preferences.analytics}
              onChange={() => togglePreference("analytics")}
            />
            <CookieOption
              label="Маркетинг"
              description="Используется для персональных рекомендаций."
              checked={preferences.marketing}
              onChange={() => togglePreference("marketing")}
            />
          </div>
        </div>

        {/* Footer buttons */}
        <div className="p-3 sm:p-4 bg-white/[0.02] flex flex-col gap-2.5">
          {!isExpanded ? (
            <div className="flex gap-2 sm:gap-2.5">
              <button
                onClick={handleAcceptAll}
                className="flex-1 h-10 sm:h-11 bg-orange-500 hover:bg-orange-600 text-white text-xs sm:text-sm font-semibold rounded-xl shadow-lg shadow-orange-500/20 transition-all active:scale-[0.98]"
              >
                Принять все
              </button>
              <button
                onClick={() => setIsExpanded(true)}
                className="h-10 sm:h-11 px-3 sm:px-4 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 hover:border-white/20 text-xs sm:text-sm font-medium rounded-xl transition-all active:scale-[0.98]"
              >
                Настроить
              </button>
            </div>
          ) : (
            <div className="flex gap-2 sm:gap-2.5">
              <button
                onClick={handleRejectAll}
                className="flex-1 h-10 sm:h-11 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 text-xs sm:text-sm font-medium rounded-xl transition-all active:scale-[0.98]"
              >
                Только нужные
              </button>
              <button
                onClick={handleSavePreferences}
                className="flex-1 h-10 sm:h-11 border border-white/10 text-zinc-300 hover:text-white hover:bg-white/5 text-xs sm:text-sm font-medium rounded-xl transition-all active:scale-[0.98]"
              >
                Сохранить
              </button>
              <button
                onClick={handleAcceptAll}
                className="flex-1 h-10 sm:h-11 bg-white text-black hover:bg-zinc-200 text-xs sm:text-sm font-semibold rounded-xl transition-all active:scale-[0.98]"
              >
                Принять все
              </button>
            </div>
          )}

          <div className="flex justify-center pt-0.5">
            <a href="/privacy" className="text-[10px] text-zinc-600 hover:text-zinc-400 transition-colors uppercase tracking-wider">
              Политика конфиденциальности
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

function CookieOption({
  label,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  label: string
  description: string
  checked: boolean
  onChange?: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start gap-2.5 sm:gap-3 select-none">
      <button
        onClick={onChange}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border-2 border-transparent transition-colors mt-0.5",
          checked ? "bg-orange-500" : "bg-zinc-700",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg transition-transform",
            checked ? "translate-x-4" : "translate-x-0.5"
          )}
        />
      </button>
      <div className="flex flex-col min-w-0">
        <span className="text-xs sm:text-sm font-medium text-zinc-200 flex items-center gap-1.5">
          {label}
          {disabled && (
            <span className="text-[9px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 uppercase tracking-wide">required</span>
          )}
        </span>
        <span className="text-[11px] sm:text-xs text-zinc-500 leading-tight">{description}</span>
      </div>
    </div>
  )
}