"use client"

/**
 * Плашка «Скоро / Озвучка не найдена».
 *
 * Что здесь было сломано
 * ----------------------
 * Кнопка «Уведомить меня» делала только `usePushNotifications().subscribe()` —
 * то есть сохраняла факт «этот браузер умеет получать пуши», но никак не
 * связывала пользователя с тайтлом. Поиск новых серий при этом строился из
 * закладок и истории просмотров, а у тайтла без озвучки истории нет физически.
 * Итог: воронка «зарегистрируйся → включи уведомления» заканчивалась ничем.
 *
 * Как теперь
 * ----------
 * 1. Клик создаёт ожидание в `translation_alerts` (хук useTranslationAlert) —
 *    это и есть гарантия: `POST /api/alerts/check` найдёт его независимо от
 *    закладок и истории.
 * 2. Push-подписка — только канал доставки. Если браузер её не дал, ожидание
 *    всё равно сохраняется, и уведомление появится в колокольчике на сайте.
 * 3. Гость → регистрация → ожидание создаётся автоматически после входа
 *    (намерение переживает перезагрузку страницы через sessionStorage).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertCircle, Bell, BellOff, Check, Clock, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { usePushNotifications } from "@/hooks/use-push-notifications"
import { useTranslationAlert } from "@/hooks/use-translation-alert"
import { useAuth } from "@/components/auth/auth-provider"
import { AuthModal } from "@/components/auth/auth-modal"
import { cn } from "@/lib/utils"
import { trackEvent } from "@/lib/analytics"
import { setGuestHookAuthSource } from "@/lib/guest-hooks"
import { getPushFallbackHint } from "@/lib/push-messages"
import {
  clearPendingAlert,
  readPendingAlerts,
  rememberPendingAlert,
  type TranslationAlertReason,
} from "@/lib/translation-alerts"

export interface EpisodeComingSoonBannerProps {
  /** Номер серии, которую пользователь пытался открыть */
  episodeNumber: number
  /** Название аниме */
  animeTitle: string
  /** ID аниме для подписки и ссылок */
  animeId: string
  /** ID в Shikimori — по нему Kodik ищет озвучки (обычно равен animeId) */
  shikimoriId?: string
  /** Постер: сохраняем вместе с ожиданием для колокольчика */
  poster?: string
  /** Сколько серий известно сейчас — точка отсчёта, чтобы не слать ложное «вышла серия N» */
  baselineEpisode?: number
  /** Класс для стилизации */
  className?: string
  /** Причина: почему серия недоступна */
  reason?: TranslationAlertReason | "loading-failed"
}

