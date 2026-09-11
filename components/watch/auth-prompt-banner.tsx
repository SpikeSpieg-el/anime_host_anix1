"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { useAuth } from "@/components/auth/auth-provider"
import { AuthModal } from "@/components/auth/auth-modal"
import { Button } from "@/components/ui/button"
import { UserPlus, X, Sparkles, Bookmark, Film, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

export type AuthPromptVariant = "under-player" | "bookmarks" | "exit"

interface AuthPromptBannerProps {
  variant?: AuthPromptVariant
  onDismiss?: () => void
  className?: string
}

export function AuthPromptBanner({
  variant = "under-player",
  onDismiss,
  className
}: AuthPromptBannerProps) {
  const { user } = useAuth()
  const [dismissed, setDismissed] = useState(false)
  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authMode, setAuthMode] = useState<"login" | "register">("register")

  if (user || dismissed) return null

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  const openAuth = (mode: "login" | "register") => {
    setAuthMode(mode)
    setAuthModalOpen(true)
  }

  const variantConfig = {
    "under-player": {
      badge: "Синхронизация",
      title: "Сохраняйте прогресс просмотра",
      description: "Создайте аккаунт, чтобы продолжить с нужной серии и таймкода на любом устройстве.",
      icon: Film,
      actionText: "Создать аккаунт",
      gradient: "from-primary/15 via-primary/5 to-background",
      border: "border-primary/20",
    },
    "bookmarks": {
      badge: "Закладки",
      title: "Закладка сохранена локально",
      description: "Войдите в аккаунт, чтобы избранное и список «Смотрю» были всегда под рукой.",
      icon: Bookmark,
      actionText: "Синхронизировать",
      gradient: "from-amber-500/15 via-primary/10 to-background",
      border: "border-amber-500/25",
    },
    "exit": {
      badge: "Не упустите аниме",
      title: "Понравилась серия?",
      description: "Зарегистрируйтесь в один клик, чтобы не потерять историю и получать уведомления о новых эпизодах.",
      icon: Sparkles,
      actionText: "Сохранить прогресс",
      gradient: "from-purple-500/15 via-primary/10 to-background",
      border: "border-purple-500/25",
    }
  }

  const { title, description, badge, icon: Icon, actionText, gradient, border } = variantConfig[variant]

  return (
    <>
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-card/90 backdrop-blur-xl p-4 sm:p-5 shadow-xl transition-all",
          border,
          className
        )}
      >
        {/* Фоновое мягкое свечение */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-r opacity-90",
            gradient
          )}
        />

        {/* Кнопка закрытия */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors z-10"
          aria-label="Закрыть уведомление"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative z-10 flex flex-col sm:flex-row items-start gap-4">
          <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center text-primary shadow-inner">
            <Icon className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0 pr-6">
            {badge && (
              <span className="inline-block text-[11px] font-semibold uppercase tracking-wider text-primary mb-1">
                {badge}
              </span>
            )}
            <h3 className="font-semibold text-foreground text-sm sm:text-base leading-tight">
              {title}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 mb-3.5 line-clamp-2">
              {description}
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                onClick={() => openAuth("register")}
                className="h-8 sm:h-9 px-4 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-medium text-xs sm:text-sm shadow-md shadow-primary/20 transition-all hover:scale-[1.02] active:scale-[0.98] gap-1.5"
              >
                <span>{actionText}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>

              <Button
                size="sm"
                variant="ghost"
                onClick={() => openAuth("login")}
                className="h-8 sm:h-9 px-3 rounded-lg text-muted-foreground hover:text-foreground font-medium text-xs sm:text-sm"
              >
                Войти
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* ОДИН экземпляр модалки для исключения конфликтов в DOM */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authMode}
      />
    </>
  )
}
