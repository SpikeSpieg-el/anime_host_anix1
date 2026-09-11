"use client"

import { useEffect, useRef, useState } from "react"
import {
  ArrowRight,
  Gift,
  Swords,
  Store,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react"
import { useAuth } from "@/components/auth/auth-provider"
import { AuthModal } from "@/components/auth/auth-modal"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
} from "@/lib/guest-hooks"

export interface GuestHookModalProps {
  hookId: GuestHookIdValue
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger?: string
  /** Статистика «живого» сезона (опционально). */
  stats?: {
    liveListings?: number
    topRankLabel?: string
    activePlayers?: number
  }
  respectFrequency?: boolean
}

const STAT_PILLS: {
  key: keyof NonNullable<GuestHookModalProps["stats"]>
  icon: LucideIcon
  label: (v: number | string) => string
  fallback: string
}[] = [
  {
    key: "activePlayers",
    icon: Users,
    label: (v) => `${v} в сезоне`,
    fallback: "PvP в реальном времени",
  },
  {
    key: "liveListings",
    icon: Store,
    label: (v) => `${v} лотов на маркете`,
    fallback: "Открытый маркет карт",
  },
  {
    key: "topRankLabel",
    icon: Trophy,
    label: (v) => `Топ: ${v}`,
    fallback: "Bronze → Grandmaster",
  },
]

/**
 * Модалка-заглушка для гостевых разделов Арена / Маркет / Рейтинг.
 * Показывает ценность экосистемы + CTA на регистрацию.
 */
export function GuestHookModal({
  hookId,
  open,
  onOpenChange,
  trigger = "gate",
  stats,
  respectFrequency = true,
}: GuestHookModalProps) {
  const { user } = useAuth()
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "register">("register")
  const [allowed, setAllowed] = useState(true)
  const trackedView = useRef(false)

  useEffect(() => {
    if (user) {
      onOpenChange(false)
      return
    }
    if (!open) {
      trackedView.current = false
      return
    }
    if (respectFrequency && !canShowGuestHook(hookId)) {
      // Gate-экраны (battle/pvp) всё равно показывают модалку контента,
      // но frequency gate только для «опциональных» показов.
      // Для force gate (respectFrequency=false) всегда ok.
      setAllowed(false)
      return
    }
    setAllowed(true)
    markGuestHookShown(hookId)
    if (!trackedView.current) {
      trackedView.current = true
      trackGuestHook({
        hookId,
        action: "view",
        surface: "modal",
        trigger,
      })
    }
  }, [open, user, hookId, respectFrequency, trigger, onOpenChange])

  if (user) return null

  const copy = GUEST_HOOK_COPY[hookId]
  const isArena = hookId === GuestHookId.ARENA_MARKET
  const isStarter = hookId === GuestHookId.STARTER_PACK

  const handleDismiss = () => {
    dismissGuestHook(hookId)
    trackGuestHook({
      hookId,
      action: "dismiss",
      surface: "modal",
      trigger,
    })
    onOpenChange(false)
  }

  const openAuth = (mode: "login" | "register") => {
    openAuthFromGuestHook(hookId, { mode, trigger, surface: "modal", openGlobalModal: false })
    setAuthMode(mode)
    setAuthOpen(true)
  }

  // Gate-модалки battle/pvp: всегда показываем, frequency только влияет на analytics cap
  const show = open && (allowed || !respectFrequency)

  return (
    <>
      <Dialog
        open={show}
        onOpenChange={(next) => {
          if (!next) handleDismiss()
          else onOpenChange(next)
        }}
      >
        <DialogContent
          className="bg-card border-border text-foreground w-[min(92vw,28rem)] rounded-2xl p-0 overflow-hidden gap-0"
          showCloseButton={false}
        >
          <div className="relative">
            {/* Glow */}
            <div
              className={cn(
                "pointer-events-none absolute inset-0 opacity-80",
                isArena
                  ? "bg-gradient-to-br from-rose-500/25 via-orange-500/10 to-transparent"
                  : "bg-gradient-to-br from-amber-500/25 via-orange-500/10 to-transparent",
              )}
            />

            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-3 right-3 z-20 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors"
              aria-label="Закрыть"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="relative z-10 p-6 sm:p-7">
              <div className="flex justify-center mb-5">
                <div className="relative w-16 h-16">
                  <div
                    className={cn(
                      "absolute inset-0 rounded-full blur-xl animate-pulse",
                      isArena ? "bg-rose-500/30" : "bg-amber-500/30",
                    )}
                  />
                  <div className="relative w-full h-full rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    {isArena ? (
                      <Swords className="w-7 h-7 text-rose-400" />
                    ) : (
                      <Gift className="w-7 h-7 text-amber-400" />
                    )}
                  </div>
                </div>
              </div>

              <DialogHeader className="text-center space-y-2">
                <p
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider",
                    isArena ? "text-rose-400" : "text-amber-400",
                  )}
                >
                  {copy.badge}
                </p>
                <DialogTitle className="text-xl sm:text-2xl font-black tracking-tight text-foreground">
                  {copy.title}
                </DialogTitle>
                <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
                  {copy.description}
                </DialogDescription>
              </DialogHeader>

              {/* Live-ish stats for arena */}
              {(isArena || isStarter) && (
                <div className="mt-5 grid grid-cols-1 gap-2">
                  {STAT_PILLS.map(({ key, icon: Icon, label, fallback }) => {
                    const raw = stats?.[key]
                    const text =
                      raw !== undefined && raw !== null && raw !== ""
                        ? label(raw)
                        : fallback
                    return (
                      <div
                        key={key}
                        className="flex items-center gap-2.5 rounded-xl border border-border/60 bg-muted/30 px-3 py-2.5 text-xs text-muted-foreground"
                      >
                        <Icon className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="font-medium text-foreground/90">{text}</span>
                      </div>
                    )
                  })}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-2.5">
                <Button
                  onClick={() => openAuth("register")}
                  data-umami-event="guest_hook_cta"
                  data-umami-event-hook_id={hookId}
                  className="w-full h-11 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2 shadow-lg shadow-primary/20"
                >
                  {copy.cta}
                  <ArrowRight className="w-4 h-4" />
                </Button>
                {copy.secondaryCta && (
                  <Button
                    variant="ghost"
                    onClick={() => openAuth("login")}
                    className="w-full h-10 rounded-xl text-muted-foreground hover:text-foreground"
                  >
                    {copy.secondaryCta}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AuthModal
        isOpen={authOpen}
        onClose={(open) => setAuthOpen(open)}
        initialMode={authMode}
      />
    </>
  )
}
