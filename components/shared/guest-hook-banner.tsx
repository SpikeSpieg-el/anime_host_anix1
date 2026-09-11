"use client"

import { useEffect, useRef, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowRight,
  Bell,
  Gift,
  Layers,
  Sparkles,
  Swords,
  X,
  type LucideIcon,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { AuthModal } from "@/components/auth/auth-modal"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import {
  GUEST_HOOK_COPY,
  GuestHookId,
  canShowGuestHook,
  dismissGuestHook,
  markGuestHookShown,
  openAuthFromGuestHook,
  trackGuestHook,
  type GuestHookIdValue,
  type GuestHookSurface,
} from "@/lib/guest-hooks"

const HOOK_ICONS: Record<GuestHookIdValue, LucideIcon> = {
  [GuestHookId.STARTER_PACK]: Gift,
  [GuestHookId.CHIBI_REWARDS]: Sparkles,
  [GuestHookId.TITLE_DECK]: Layers,
  [GuestHookId.ONGOING_BELL]: Bell,
  [GuestHookId.ARENA_MARKET]: Swords,
}

const HOOK_STYLES: Record<
  GuestHookIdValue,
  { gradient: string; border: string; iconBg: string; badge: string }
> = {
  [GuestHookId.STARTER_PACK]: {
    gradient: "from-amber-500/20 via-orange-500/10 to-background",
    border: "border-amber-500/30",
    iconBg: "bg-amber-500/15 border-amber-500/30 text-amber-400",
    badge: "text-amber-400",
  },
  [GuestHookId.CHIBI_REWARDS]: {
    gradient: "from-orange-500/15 via-primary/10 to-background",
    border: "border-orange-500/25",
    iconBg: "bg-orange-500/15 border-orange-500/30 text-orange-400",
    badge: "text-orange-400",
  },
  [GuestHookId.TITLE_DECK]: {
    gradient: "from-violet-500/20 via-indigo-500/10 to-background",
    border: "border-violet-500/30",
    iconBg: "bg-violet-500/15 border-violet-500/30 text-violet-400",
    badge: "text-violet-400",
  },
  [GuestHookId.ONGOING_BELL]: {
    gradient: "from-sky-500/20 via-cyan-500/10 to-background",
    border: "border-sky-500/30",
    iconBg: "bg-sky-500/15 border-sky-500/30 text-sky-400",
    badge: "text-sky-400",
  },
  [GuestHookId.ARENA_MARKET]: {
    gradient: "from-rose-500/20 via-orange-500/10 to-background",
    border: "border-rose-500/30",
    iconBg: "bg-rose-500/15 border-rose-500/30 text-rose-400",
    badge: "text-rose-400",
  },
}

/** Длительность CSS-исчезновения inline-баннера перед анмаунтом. */
const INLINE_DISMISS_MS = 190

export interface GuestHookBannerProps {
  hookId: GuestHookIdValue
  /** Точка контакта для Umami. */
  trigger?: string
  surface?: GuestHookSurface
  animeId?: string
  animeTitle?: string
  animeStatus?: string
  /** false = не проверять canShow (родитель уже решил). */
  respectFrequency?: boolean
  /** Скрыть баннер после dismiss. */
  onDismiss?: () => void
  /** Внешний контроль видимости. */
  open?: boolean
  className?: string
  /** compact — для fixed toast; full — блок под плеером. */
  density?: "full" | "compact"
}

/**
 * Контекстный баннер-крючок для гостей.
 * Не рендерится для авторизованных; не перекрывает плеер (inline/fixed bottom).
 */
export function GuestHookBanner({
  hookId,
  trigger,
  surface = "banner",
  animeId,
  animeTitle,
  animeStatus,
  respectFrequency = true,
  onDismiss,
  open = true,
  className,
  density = "full",
}: GuestHookBannerProps) {
  const { user } = useAuth()
  const [visible, setVisible] = useState(false)
  const [closing, setClosing] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "register">("register")
  /** CTA нажат — прячем плашку под модалкой авторизации, но держим её смонтированной. */
  const [ctaEngaged, setCtaEngaged] = useState(false)
  const trackedView = useRef(false)
  const dismissTimer = useRef<number | null>(null)

  useEffect(() => {
    if (user || !open) {
      setVisible(false)
      return
    }
    if (respectFrequency && !canShowGuestHook(hookId)) {
      setVisible(false)
      return
    }
    setVisible(true)
    markGuestHookShown(hookId)
    if (!trackedView.current) {
      trackedView.current = true
      trackGuestHook({
        hookId,
        action: "view",
        surface,
        trigger,
        animeId,
        animeTitle,
        animeStatus,
      })
    }
  }, [user, open, hookId, respectFrequency, surface, trigger, animeId, animeTitle, animeStatus])

  useEffect(() => {
    return () => {
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current)
    }
  }, [])

  if (user || !visible) return null

  const copy = GUEST_HOOK_COPY[hookId]
  const styles = HOOK_STYLES[hookId]
  const Icon = HOOK_ICONS[hookId]

  const trackDismiss = () => {
    dismissGuestHook(hookId)
    trackGuestHook({
      hookId,
      action: "dismiss",
      surface,
      trigger,
      animeId,
      animeTitle,
    })
  }

  const handleDismiss = () => {
    trackDismiss()
    if (density === "compact") {
      // Тост: контейнер (framer-motion) сам проиграет exit — контент не трогаем,
      // иначе карточка пропадёт до анимации. Родитель флипнет open и уберёт нас.
      setClosing(true)
      onDismiss?.()
      return
    }
    // Inline: мягкое CSS-исчезновение карточки, затем анмаунт через родителя.
    setClosing(true)
    if (dismissTimer.current) window.clearTimeout(dismissTimer.current)
    dismissTimer.current = window.setTimeout(() => {
      setVisible(false)
      onDismiss?.()
    }, INLINE_DISMISS_MS)
  }

  const openAuth = (mode: "login" | "register") => {
    openAuthFromGuestHook(hookId, { mode, trigger, surface, openGlobalModal: false })
    setAuthMode(mode)
    setAuthOpen(true)
    // Плашку прячем визуально, но НЕ анмаунтим компонент — внутри живёт AuthModal.
    setCtaEngaged(true)
  }

  const handleAuthOpenChange = (next: boolean) => {
    setAuthOpen(next)
    if (!next) {
      // Крючок конвертировал (пользователь дошёл до формы) — плашку убираем без cooldown dismiss.
      setVisible(false)
      onDismiss?.()
    }
  }

  return (
    <>
      {!ctaEngaged && (
        <div
          role="region"
          aria-label={copy.title}
          data-umami-event="guest_hook_view"
          data-umami-event-hook_id={hookId}
          data-guest-hook={hookId}
          className={cn(
            "relative overflow-hidden rounded-2xl border bg-card/90 backdrop-blur-xl shadow-xl transition-all duration-200",
            density === "full" &&
              "animate-in fade-in slide-in-from-bottom-2 duration-300",
            styles.border,
            density === "compact" ? "p-3.5 sm:p-4" : "p-4 sm:p-5",
            closing && "opacity-0 translate-y-1 scale-[0.98] pointer-events-none",
            className,
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 bg-gradient-to-r opacity-90",
              styles.gradient,
            )}
          />

          <button
            type="button"
            onClick={handleDismiss}
            className="group absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors z-10"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4 transition-transform duration-200 group-hover:rotate-90" />
          </button>

          <div className="relative z-10 flex flex-col sm:flex-row items-start gap-3.5 sm:gap-4">
            <div
              className={cn(
                "flex-shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center shadow-inner",
                styles.iconBg,
              )}
            >
              <Icon className="w-5 h-5" />
            </div>

            <div className="flex-1 min-w-0 pr-6">
              <span
                className={cn(
                  "inline-block text-[11px] font-semibold uppercase tracking-wider mb-1",
                  styles.badge,
                )}
              >
                {copy.badge}
              </span>
              <h3 className="font-semibold text-foreground text-sm sm:text-base leading-tight">
                {copy.title}
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-3.5 line-clamp-3">
                {copy.description}
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => openAuth("register")}
                  data-umami-event="guest_hook_cta"
                  data-umami-event-hook_id={hookId}
                  className="group h-8 sm:h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs sm:text-sm shadow-md shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] gap-1.5"
                >
                  <span>{copy.cta}</span>
                  <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>

                {copy.secondaryCta && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => openAuth("login")}
                    className="h-8 sm:h-9 px-3 rounded-lg text-muted-foreground hover:text-foreground font-medium text-xs sm:text-sm"
                  >
                    {copy.secondaryCta}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        isOpen={authOpen}
        onClose={handleAuthOpenChange}
        initialMode={authMode}
      />
    </>
  )
}

/**
 * Анимированная обёртка для fixed toast-позиции.
 * Позиция: правый нижний угол на десктопе, над плавающим доком на мобильном
 * (--bottom-nav-height задаётся в globals.css), выше Chibi (z-40), но ниже
 * навбара/диалогов (z-50) — модалка авторизации всегда перекроет тост.
 */
export function GuestHookToast({
  open,
  onDismiss,
  onExitComplete,
  ...props
}: GuestHookBannerProps & { open: boolean; onExitComplete?: () => void }) {
  return (
    <AnimatePresence onExitComplete={onExitComplete}>
      {open && (
        <motion.aside
          initial={{ opacity: 0, y: 28, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.96 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          aria-label="Мотивация регистрации"
          className="fixed left-4 right-4 sm:left-auto sm:right-6 z-[45] max-w-md pointer-events-auto"
          style={{
            bottom: "calc(var(--bottom-nav-height, 0px) + 1rem)",
          }}
        >
          <GuestHookBanner
            {...props}
            open={open}
            onDismiss={onDismiss}
            density="compact"
            className="shadow-2xl shadow-black/40"
          />
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