export function EpisodeComingSoonBanner({
  episodeNumber,
  animeTitle,
  animeId,
  shikimoriId,
  poster,
  baselineEpisode,
  className,
  reason = "episode-not-ready",
}: EpisodeComingSoonBannerProps) {
  const { user } = useAuth()
  const {
    isSupported: pushSupported,
    isSubscribed: pushSubscribed,
    loading: pushLoading,
    subscribe: subscribePush,
    errorReason: pushErrorReason,
  } = usePushNotifications()

  const targetAnimeId = useMemo(
    () => String(shikimoriId || animeId || "").trim(),
    [shikimoriId, animeId],
  )

  const wantedEpisode = Math.max(1, Math.floor(Number(episodeNumber)) || 1)
  const baseline = Math.max(0, Math.floor(Number(baselineEpisode)) || 0)
  const alertReason: TranslationAlertReason =
    reason === "episode-not-ready" ? "episode-not-ready" : "no-translations"

  const {
    alert,
    loaded: alertLoaded,
    loading: alertLoading,
    error: alertError,
    subscribe: saveAlert,
    unsubscribe: dropAlert,
  } = useTranslationAlert(targetAnimeId || null)

  const [showAuthModal, setShowAuthModal] = useState(false)
  const [vapidConfigured, setVapidConfigured] = useState(true)
  const [pushHint, setPushHint] = useState<string | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [unsubscribed, setUnsubscribed] = useState(false)
  const activatingRef = useRef(false)
  /** Авто-активация после входа выполняется один раз на тайтл (без retry-шторма). */
  const autoActivatedForRef = useRef<string | null>(null)

  // VAPID-ключи нужны только для push — на само ожидание они не влияют.
  useEffect(() => {
    let cancelled = false
    const checkVapid = async () => {
      try {
        const res = await fetch("/api/push/vapid-public-key")
        const data = await res.json()
        if (!cancelled) setVapidConfigured(Boolean(data?.publicKey))
      } catch {
        if (!cancelled) setVapidConfigured(false)
      }
    }
    checkVapid()
    return () => {
      cancelled = true
    }
  }, [])

  const isSubscribed = Boolean(alert) && !unsubscribed
  const isBusy = alertLoading || pushLoading
  /** Push в принципе можно попросить — иначе просто молча полагаемся на колокольчик. */
  const canAskPush = pushSupported && vapidConfigured
  /**
   * Push — лишь канал доставки. Если браузер/сервер его не дают, говорим об
   * этом прямо, но ожидание всё равно сохраняем: уведомление появится в
   * колокольчике на сайте. Старая версия плашки в таком случае вообще прятала
   * кнопку подписки, то есть обещание было невыполнимым молча.
   */
  const pushHintText = pushHint ?? (canAskPush ? null : getPushFallbackHint(pushErrorReason))

  /**
   * Создаёт ожидание и (если браузер позволяет) подключает push.
   * Порядок важен: сначала гарантия, потом канал доставки.
   */
  const activate = useCallback(async () => {
    if (!user || !targetAnimeId || activatingRef.current) return
    activatingRef.current = true
    setSaveFailed(false)

    try {
      const saved = await saveAlert({
        animeId: targetAnimeId,
        animeTitle,
        poster: poster ?? null,
        episode: wantedEpisode,
        baselineEpisode: baseline,
        reason: alertReason,
      })

      if (!saved) {
        setSaveFailed(true)
        trackEvent("episode_coming_soon_alert_error", {
          anime_id: targetAnimeId,
          anime_title: animeTitle,
          episode: wantedEpisode,
          reason: alertReason,
          error: alertError || "save_failed",
        })
        return
      }

      setUnsubscribed(false)
      // Обещание выполнено: намерение гостя больше не нужно.
      clearPendingAlert(targetAnimeId)
      trackEvent("episode_coming_soon_alert_saved", {
        anime_id: targetAnimeId,
        anime_title: animeTitle,
        episode: wantedEpisode,
        reason: alertReason,
      })

      // Push — только доставка. Отказ браузера не отменяет ожидание.
      if (pushSubscribed) {
        setPushHint(null)
        trackEvent("episode_coming_soon_subscribe_success", {
          anime_id: targetAnimeId,
          episode: wantedEpisode,
        })
        return
      }

      if (!canAskPush) {
        setPushHint(getPushFallbackHint(pushErrorReason))
        return
      }

      const result = await subscribePush()
      if (result.ok) {
        setPushHint(null)
        trackEvent("episode_coming_soon_subscribe_success", {
          anime_id: targetAnimeId,
          episode: wantedEpisode,
        })
      } else {
        setPushHint(getPushFallbackHint(result.reason ?? pushErrorReason))
        trackEvent("episode_coming_soon_subscribe_error", {
          anime_id: targetAnimeId,
          episode: wantedEpisode,
          reason: result.reason,
        })
      }
    } finally {
      activatingRef.current = false
    }
  }, [
    user,
    targetAnimeId,
    saveAlert,
    animeTitle,
    poster,
    wantedEpisode,
    baseline,
    alertReason,
    alertError,
    pushSubscribed,
    canAskPush,
    subscribePush,
    pushErrorReason,
  ])

  const handleClick = () => {
    trackEvent("episode_coming_soon_subscribe_click", {
      anime_id: targetAnimeId,
      anime_title: animeTitle,
      episode: wantedEpisode,
      reason,
    })

    if (!user) {
      // Воронка: регистрация → ожидание создастся само сразу после входа.
      // Намерение живёт в localStorage и подхватывается даже тогда, когда вход
      // случился позже (подтверждение почты, другая вкладка, возврат через день).
      rememberPendingAlert({
        animeId: targetAnimeId,
        animeTitle,
        poster: poster ?? null,
        episode: wantedEpisode,
        baselineEpisode: baseline,
        reason: alertReason,
        ts: Date.now(),
      })
      setGuestHookAuthSource("ongoing_bell", "episode_coming_soon")
      setShowAuthModal(true)
      trackEvent("episode_coming_soon_auth_prompt", {
        anime_id: targetAnimeId,
        episode: wantedEpisode,
      })
      return
    }

    activate()
  }

  // Пользователь вошёл (в т.ч. после перезагрузки страницы или подтверждения
  // почты) — выполняем обещание: создаём ожидание и просим push.
  useEffect(() => {
    if (!user || !targetAnimeId) return
    if (autoActivatedForRef.current === targetAnimeId) return
    const pending = readPendingAlerts().find((intent) => intent.animeId === targetAnimeId)
    if (!pending) return
    autoActivatedForRef.current = targetAnimeId
    activate()
  }, [user, targetAnimeId, activate])

  const handleUnsubscribe = async () => {
    trackEvent("episode_coming_soon_unsubscribe", {
      anime_id: targetAnimeId,
      episode: wantedEpisode,
    })
    const ok = await dropAlert()
    if (ok) {
      setUnsubscribed(true)
      setPushHint(null)
    } else {
      setSaveFailed(true)
    }
  }

  const reasonText =
    reason === "no-translations"
      ? "Озвучка не найдена"
      : reason === "loading-failed"
        ? "Не удалось загрузить озвучку"
        : "Серия ещё не вышла"

  const subtext =
    reason === "loading-failed"
      ? "Плеер не ответил. Обновите страницу — обычно это разовый сбой."
      : reason === "no-translations"
        ? `Для «${animeTitle}» ещё нет ни озвучки, ни субтитров. Сохраним тайтл в список ожидания и пришлём уведомление, как только его озвучат — добавлять в закладки не нужно.`
        : `Серия ${wantedEpisode} ещё не вышла или озвучка в процессе. Сохраним ожидание и напомним, как только серия станет доступна.`

  const subscribedText =
    reason === "no-translations"
      ? `«${animeTitle}» в списке ожидания. Как только появится озвучка или субтитры — пришлём уведомление и напомним в колокольчике на сайте.`
      : `«${animeTitle}» в списке ожидания. Как только ${wantedEpisode}-я серия станет доступна — пришлём уведомление и напомним в колокольчике на сайте.`

  return (
    <>
      <div
        data-testid="episode-coming-soon-banner"
        data-reason={reason}
        data-subscribed={isSubscribed ? "true" : "false"}
        className={cn(
          "relative w-full overflow-hidden rounded-xl border border-blue-500/30 bg-blue-950/20 p-3 shadow-lg backdrop-blur-sm transition-all dark:bg-blue-950/30 sm:p-5",
          className,
        )}
      >
        {/* Мягкое свечение */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="relative flex items-start gap-2.5 sm:gap-4">
          {/* Иконка */}
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-blue-500/30 bg-blue-500/20 sm:h-11 sm:w-11">
            {isSubscribed ? (
              <Check className="h-4 w-4 text-blue-400 sm:h-5 sm:w-5" />
            ) : (
              <Clock className="h-4 w-4 text-blue-400 sm:h-5 sm:w-5" />
            )}
          </div>

          {/* Текстовая часть */}
          <div className="min-w-0 flex-1">
            {/* Верхний бейдж */}
            <div className="mb-1 flex items-center gap-1.5">
              <span className="flex h-4 w-4 flex-shrink-0 items-center justify-center rounded bg-blue-500/15 text-blue-400 sm:h-5 sm:w-5">
                <Bell className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
              </span>
              <span className="truncate text-[10px] font-bold uppercase tracking-wider text-blue-400/90 sm:text-[11px]">
                {isSubscribed ? "Ожидание активно" : reason === "loading-failed" ? "Ошибка" : "Скоро"}
              </span>
            </div>

            <h4 className="text-[13px] font-semibold leading-snug text-zinc-100 sm:text-base">
              {isSubscribed ? "Уведомление придёт" : reasonText}
            </h4>
            <p className="mt-1 text-[11px] leading-relaxed text-zinc-400 [overflow-wrap:anywhere] sm:text-sm">
              {isSubscribed ? subscribedText : subtext}
            </p>

            {/* Push недоступен — честно говорим, что уведомление всё равно будет */}
            {pushHintText && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-snug text-zinc-500 sm:text-xs">
                <AlertCircle className="mt-px h-3 w-3 flex-shrink-0" />
                <span>{pushHintText}</span>
              </p>
            )}

            {saveFailed && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[10px] leading-snug text-red-400 sm:text-xs">
                <AlertCircle className="mt-px h-3 w-3 flex-shrink-0" />
                <span>
                  Не удалось сохранить ожидание. Проверьте соединение и нажмите ещё раз — иначе
                  уведомление не придёт.
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Кнопки действий */}
        <div className="relative mt-3 flex flex-col gap-2 sm:mt-4 sm:flex-row sm:flex-wrap sm:items-center">
          {reason === "loading-failed" ? (
            <Button
              onClick={() => window.location.reload()}
              size="sm"
              className="h-9 w-full text-xs font-semibold text-white shadow-md shadow-blue-500/15 transition-all bg-blue-600 hover:bg-blue-500 active:scale-95 sm:w-auto sm:min-w-[160px]"
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              <span>Обновить страницу</span>
            </Button>
          ) : isSubscribed ? (
            <>
              <div className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-blue-500/30 bg-blue-500/10 px-3 text-xs font-semibold text-blue-300 sm:w-auto sm:min-w-[160px]">
                <Check className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">Вы подписаны</span>
              </div>
              <Button
                onClick={handleUnsubscribe}
                disabled={alertLoading}
                size="sm"
                variant="ghost"
                className="h-9 w-full text-xs font-semibold text-zinc-400 hover:bg-white/5 hover:text-zinc-200 sm:w-auto"
              >
                <BellOff className="mr-2 h-3.5 w-3.5" />
                <span>Отменить уведомление</span>
              </Button>
            </>
          ) : (
            <Button
              onClick={handleClick}
              disabled={isBusy || (alertLoaded && isSubscribed)}
              size="sm"
              className="h-9 w-full text-xs font-semibold text-white shadow-md shadow-blue-500/15 transition-all bg-blue-600 hover:bg-blue-500 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[180px] sm:flex-1"
            >
              {isBusy ? (
                <span className="flex items-center gap-2">
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  <span>{user ? "Сохраняем..." : "Нужен вход..."}</span>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  <Bell className="h-3.5 w-3.5 flex-shrink-0" />
                  {/* Короткая подпись: на 320px длинная уходит в многоточие */}
                  <span className="truncate">{user ? "Уведомить меня" : "Войти и уведомить"}</span>
                </span>
              )}
            </Button>
          )}

          {!isSubscribed && reason !== "loading-failed" && !user && (
            <p className="text-[10px] leading-snug text-zinc-500 sm:text-xs">
              Нужен аккаунт: ожидание привяжется к профилю и уведомление придёт на
              любое устройство.
            </p>
          )}
        </div>
      </div>

      {/* Модалка авторизации */}
      <AuthModal isOpen={showAuthModal} onClose={setShowAuthModal} initialMode="register" />
    </>
  )
}
