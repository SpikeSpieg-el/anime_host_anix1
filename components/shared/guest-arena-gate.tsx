"use client"

/**
 * Полноэкранный gate для гостей на /battle, /pvp, market.
 * Показывает ценность сезонной арены + CTA «Создать профиль игрока».
 */

import { useEffect, useRef, useState } from "react"
import {
  ArrowRight,
  LogIn,
  Store,
  Swords,
  Trophy,
  Users,
} from "lucide-react"
import { AuthModal } from "@/components/auth/auth-modal"
import { Button } from "@/components/ui/button"
import {
  GUEST_HOOK_COPY,
  GuestHookId,
  markGuestHookShown,
  openAuthFromGuestHook,
  trackGuestHook,
} from "@/lib/guest-hooks"
import { cn } from "@/lib/utils"

export interface GuestArenaGateProps {
  /** pvp | pve | market */
  variant?: "pvp" | "pve" | "market"
  className?: string
}

const VARIANT_ACCENT = {
  pvp: {
    glow: "bg-purple-500/25",
    badge: "text-purple-300",
    gradient: "from-purple-400 to-pink-500",
  },
  pve: {
    glow: "bg-rose-500/25",
    badge: "text-rose-300",
    gradient: "from-orange-400 to-rose-500",
  },
  market: {
    glow: "bg-amber-500/25",
    badge: "text-amber-300",
    gradient: "from-amber-400 to-orange-500",
  },
} as const

const STAT_ROWS = [
  { icon: Users, text: "PvP в реальном времени · MMR Bronze → Grandmaster" },
  { icon: Store, text: "Открытый маркет редких карт между игроками" },
  { icon: Trophy, text: "Сезонный рейтинг и таблица лидеров Weebx" },
] as const

export function GuestArenaGate({ variant = "pvp", className }: GuestArenaGateProps) {
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "register">("register")
  const tracked = useRef(false)

  const copy = GUEST_HOOK_COPY[GuestHookId.ARENA_MARKET]
  const accent = VARIANT_ACCENT[variant]
  const trigger =
    variant === "market" ? "market_gate" : variant === "pve" ? "battle_gate" : "pvp_gate"

  useEffect(() => {
    if (tracked.current) return
    tracked.current = true
    markGuestHookShown(GuestHookId.ARENA_MARKET)
    trackGuestHook({
      hookId: GuestHookId.ARENA_MARKET,
      action: "view",
      surface: "gate",
      trigger,
    })
  }, [trigger])

  const openAuth = (mode: "login" | "register") => {
    openAuthFromGuestHook(GuestHookId.ARENA_MARKET, {
      mode,
      trigger,
      surface: "gate",
      openGlobalModal: false,
    })
    setAuthMode(mode)
    setAuthOpen(true)
  }

  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-20 flex items-center justify-center p-4 bg-[#05050A]",
          className,
        )}
        data-guest-hook={GuestHookId.ARENA_MARKET}
        data-umami-event="guest_hook_view"
        data-umami-event-hook_id={GuestHookId.ARENA_MARKET}
      >
        <div className="max-w-md w-full text-center space-y-5 animate-in fade-in zoom-in-95">
          <div className="relative w-24 h-24 mx-auto mb-2">
            <div
              className={cn(
                "absolute inset-0 rounded-full blur-xl animate-pulse",
                accent.glow,
              )}
            />
            <div className="relative w-full h-full rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
              <Swords className="w-10 h-10 text-orange-500" />
            </div>
          </div>

          <p
            className={cn(
              "text-[11px] font-bold uppercase tracking-[0.2em]",
              accent.badge,
            )}
          >
            {copy.badge}
          </p>

          <h1 className="text-2xl md:text-3xl font-black tracking-tighter text-white">
            {copy.title.split(" ").slice(0, 2).join(" ")}{" "}
            <span
              className={cn(
                "text-transparent bg-clip-text bg-gradient-to-r",
                accent.gradient,
              )}
            >
              {copy.title.split(" ").slice(2).join(" ") || "Weebx"}
            </span>
          </h1>

          <p className="text-slate-400 text-sm md:text-base max-w-sm mx-auto leading-relaxed">
            {copy.description}
          </p>

          <ul className="text-left space-y-2 max-w-sm mx-auto">
            {STAT_ROWS.map(({ icon: Icon, text }) => (
              <li
                key={text}
                className="flex items-start gap-2.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-xs text-slate-300"
              >
                <Icon className="w-3.5 h-3.5 text-orange-400 mt-0.5 shrink-0" />
                <span>{text}</span>
              </li>
            ))}
          </ul>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Button
              onClick={() => openAuth("register")}
              data-umami-event="guest_hook_cta"
              data-umami-event-hook_id={GuestHookId.ARENA_MARKET}
              className="inline-flex items-center justify-center gap-2 px-7 h-12 bg-white text-black hover:bg-zinc-200 font-bold text-base rounded-xl shadow-lg shadow-white/10 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              {copy.cta}
              <ArrowRight className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => openAuth("login")}
              className="h-11 px-5 rounded-xl text-slate-400 hover:text-white gap-2"
            >
              <LogIn className="w-4 h-4" />
              Войти
            </Button>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={authOpen}
        onClose={(open) => setAuthOpen(open)}
        initialMode={authMode}
      />
    </>
  )
}
