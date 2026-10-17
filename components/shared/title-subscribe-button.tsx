"use client"

/**
 * Кнопка подписки на тайтл.
 *
 * Где живёт
 * ---------
 * Только на странице просмотра (`/watch`), в шапке тайтла рядом с «В
 * закладки». Раньше та же кнопка стояла ещё и колокольчиком на постере в
 * каталоге, поиске, расписании и на главной — и это обещание было пустым:
 * карточка не различала ongoing и давно завершённый тайтл, так что «следить
 * за новыми сериями» предлагалось и там, где новых серий не будет никогда.
 * Теперь точка подписки одна, и человек попадает в неё уже решив, что тайтл
 * ему интересен.
 *
 * Почему это отдельный компонент, а не кнопка внутри страницы тайтла
 * ----------------------------------------------------------------------
 * Раньше единственная кнопка жила внутри плашки плеера и рисовалась только
 * когда контента прямо сейчас нет — то есть подписаться на нормальный
 * тайтл было физически негде.
 *
 * Гость
 * ------
 * Нажатие без входа НЕ подписывает и НЕ пишет в БД: сохраняется намерение в
 * localStorage и открывается регистрация. Намерение подхватывается после
 * входа (`activatePending`), поэтому «подписался, потом вошёл» работает
 * даже если человек вернулся через сутки после подтверждения почты.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import { Bell, BellOff, Check, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuthModal } from "@/components/auth/auth-modal"
import { useAuth } from "@/components/auth/auth-provider"
import { useTitleSubscription } from "@/hooks/use-title-subscription"
import { useTranslationAlert } from "@/hooks/use-translation-alert"
import {
  SUBSCRIBE_DEEP_LINK_PARAM,
  readPendingSubscriptions,
  rememberPendingSubscription,
  isSubscribed as hasActiveSubscription,
  subscriptionSummary,
} from "@/lib/title-subscriptions"
import {
  currentDubEpisodes,
  nextDubEpisode,
  type AlertTranslation,
  type TranslationAlert,
} from "@/lib/translation-alerts"
import { AnalyticsEvent, trackEvent } from "@/lib/analytics"
import { cn } from "@/lib/utils"

/**
 * Источник подписки в аналитике. Раньше здесь было `icon`/`full` — различало
 * кнопку на постере и кнопку в шапке тайтла. Теперь точка подписки одна, и
 * старые значения в дашборде исторически остаются как есть.
 */
const SUBSCRIBE_SOURCE_WATCH = "watch"

export interface TitleSubscribeButtonProps {
  /** ID тайтла (в Weebx совпадает с shikimori_id). */
  animeId: string
  animeTitle?: string | null
  poster?: string | null
  /**
   * Сколько серий человек уже видел. Точка отсчёта подписки: без неё
   * подписка на давно вышедший тайтл мгновенно дала бы ложное «вышла 12».
   */
  baselineEpisode?: number
  className?: string
}

