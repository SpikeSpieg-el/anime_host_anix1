"use client"

import React, { useState, useEffect } from "react"
import { X, Cookie, Shield, ChevronDown, ChevronUp, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils" 

// Тип для настроек
type CookiePreferences = {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

export function CookieConsent() {
  const [isVisible, setIsVisible] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false) // Для открытия настроек
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)

  // Состояние настроек
  const [preferences, setPreferences] = useState<CookiePreferences>({
    necessary: true, // Всегда true и заблокировано
    analytics: true,
    marketing: false,
  })

  useEffect(() => {
    setMounted(true)
    // Проверяем, было ли уже принято решение
    const consent = localStorage.getItem("cookie-consent-v1")
    
    if (!consent) {
      // Небольшая задержка перед появлением, чтобы не пугать сразу
      const timer = setTimeout(() => setIsVisible(true), 1000)
      return () => clearTimeout(timer)
    }
  }, [])

  const saveConsent = (prefs: CookiePreferences) => {
    // Сохраняем настройки в LS
    localStorage.setItem("cookie-consent-v1", JSON.stringify(prefs))
    localStorage.setItem("cookie-consent-date", new Date().toISOString())
    
    // Анимация закрытия
    setClosing(true)
    setTimeout(() => setIsVisible(false), 300)

    // ТУТ можно запустить скрипты аналитики, если analytics: true
    if (prefs.analytics) {
      console.log("Analytics enabled - Load Google Analytics / Yandex Metrika here")
    }
  }

  const handleAcceptAll = () => {
    const allEnabled = { necessary: true, analytics: true, marketing: true }
    setPreferences(allEnabled)
    saveConsent(allEnabled)
  }

  const handleRejectAll = () => {
    const onlyNecessary = { necessary: true, analytics: false, marketing: false }
    setPreferences(onlyNecessary)
    saveConsent(onlyNecessary)
  }

  const handleSavePreferences = () => {
    saveConsent(preferences)
  }

  const togglePreference = (key: keyof CookiePreferences) => {
    if (key === "necessary") return // Нельзя выключить
    setPreferences((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  if (!mounted) return null
  // Если не видно и не закрывается - не рендерим, чтобы не перекрывать клики
  if (!isVisible && !closing) return null

  return (
    <div 
      className={cn(
        "fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-[480px]",
        "transition-all duration-500 ease-out transform",
        isVisible && !closing ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0 pointer-events-none"
      )}
    >
      <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-800 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.5)] overflow-hidden ring-1 ring-white/10">
        
        {/* Хедер плашки */}
        <div className="p-5 flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center flex-shrink-0 border border-orange-500/20 text-orange-500">
            <Cookie className="w-5 h-5" />
          </div>
          
          <div className="flex-1 space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white leading-tight">
                Настройки cookies
              </h3>
              {/* Кнопка закрыть (работает как "только обязательные" или просто скрывает, но лучше заставить выбрать) */}
              <button 
                onClick={() => setIsVisible(false)} 
                className="text-zinc-500 hover:text-white transition-colors p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <p className="text-sm text-zinc-400 leading-relaxed">
              Мы используем куки и локальное хранилище для работы сайта и аналитики. 
              {!isExpanded && " Вы можете настроить их или принять все."}
            </p>
          </div>
        </div>

        {/* Раскрывающаяся часть с настройками */}
        <div 
          className={cn(
            "overflow-hidden transition-[max-height] duration-300 ease-in-out bg-zinc-950/30",
            isExpanded ? "max-h-96 border-y border-zinc-800/50" : "max-h-0"
          )}
        >
          <div className="p-4 space-y-3">
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

        {/* Футер с кнопками */}
        <div className="p-4 bg-zinc-900/50 flex flex-col gap-3">
          {!isExpanded ? (
            <div className="flex gap-3">
              <Button 
                onClick={handleAcceptAll}
                className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium transition-all shadow-lg shadow-orange-500/20"
              >
                Принять все
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setIsExpanded(true)}
                className="px-4 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800 hover:border-zinc-600"
              >
                Настроить
              </Button>
            </div>
          ) : (
            <div className="flex gap-3">
               <Button 
                variant="outline" 
                onClick={handleSavePreferences}
                className="flex-1 border-zinc-700 text-zinc-300 hover:text-white hover:bg-zinc-800"
              >
                Сохранить выбранное
              </Button>
              <Button 
                onClick={handleAcceptAll}
                className="flex-1 bg-white text-black hover:bg-zinc-200 font-medium"
              >
                Принять все
              </Button>
            </div>
          )}
          
          {/* Мелкий текст ссылок */}
          <div className="flex justify-center gap-4 pt-1">
            <a href="/privacy" className="text-[10px] text-zinc-500 hover:text-zinc-300 transition-colors uppercase tracking-wider">
              Политика конфиденциальности
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// Вспомогательный компонент для опции (Тумблер)
function CookieOption({ 
  label, 
  description, 
  checked, 
  onChange, 
  disabled = false 
}: { 
  label: string
  description: string
  checked: boolean
  onChange?: () => void
  disabled?: boolean
}) {
  return (
    <div className="flex items-start gap-3 select-none">
      <button
        onClick={onChange}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background mt-1",
          checked ? "bg-orange-500" : "bg-zinc-700",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <span
          className={cn(
            "pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
      <div className="flex flex-col">
        <span className="text-sm font-medium text-zinc-200">
          {label} {disabled && <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-500 ml-2">REQUIRED</span>}
        </span>
        <span className="text-xs text-zinc-500 leading-tight">{description}</span>
      </div>
    </div>
  )
}