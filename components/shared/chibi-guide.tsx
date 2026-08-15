"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { X, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

// Фразы маскота по контексту и действиям
const MASCOT_MESSAGES = [
  {
    text: "Привет! Помогу найти крутое аниме на вечер ✨",
    action: { label: "Каталог", href: "/catalog" }
  },
  {
    text: "Загляни в Гачу! Вдруг сегодня твоя удача на крутую карточку? 🎰",
    action: { label: "Гача", href: "/gacha" }
  },
  {
    text: "Готов к битве? Испробуй аниме PvP/PvE Арену! ⚔️",
    action: { label: "В бой", href: "/battle" }
  },
  {
    text: "Не знаешь что глянуть? Взгляни на вкладку «Для вас» в баннере! 🌟",
  },
  {
    text: "Добавляй тайтлы в закладки, чтобы не потерять 🔖",
    action: { label: "Закладки", href: "/bookmarks" }
  }
]

export const CHIBI_STORAGE_KEY = "chibi-guide-enabled"
export const CHIBI_TOGGLE_EVENT = "chibi-toggle-event"

// Поддерживаемые типы спрайт-анимаций
export type ChibiAnimation = 'idle' | 'wave' | 'sit' | 'jump' | 'walk' | 'run'

interface AnimationConfig {
  src: string
  frames: number
  rows: number
  duration: number
  steps: number
}

// Конфигурации доступных спрайтшитов персонажа (16x32)
const ANIMATIONS: Record<ChibiAnimation, AnimationConfig> = {
  idle: {
    src: "/char/2/16x32/16x32_Idle-Sheet_elf.png",
    frames: 4,
    rows: 5,
    duration: 1.2,
    steps: 4,
  },
  wave: {
    src: "/char/2/16x32/16x32 Interact-Sheet.png",
    frames: 4,
    rows: 5,
    duration: 0.8,
    steps: 4,
  },
  sit: {
    src: "/char/2/16x32/16x32 Rotate-Sheet.png",
    frames: 4,
    rows: 5,
    duration: 2.0,
    steps: 4,
  },
  jump: {
    src: "/char/2/16x32/16x32 Jump-Sheet.png",
    frames: 4,
    rows: 5,
    duration: 0.6,
    steps: 4,
  },
  walk: {
    src: "/char/2/16x32/16x32 Walk-Sheet.png",
    frames: 4,
    rows: 5,
    duration: 0.8,
    steps: 4,
  },
  run: {
    src: "/char/2/16x32/16x32 Run-Sheet.png",
    frames: 4,
    rows: 5,
    duration: 0.5,
    steps: 4,
  },
}

