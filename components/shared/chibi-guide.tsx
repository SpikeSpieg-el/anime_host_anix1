"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { X, ChevronRight, MessageSquare } from "lucide-react"
import { cn } from "@/lib/utils"

// Фразы маскота
const MASCOT_MESSAGES = [
  {
    text: "Привет! Давай помогу найти крутое аниме на вечер ✨",
    action: { label: "Каталог", href: "/catalog" }
  },
  {
    text: "Загляни в Гачу! Вдруг сегодня твоя удача на SSS-ранге? 🎰",
    action: { label: "Гача", href: "/gacha" }
  },
  {
    text: "Готов к битве? Испробуй аниме PvP/PvE Арену! ⚔️",
    action: { label: "В бой", href: "/battle" }
  },
  {
    text: "Не знаешь что глянуть? Нажми вкладку «Для вас» в баннере! 🌟",
  },
  {
    text: "Добавляй тайтлы в закладки, чтобы не потерять 🔖",
  }
]

export const CHIBI_STORAGE_KEY = "chibi-guide-enabled"
export const CHIBI_TOGGLE_EVENT = "chibi-toggle-event"

export function ChibiGuide() {
  const [isEnabled, setIsEnabled] = useState<boolean>(true)
  const [isBubbleOpen, setIsBubbleOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [messageIndex, setMessageIndex] = useState(0)

  // Стадии взгляда маскота
  const [row, setRow] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isInteracting, setIsInteracting] = useState(false)

  const charRef = useRef<HTMLDivElement>(null)
  const bubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Синхронизация настройки включения/выключения
  useEffect(() => {
    const saved = localStorage.getItem(CHIBI_STORAGE_KEY)
    if (saved !== null) {
      setIsEnabled(saved === "true")
    }

    const handleToggle = (e: CustomEvent<{ enabled: boolean }>) => {
      setIsEnabled(e.detail.enabled)
    }

    window.addEventListener(CHIBI_TOGGLE_EVENT as any, handleToggle as any)
    return () => {
      window.removeEventListener(CHIBI_TOGGLE_EVENT as any, handleToggle as any)
    }
  }, [])

  // Определение мобильного устройства
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640 || 'ontouchstart' in window)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Слежение за курсором мыши без назойливости
  useEffect(() => {
    if (isMobile || !isEnabled) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!charRef.current) return

      const rect = charRef.current.getBoundingClientRect()
      const charX = rect.left + rect.width / 2
      const charY = rect.top + rect.height / 2

      const dx = e.clientX - charX
      const dy = e.clientY - charY
      const dist = Math.hypot(dx, dy)

      if (dist < 40) {
        setRow(0)
        setIsFlipped(false)
        return
      }

      const angle = Math.atan2(dy, dx) * (180 / Math.PI)

      if (angle >= 45 && angle <= 135) {
        setRow(0)
        setIsFlipped(false)
      } else if (angle > 15 && angle < 45) {
        setRow(1)
        setIsFlipped(false)
      } else if (angle > 135 && angle < 165) {
        setRow(1)
        setIsFlipped(true)
      } else if (angle >= -15 && angle <= 15) {
        setRow(2)
        setIsFlipped(false)
      } else if (angle >= 165 || angle <= -165) {
        setRow(2)
        setIsFlipped(true)
      } else if (angle > -75 && angle < -15) {
        setRow(3)
        setIsFlipped(false)
      } else if (angle > -165 && angle < -105) {
        setRow(3)
        setIsFlipped(true)
      } else if (angle >= -105 && angle <= -75) {
        setRow(4)
        setIsFlipped(false)
      }
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => window.removeEventListener("mousemove", handleMouseMove)
  }, [isEnabled, isMobile])

  // Клик по персонажу — открывает/переключает реплику спокойно без авто-всплывания
  const handleCharClick = useCallback(() => {
    setIsInteracting(true)
    setRow(0)
    setIsFlipped(false)

    if (!isBubbleOpen) {
      setIsBubbleOpen(true)
    } else {
      setMessageIndex((prev) => (prev + 1) % MASCOT_MESSAGES.length)
    }

    if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current)
    bubbleTimeoutRef.current = setTimeout(() => {
      setIsBubbleOpen(false)
      setIsInteracting(false)
    }, 8000)

    setTimeout(() => {
      setIsInteracting(false)
    }, 400)
  }, [isBubbleOpen])

  // Если отключен пользователем — не рендерится вообще
  if (!isEnabled) {
    return null
  }

  const currentMsg = MASCOT_MESSAGES[messageIndex]
  const dynamicBottom = isMobile 
    ? "calc(var(--bottom-nav-height, 88px) + 10px)" 
    : "16px"
  const SIZE = isMobile ? 44 : 56

  return (
    <div 
      style={{ bottom: dynamicBottom }}
      className="fixed right-3 sm:left-4 sm:right-auto z-40 flex flex-col items-end sm:items-start pointer-events-none select-none"
    >
      {/* 💬 Лаконичное диалоговое облако (только по клику пользователя) */}
      {isBubbleOpen && (
        <div 
          className="pointer-events-auto mb-2 max-w-[240px] sm:max-w-[280px] bg-background/95 backdrop-blur-sm border border-border p-3 rounded-xl shadow-lg transition-all relative"
        >
          {/* Хвостик диалога */}
          <div className="absolute -bottom-1.5 right-4 sm:right-auto sm:left-6 w-2.5 h-2.5 bg-background border-r border-b border-border rotate-45" />

          {/* Шапка диалога */}
          <div className="flex items-center justify-between pb-1 mb-1 border-b border-border/50">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                Гид
              </span>
            </div>
            
            <button
              onClick={() => setIsBubbleOpen(false)}
              className="text-muted-foreground hover:text-foreground p-0.5 rounded transition-colors"
              title="Закрыть"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          {/* Текст */}
          <p className="text-xs text-foreground/90 leading-snug">
            {currentMsg.text}
          </p>

          {/* Быстрые действия */}
          <div className="mt-2 flex items-center justify-between gap-2 pt-1 border-t border-border/40">
            {currentMsg.action ? (
              <Link
                href={currentMsg.action.href}
                onClick={() => setIsBubbleOpen(false)}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-secondary hover:bg-secondary/80 text-foreground rounded-md text-[10px] font-medium transition-colors"
              >
                <span>{currentMsg.action.label}</span>
                <ChevronRight className="w-2.5 h-2.5" />
              </Link>
            ) : (
              <span />
            )}

            <button
              onClick={() => {
                setMessageIndex((prev) => (prev + 1) % MASCOT_MESSAGES.length)
                if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current)
                bubbleTimeoutRef.current = setTimeout(() => setIsBubbleOpen(false), 8000)
              }}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors ml-auto"
            >
              Дальше →
            </button>
          </div>
        </div>
      )}

      {/* 🚶 Персонаж (без свечения и навязчивых анимаций) */}
      <div 
        onClick={handleCharClick}
        ref={charRef}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            handleCharClick()
          }
        }}
        className="pointer-events-auto relative cursor-pointer flex flex-col items-center opacity-85 hover:opacity-100 transition-opacity"
        title="Нажмите для подсказки"
      >
        {/* Контейнер спрайта */}
        <div
          className={cn(
            "relative z-10 transition-transform duration-75 overflow-hidden aspect-square flex-shrink-0",
            isMobile ? "w-[44px] h-[44px]" : "w-[56px] h-[56px]",
            isInteracting && "scale-105"
          )}
          style={{
            backgroundImage: `url('/char/2/16x32/16x32_Idle-Sheet_elf.png')`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${SIZE * 4}px ${SIZE * 5}px`, 
            backgroundPositionY: `-${row * SIZE}px`,
            transform: `scaleX(${isFlipped ? -1 : 1})`,
            imageRendering: "pixelated",
            animation: "chibi-idle-simple 1.2s steps(4) infinite",
          }}
        />

        {/* Аккуратная тень */}
        <div className="w-5 sm:w-6 h-1 bg-black/30 rounded-full blur-[1px] -mt-0.5" />
      </div>

      <style jsx global>{`
        @keyframes chibi-idle-simple {
          from {
            background-position-x: 0px;
          }
          to {
            background-position-x: -${SIZE * 4}px;
          }
        }
      `}</style>
    </div>
  )
}
