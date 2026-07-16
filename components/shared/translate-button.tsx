"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Languages, Check, ChevronDown } from "lucide-react"

declare global {
  interface Window {
    google?: any
    googleTranslateElementInit?: () => void
  }
}

const LANGUAGES = [
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "en", name: "English", flag: "🇬🇧" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "pt", name: "Português", flag: "🇵🇹" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "zh-CN", name: "中文", flag: "🇨🇳" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { code: "tr", name: "Türkçe", flag: "🇹🇷" },
  { code: "uk", name: "Українська", flag: "🇺🇦" },
  { code: "pl", name: "Polski", flag: "🇵🇱" },
  { code: "id", name: "Indonesia", flag: "🇮🇩" },
  { code: "th", name: "ไทย", flag: "🇹🇭" },
  { code: "vi", name: "Tiếng Việt", flag: "🇻🇳" },
]

export function TranslateButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentLang, setCurrentLang] = useState("ru")
  const [scriptLoaded, setScriptLoaded] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const initRef = useRef(false)

  useEffect(() => {
    const cookie = document.cookie.match(/googtrans=\/ru\/([a-zA-Z\-]+)/)
    if (cookie) {
      setCurrentLang(cookie[1])
    }
  }, [])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true

    window.googleTranslateElementInit = () => {
      if (window.google?.translate?.TranslateElement) {
        new window.google.translate.TranslateElement(
          { pageLanguage: "ru", autoDisplay: false },
          "google_translate_element"
        )
        setScriptLoaded(true)
      }
    }

    const existing = document.querySelector('script[src*="translate.google.com"]')
    if (!existing) {
      const script = document.createElement("script")
      script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit"
      script.async = true
      script.onload = () => setScriptLoaded(true)
      document.head.appendChild(script)
    } else {
      setScriptLoaded(true)
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const changeLanguage = useCallback((langCode: string) => {
    const currentPath = window.location.pathname + window.location.search
    document.cookie = `googtrans=/ru/${langCode}; path=/; max-age=31536000; SameSite=Lax`
    setCurrentLang(langCode)
    setIsOpen(false)

    const select = document.querySelector<HTMLSelectElement>(".goog-te-combo")
    if (select) {
      select.value = langCode
      select.dispatchEvent(new Event("change"))
    } else {
      window.location.reload()
    }
  }, [])

  const resetToRussian = useCallback(() => {
    document.cookie = "googtrans=; path=/; max-age=0"
    setCurrentLang("ru")
    setIsOpen(false)
    window.location.reload()
  }, [])

  const currentLangName = LANGUAGES.find(l => l.code === currentLang)

  return (
    <div ref={dropdownRef} className="relative">
      <div id="google_translate_element" className="hidden" />

      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-muted hover:bg-accent border hover:border-primary text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all"
        aria-label="Перевести страницу"
        aria-expanded={isOpen}
      >
        <Languages className="w-4 h-4" />
        <span className="text-sm">
          {currentLang !== "ru" && currentLangName ? (
            <span className="flex items-center gap-1.5">
              <span>{currentLangName.flag}</span>
              {currentLangName.name}
            </span>
          ) : (
            "Перевести"
          )}
        </span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 z-50 w-56 max-h-[400px] overflow-y-auto bg-popover border border-border rounded-xl shadow-2xl p-2 animate-in fade-in zoom-in-95 duration-150">
          {currentLang !== "ru" && (
            <button
              onClick={resetToRussian}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm font-medium text-foreground"
            >
              <span className="text-base">🇷🇺</span>
              <span>Русский</span>
              <Check className="w-4 h-4 ml-auto text-primary" />
            </button>
          )}

          {currentLang !== "ru" && <div className="h-px bg-border my-1" />}

          <div className="space-y-0.5">
            {LANGUAGES.filter(l => l.code !== "ru").map(lang => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-accent transition-colors text-sm ${
                  currentLang === lang.code
                    ? "text-primary font-medium bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <span>{lang.name}</span>
                {currentLang === lang.code && (
                  <Check className="w-4 h-4 ml-auto text-primary" />
                )}
              </button>
            ))}
          </div>

          {!scriptLoaded && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Загрузка переводчика...
            </div>
          )}
        </div>
      )}
    </div>
  )
}