export function ChibiGuide() {
  const [isEnabled, setIsEnabled] = useState<boolean>(true)
  const [isBubbleOpen, setIsBubbleOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [messageIndex, setMessageIndex] = useState(0)
  const [miniReaction, setMiniReaction] = useState<string | null>(null)

  // Анимация и направление взгляда
  const [currentAnim, setCurrentAnim] = useState<ChibiAnimation>('idle')
  const [row, setRow] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [isAfk, setIsAfk] = useState(false)

  const charRef = useRef<HTMLDivElement>(null)
  const bubbleTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const reactionTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const animTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const afkTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const lastScrollYRef = useRef<number>(0)
  const pathname = usePathname()

  // Включение временной анимации с авто-возвратом в idle
  const playAnimation = useCallback((anim: ChibiAnimation, durationMs: number = 2000) => {
    setCurrentAnim(anim)
    if (animTimeoutRef.current) clearTimeout(animTimeoutRef.current)
    animTimeoutRef.current = setTimeout(() => {
      setCurrentAnim(isAfk ? 'sit' : 'idle')
    }, durationMs)
  }, [isAfk])

  // Аккуратная мини-реакция (маленький значок/эмодзи над головой)
  const triggerMiniReaction = useCallback((symbol: string) => {
    setMiniReaction(symbol)
    if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current)
    reactionTimeoutRef.current = setTimeout(() => {
      setMiniReaction(null)
    }, 1800)
  }, [])

  // Сброс таймера сна/скуки (AFK)
  const resetAfk = useCallback(() => {
    if (isAfk) {
      setIsAfk(false)
      setCurrentAnim('idle')
      triggerMiniReaction("👀")
    }
    if (afkTimeoutRef.current) clearTimeout(afkTimeoutRef.current)
    afkTimeoutRef.current = setTimeout(() => {
      setIsAfk(true)
      setCurrentAnim('sit') // Когда скучает / AFK — садится / отдыхает
    }, 25000)
  }, [isAfk, triggerMiniReaction])

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

  // 1. Анимация приветствия (машет рукой) при первом входе / переходе на главную
  useEffect(() => {
    if (!isEnabled) return
    resetAfk()

    if (pathname === "/") {
      playAnimation('wave', 2200)
      triggerMiniReaction("👋")
    } else if (pathname.includes("/watch")) {
      playAnimation('idle', 1000)
      triggerMiniReaction("🍿")
    } else if (pathname.includes("/catalog")) {
      triggerMiniReaction("🔍")
    } else if (pathname.includes("/gacha")) {
      playAnimation('jump', 1500)
      triggerMiniReaction("✨")
    } else if (pathname.includes("/bookmarks")) {
      triggerMiniReaction("🔖")
    } else if (pathname.includes("/battle")) {
      playAnimation('jump', 1500)
      triggerMiniReaction("⚔️")
    }
  }, [pathname, isEnabled, resetAfk, triggerMiniReaction, playAnimation])

  // 2. Реакция на скролл
  useEffect(() => {
    if (!isEnabled) return

    const handleScroll = () => {
      resetAfk()
      const currentScroll = window.scrollY
      const delta = currentScroll - lastScrollYRef.current

      if (Math.abs(delta) > 15) {
        if (delta > 0) {
          setRow(0) // Вниз
        } else {
          setRow(4) // Вверх
        }
      }
      lastScrollYRef.current = currentScroll
    }

    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [isEnabled, resetAfk])

  // 3. Слежение за курсором мыши (направление взгляда)
  useEffect(() => {
    if (isMobile || !isEnabled || isAfk) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!charRef.current) return
      resetAfk()

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

    window.addEventListener("mousemove", handleMouseMove, { passive: true })
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
      if (afkTimeoutRef.current) clearTimeout(afkTimeoutRef.current)
    }
  }, [isEnabled, isMobile, isAfk, resetAfk])

  // Клик по персонажу: машет рукой + подсказка
  const handleCharClick = useCallback(() => {
    resetAfk()
    setRow(0)
    setIsFlipped(false)
    playAnimation('wave', 2000)
    triggerMiniReaction("💖")

    if (!isBubbleOpen) {
      setIsBubbleOpen(true)
    } else {
      setMessageIndex((prev) => (prev + 1) % MASCOT_MESSAGES.length)
    }

    if (bubbleTimeoutRef.current) clearTimeout(bubbleTimeoutRef.current)
    bubbleTimeoutRef.current = setTimeout(() => {
      setIsBubbleOpen(false)
    }, 7000)
  }, [isBubbleOpen, resetAfk, triggerMiniReaction, playAnimation])

  if (!isEnabled) {
    return null
  }

  const currentMsg = MASCOT_MESSAGES[messageIndex]
  const dynamicBottom = isMobile 
    ? "calc(var(--bottom-nav-height, 88px) + 10px)" 
    : "16px"
  const SIZE = isMobile ? 44 : 56

  const activeConfig = ANIMATIONS[currentAnim] || ANIMATIONS.idle

  return (
    <div 
      style={{ bottom: dynamicBottom }}
      className="fixed right-3 sm:left-4 sm:right-auto z-40 flex flex-col items-end sm:items-start pointer-events-none select-none"
    >
      {/* 💬 Диалоговое облако */}
      {isBubbleOpen && (
        <div 
          className="pointer-events-auto mb-2 max-w-[240px] sm:max-w-[280px] bg-background/95 backdrop-blur-md border border-border p-3 rounded-xl shadow-xl transition-all relative"
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
                bubbleTimeoutRef.current = setTimeout(() => setIsBubbleOpen(false), 7000)
              }}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors ml-auto"
            >
              Дальше →
            </button>
          </div>
        </div>
      )}

      {/* 🚶 Персонаж */}
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
        className="pointer-events-auto relative cursor-pointer flex flex-col items-center opacity-90 hover:opacity-100 transition-opacity"
        title="Нажмите для подсказки"
      >
        {/* Деликатный всплывающий эмодзи реакции */}
        {miniReaction && !isBubbleOpen && (
          <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs select-none pointer-events-none drop-shadow-sm animate-in fade-in zoom-in-75 duration-200">
            {miniReaction}
          </div>
        )}

        {/* Сонный значок при долгом бездействии */}
        {isAfk && !miniReaction && !isBubbleOpen && (
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-[9px] font-mono font-bold text-muted-foreground/70 select-none pointer-events-none">
            zzz
          </div>
        )}

        {/* Контейнер спрайта */}
        <div
          className={cn(
            "relative z-10 transition-transform duration-75 overflow-hidden aspect-square flex-shrink-0",
            isMobile ? "w-[44px] h-[44px]" : "w-[56px] h-[56px]",
            isAfk && "opacity-80"
          )}
          style={{
            backgroundImage: `url('${activeConfig.src}')`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${SIZE * activeConfig.frames}px ${SIZE * activeConfig.rows}px`, 
            backgroundPositionY: `-${row * SIZE}px`,
            transform: `scaleX(${isFlipped ? -1 : 1})`,
            imageRendering: "pixelated",
            animation: `chibi-sprite-anim ${activeConfig.duration}s steps(${activeConfig.steps}) infinite`,
          }}
        />

        {/* Аккуратная тень под ногами */}
        <div className="w-5 sm:w-6 h-1 bg-black/25 rounded-full blur-[1px] -mt-0.5" />
      </div>

      <style jsx global>{`
        @keyframes chibi-sprite-anim {
          from {
            background-position-x: 0px;
          }
          to {
            background-position-x: -${SIZE * activeConfig.frames}px;
          }
        }
      `}</style>
    </div>
  )
}