export function TitleSubscribeButton({
  animeId,
  animeTitle,
  poster,
  baselineEpisode,
  className,
}: TitleSubscribeButtonProps) {
  const { user } = useAuth()
  const {
    subscription,
    loaded,
    loading,
    subscribe,
    unsubscribe,
  } = useTitleSubscription(animeId)
  /**
   * Ожидание озвучки — ровно то, что заводит плашка «Уведомить меня» в
   * плеере. Подключаем сюда, чтобы обе кнопки вели в один конвейер
   * (`translation_alerts` → `POST /api/alerts/check`), а не в две разные
   * сущности, из которых одну половину сайта не обрабатывала вовсе.
   */
  const dubAlert = useTranslationAlert(animeId)

  const [showAuthModal, setShowAuthModal] = useState(false)
  const [failed, setFailed] = useState(false)
  /** Авто-подписка после входа выполняется один раз на тайтл. */
  const autoActivatedRef = useRef<string | null>(null)

  const isSubscribed = hasActiveSubscription(subscription)
  const channels = subscriptionSummary(subscription)

  /**
   * Кнопка занята только если мы что-то реально выясняем.
   *
   * Спиннер ставится на `!loaded` лишь для того, у кого есть аккаунт: его
   * подписку надо прочитать. Для гостя ждать нечего — подписок у него нет,
   * и нажатие должно открывать регистрацию. Иначе получается ровно то, на что
   * жаловались: гость видит вечное «Проверяем…», кнопку нажать нельзя, и
   * подписка недостижима вообще.
   */
  const busy = loading || (!loaded && Boolean(user))

  /**
 * Создать ожидание озвучки по Kodik.
 *
 * Какую серию ждать, решает Kodik, а не Shikimori: `episodes_aired` Шики — это
 * эфир в Японии, озвучка отстаёт на недели, и ожидание «3 + 1 = 4» сработало
 * бы слишком поздно. Берём максимум по всем озвучкам и ждём следующую серию
 * (см. `nextDubEpisode`). Уведомление придёт, когда она появится ХОТЬ В ОДНОЙ
 * озвучке — именно это и обещает кнопка.
 *
 * Ошибку не поднимаем: подписка на серии к этому моменту уже записана, и
 * рушить её из-за недоступности Kodik было бы хуже, чем не досоздать озвучку.
 */
  const activateDubExpectation = useCallback(async () => {
    let translations: AlertTranslation[] = []
    try {
      const res = await fetch(
        `/api/player/translations?shikimoriId=${encodeURIComponent(animeId)}` +
          `&title=${encodeURIComponent(animeTitle || "")}`,
        { cache: "no-store" },
      )
      if (res.ok) {
        const data = await res.json().catch(() => null)
        if (Array.isArray(data?.translations)) {
          translations = data.translations as AlertTranslation[]
        }
      }
    } catch (e) {
      console.warn("[TitleSubscribeButton] Kodik недоступен, ждём 1 серию:", e)
    }

    const alert: TranslationAlert = {
      animeId: String(animeId),
      animeTitle: animeTitle || `Аниме #${animeId}`,
      poster: poster ?? null,
      episode: nextDubEpisode(translations),
      // Точка отсчёта для честного перехода «было → стало» в колокольчике.
      // Если озвучек нет вовсе, нули: показывать «0 серий» незачем.
      baselineEpisode: currentDubEpisodes(translations),
      // 'dub-behind', а не 'episode-not-ready': последний означает «ждал
      // серию» и при срабатывании пишет «новая серия». Здесь человек
      // подписался на странице тайтла именно на озвучку, и уведомление
      // должно говорить «озвучка стала доступна» (см. resolveTranslationAlert).
      reason: translations.length === 0 ? "no-translations" : "dub-behind",
    }

    const ok = await dubAlert.subscribe(alert)
    if (!ok) {
      console.warn("[TitleSubscribeButton] ожидание озвучки не создано")
    }
  }, [animeId, animeTitle, poster, dubAlert])

  const doSubscribe = useCallback(async () => {
    setFailed(false)
    const ok = await subscribe({
      animeTitle,
      poster: poster ?? null,
      // `episodesCurrent` у аниме опционален (у анонсов его нет вовсе), а
      // baseline — точка отсчёта и должна быть числом. Отсутствие данных
      // означает «ничего не видел», то есть 0.
      baselineEpisode: baselineEpisode ?? 0,
    })
    if (!ok) {
      setFailed(true)
      return
    }
    trackEvent(AnalyticsEvent.TITLE_SUBSCRIBE, {
      anime_id: animeId,
      anime_title: animeTitle,
      source: SUBSCRIBE_SOURCE_WATCH,
    })

    // Подписка на серии уже записана; ожидание озвучки — тот же конвейер,
    // что у плашки в плеере. Идёт после аналитики и не блокирует кнопку.
    await activateDubExpectation()
  }, [subscribe, animeId, animeTitle, poster, baselineEpisode, activateDubExpectation])

  const handleClick = useCallback(async () => {
    if (!user) {
      // Воронка: регистрация → подписка создастся сразу после входа.
      rememberPendingSubscription({
        animeId,
        animeTitle: animeTitle || `Аниме #${animeId}`,
        poster: poster ?? null,
        notifyNewEpisodes: true,
        notifyDub: true,
        baselineEpisode: baselineEpisode ?? 0,
      })
      setShowAuthModal(true)
      trackEvent(AnalyticsEvent.TITLE_SUBSCRIBE_AUTH_PROMPT, { anime_id: animeId })
      return
    }

    if (isSubscribed) {
      const ok = await unsubscribe()
      if (!ok) {
        setFailed(true)
        return
      }
      // Снимаем и ожидание озвучки: кнопка только что обещала «серии и
      // озвучка», значит её отписка обязана убрать оба обещания.
      // `use-translation-alert` сам разберётся, гасить ли строку
      // `title_subscriptions` — но ту мы уже погасили выше.
      await dubAlert.unsubscribe()
      trackEvent(AnalyticsEvent.TITLE_UNSUBSCRIBE, {
        anime_id: animeId,
        source: SUBSCRIBE_SOURCE_WATCH,
      })
      return
    }

    await doSubscribe()
  }, [user, animeId, animeTitle, poster, baselineEpisode, isSubscribed, unsubscribe, dubAlert, doSubscribe])

  // Человек вошёл (в т.ч. после подтверждения почты или в другой вкладке) —
  // выполняем обещание, которое дали до входа.
  useEffect(() => {
    if (!user || !animeId) return
    if (autoActivatedRef.current === animeId) return
    const pending = readPendingSubscriptions().find((intent) => intent.animeId === animeId)
    if (!pending) return
    autoActivatedRef.current = animeId
    void doSubscribe()
  }, [user, animeId, doSubscribe])

  const ariaLabel = isSubscribed
    ? `Отписаться от «${animeTitle || animeId}»`
    : `Следить за «${animeTitle || animeId}»`

  /**
   * Что именно человек ждёт — в подсказке, а не отдельной строкой под кнопкой.
   *
   * Раньше это была строка «Уведомлю о: серии и озвучка». Кнопка переехала в
   * панель рядом с «В закладки», и строка под ней ломала бы ряд — висел бы
   * текст без кнопки. Подсказка даёт ту же информацию там, где она и нужна:
   * по наведению на саму кнопку.
   */
  const channelHint = isSubscribed && channels ? `Уведомлю о: ${channels}` : null
  const title = channelHint ? `${ariaLabel} · ${channelHint}` : ariaLabel

  return (
    <>
      <div className={cn("flex flex-col gap-1.5", className)}>
        <Button
          type="button"
          variant={isSubscribed ? "outline" : "default"}
          size="sm"
          className={cn(
            "h-9 text-xs font-semibold transition-all",
            isSubscribed
              ? "border-primary/50 text-primary hover:bg-primary/10 dark:text-orange-400"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
          )}
          aria-label={ariaLabel}
          title={title}
          aria-pressed={isSubscribed}
          data-subscribed={isSubscribed ? "true" : "false"}
          disabled={busy}
          onClick={() => void handleClick()}
        >
          {busy ? (
            <span className="flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              <span className="truncate">{loaded ? "Сохраняем..." : "Проверяем..."}</span>
            </span>
          ) : isSubscribed ? (
            <span className="flex items-center gap-2">
              <Check className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">Слежу</span>
              <BellOff className="h-3.5 w-3.5 flex-shrink-0 opacity-60" />
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 flex-shrink-0" />
              <span className="truncate">{user ? "Следить за тайтлом" : "Войти и следить"}</span>
            </span>
          )}
        </Button>

        {failed && (
          <p className="text-[11px] text-destructive">
            Не удалось сохранить подписку. Проверь соединение и нажми ещё раз.
          </p>
        )}
      </div>
      <AuthModal isOpen={showAuthModal} onClose={setShowAuthModal} initialMode="register" />
    </>
  )
}

