"use client"

import { useState, useEffect } from "react"
import { Bell, Clock, Check, AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { useAuth } from "@/components/auth/auth-provider"
import { AuthModal } from "@/components/auth/auth-modal"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/analytics"
import { setGuestHookAuthSource } from "@/lib/guest-hooks"

interface EpisodeComingSoonBannerProps {
  /** Номер серии, которая скоро выйдет */
  episodeNumber: number
  /** Название аниме */
  animeTitle: string
  /** ID аниме для подписки */
  animeId: string
  /** Класс для стилизации */
  className?: string
  /** Причина: почему серия недоступна */
  reason?: "no-translations" | "episode-not-ready" | "loading-failed"
}

export function EpisodeComingSoonBanner({
  episodeNumber,
  animeTitle,
  animeId,
  className,
  reason = "episode-not-ready",
}: EpisodeComingSoonBannerProps) {
  const { user } = useAuth()
  const { isSupported, isSubscribed, permission, loading, subscribe, unsubscribe, errorReason } = usePushNotifications()
  const [showSuccess, setShowSuccess] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [shouldSubscribeAfterAuth, setShouldSubscribeAfterAuth] = useState(false)
  const [vapidConfigured, setVapidConfigured] = useState(true)

  // Проверяем наличие VAPID ключей
  useEffect(() => {
    const checkVapid = async () => {
      try {
        const res = await fetch("/api/push/vapid-public-key")
        const data = await res.json()
        setVapidConfigured(!!data.publicKey)
      } catch {
        setVapidConfigured(false)
      }
    }
    checkVapid()
  }, [])

  // После успешной авторизации автоматически подписываем на уведомления
  useEffect(() => {
    if (shouldSubscribeAfterAuth && user && isSupported && vapidConfigured) {
      setShouldSubscribeAfterAuth(false)
      handleSubscribe()
    }
  }, [user, shouldSubscribeAfterAuth, isSupported, vapidConfigured])

  const handleSubscribe = async () => {
    trackEvent("episode_coming_soon_subscribe_click", {
      anime_id: animeId,
      anime_title: animeTitle,
      episode: episodeNumber,
      reason,
    })

    const result = await subscribe()
    if (result.ok) {
      setShowSuccess(true)
      trackEvent("episode_coming_soon_subscribe_success", {
        anime_id: animeId,
        episode: episodeNumber,
      })
    } else {
      trackEvent("episode_coming_soon_subscribe_error", {
        anime_id: animeId,
        episode: episodeNumber,
        reason: result.reason,
      })
    }
  }

  const handleButtonClick = () => {
    if (!user) {
      // Открываем модалку регистрации для воронки
      setGuestHookAuthSource("ongoing_bell", "episode_coming_soon")
      setShouldSubscribeAfterAuth(true)
      setShowAuthModal(true)
      trackEvent("episode_coming_soon_auth_prompt", {
        anime_id: animeId,
        episode: episodeNumber,
      })
    } else {
      handleSubscribe()
    }
  }

  const getReasonText = () => {
    switch (reason) {
      case "no-translations":
        return "Озвучка не найдена"
      case "loading-failed":
        return "Не удалось загрузить озвучку"
      default:
        return "Серия ещё не вышла"
    }
  }

  const getSubtext = () => {
    switch (reason) {
      case "no-translations":
        return "К сожалению, озвучка этой серии ещё не добавлена. Проверьте позже или подпишитесь на уведомление."
      case "loading-failed":
        return "Не удалось загрузить плеер. Попробуйте позже."
      default:
        return "Эта серия ещё не вышла или озвучка в процессе. Проверьте позже или подпишитесь на уведомление."
    }
  }

  const notificationsDisabled = !isSupported || !vapidConfigured

  return (
    <>
      <div
        className={cn(
          "relative w-full overflow-hidden rounded-xl border border-blue-500/30 bg-blue-950/20 dark:bg-blue-950/30 p-4 sm:p-5 shadow-lg backdrop-blur-sm transition-all",
          className
        )}
      >
        {/* Мягкое свечение */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="flex gap-3 sm:gap-4 items-start">
          {/* Иконка */}
          <div className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
            {showSuccess ? (
              <Check className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            ) : (
              <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
            )}
          </div>

          {/* Текстовая часть */}
          <div className="flex-1 pr-4 sm:pr-2">
            {/* Верхний бейдж */}
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="flex h-4 w-4 sm:h-5 sm:w-5 items-center justify-center rounded bg-blue-500/15 text-blue-400">
                <Bell className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              </span>
              <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-blue-400/90">
                {showSuccess ? "Подписка оформлена" : "Скоро"}
              </span>
            </div>

            <h4 className="text-sm sm:text-base font-semibold text-zinc-100">
              {showSuccess ? "Вы получите уведомление" : getReasonText()}
            </h4>
            <p className="mt-1 text-xs sm:text-sm text-zinc-400 leading-relaxed">
              {showSuccess
                ? `Мы пришлём вам уведомление, когда ${episodeNumber} серия «${animeTitle}» станет доступной.`
                : getSubtext()}
            </p>
          </div>
        </div>

        {/* Кнопки действий */}
        {!showSuccess && (
          <div className="mt-3 sm:mt-4 flex flex-wrap items-center gap-2">
            {!notificationsDisabled && (
              <Button
                onClick={handleButtonClick}
                disabled={loading || isSubscribed}
                size="sm"
                className="flex-1 min-w-[140px] h-9 text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/15 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    <span>Подписка...</span>
                  </span>
                ) : isSubscribed ? (
                  <span className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5" />
                    <span>Подписано</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <Bell className="w-3.5 h-3.5" />
                    <span>Уведомить меня</span>
                  </span>
                )}
              </Button>
            )}

            {notificationsDisabled && (
              <Button
                onClick={() => window.location.reload()}
                size="sm"
                variant="outline"
                className="flex-1 min-w-[140px] h-9 text-xs font-semibold border-blue-500/30 text-blue-400 hover:bg-blue-500/10 transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5 mr-2" />
                <span>Проверить позже</span>
              </Button>
            )}

            {notificationsDisabled && (
              <div className="text-xs text-zinc-500 flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-zinc-800/50">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Уведомления временно недоступны</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Модалка авторизации */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={setShowAuthModal}
        initialMode="register"
      />
    </>
  )
}