/**
 * Автоматически подписать гостя, пришедшего по ссылке с `?sub=1`.
 *
 * Сценарий: бот отдал deep-link на страницу тайтла, чтобы человек подтвердил
 * подписку кликом. Без этой обработки он попал бы на обычную страницу и не
 * понял бы, что от него ждут.
 *
 * Молчаливый провал — намеренный: это фоновое действие, и модальное окно с
 * ошибкой поверх страницы тайтла только сбивало бы. Если подписка не
 * сохранилась, кнопка на странице всё равно покажет «Слежу за тайтлом».
 */
export function PendingSubscribeOnMount({
  animeId,
  animeTitle,
  poster,
  baselineEpisode,
}: {
  animeId: string
  animeTitle?: string | null
  poster?: string | null
  baselineEpisode?: number
}) {
  const { user } = useAuth()
  const { subscribe } = useTitleSubscription(animeId)
  const handledRef = useRef<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (params.get(SUBSCRIBE_DEEP_LINK_PARAM) !== "1") return
    if (!user) return
    if (handledRef.current === animeId) return

    handledRef.current = animeId
    rememberPendingSubscription({
      animeId,
      animeTitle: animeTitle || `Аниме #${animeId}`,
      poster: poster ?? null,
      notifyNewEpisodes: true,
      notifyDub: true,
      baselineEpisode: baselineEpisode ?? 0,
    })
    void subscribe({ animeTitle, poster: poster ?? null, baselineEpisode: baselineEpisode ?? 0 })
  }, [user, animeId, animeTitle, poster, baselineEpisode, subscribe])

  return null
}