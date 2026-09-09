"use client"

/**
 * Umami analytics (self-hosted в Coolify, https://analytics.weeb-x.com).
 *
 * Заменил прежнюю интеграцию PostHog. В отличие от PostHog, Umami не требует
 * SDK в бандле: в `<head>` вставляется один лёгкий `script.js`, который сам
 * собирает pageview (включая SPA-навигацию через history API), Web Vitals и
 * кастомные события.
 *
 * Всё по-прежнему gated согласием на cookies: пока пользователь не принял
 * «Аналитику», скрипт не загружается и данные в браузер не уходят. Отзыв
 * согласия убирает трекер из DOM.
 *
 * Что трекается автоматически (без правок в компонентах):
 *   - pageview на каждой смене маршрута — делает сам трекер Umami;
 *   - клики по ссылкам, кнопкам, табам, пунктам меню (делегированный слушатель
 *     ниже) — событие `click` с описанием элемента;
 *   - отправка форм — событие `form_submit`;
 *   - вовлечённость страницы — событие `engagement` (время + глубина скролла);
 *   - все события внутреннего `activityRecorder` (gacha_roll, battle_started,
 *     watch_start, search_query, bookmark_add ...) — см. `account-stats-recorder.ts`.
 *
 * Точечные события в компонентах (см. `AnalyticsEvent` в `lib/analytics.ts`):
 * auth (sign_in/sign_up/sign_out/password_reset), episode_play/episode_change,
 * manga_chapter_open, gacha_card_revealed/gacha_dismantle/gacha_bulk_dismantle,
 * market_buy/market_list/market_cancel, inbox_claim, battle_end/pvp_end,
 * gift_card_redeem, referral_copy, lampa_activate, history_clear/history_remove.
 *
 * Отключить автотрек конкретного элемента можно атрибутом `data-track="off"`,
 * а задать своё имя/данные — атрибутами Umami:
 *   <button data-umami-event="gacha_pack_open" data-umami-event-pack="2024">
 *
 * Переменные окружения (Coolify):
 *   NEXT_PUBLIC_UMAMI_WEBSITE_ID — обязательно, без него аналитика выключена
 *   NEXT_PUBLIC_UMAMI_URL        — опционально (по умолчанию https://analytics.weeb-x.com)
 */
import { useCallback, useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import { useConsent } from "@/components/providers/consent-provider"
import { useAuth } from "@/components/auth/auth-provider"
import {
  AnalyticsEvent,
  isAnalyticsActive,
  isAnalyticsConfigured,
  identifyUser,
  loadAnalyticsScript,
  trackEvent,
  unloadAnalyticsScript,
  type UmamiEventData,
} from "@/lib/analytics"

/** Кликабельные элементы, которые ловит автотрек. */
const TRACKABLE_SELECTOR = [
  "a[href]",
  "button",
  'input[type="submit"]',
  'input[type="button"]',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="menuitemcheckbox"]',
  '[role="menuitemradio"]',
  '[role="tab"]',
  '[role="option"]',
  "[data-track]",
  "summary",
].join(", ")

/** Максимальная длина подписи элемента в payload события. */
const MAX_LABEL_LENGTH = 60

/** Не отправляем повторный клик по тому же элементу чаще, чем раз в N мс. */
const CLICK_DEDUPE_MS = 400

/** Минимальная длительность визита, которую имеет смысл слать в `engagement`. */
const MIN_ENGAGEMENT_SECONDS = 5

function cleanText(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_LABEL_LENGTH)
}

function elementKind(el: Element): string {
  const tag = el.tagName.toLowerCase()
  if (tag === "a") return "link"
  if (tag === "input" || tag === "textarea" || tag === "select") return "input"
  if (tag === "summary") return "summary"
  return tag
}

function describeElement(el: Element): string {
  const manual = el.getAttribute("data-track")
  if (manual && manual !== "off") return cleanText(manual)

  const aria = cleanText(el.getAttribute("aria-label"))
  if (aria) return aria

  const title = cleanText(el.getAttribute("title"))
  if (title) return title

  const alt = cleanText(el.getAttribute("alt"))
  if (alt) return alt

  const placeholder = cleanText(el.getAttribute("placeholder"))
  if (placeholder) return placeholder

  const value = cleanText((el as HTMLInputElement).value)
  if (value) return value

  return cleanText(el.textContent)
}

/** У внутренних ссылок оставляем только путь — без домена и без якоря. */
function hrefToPath(href: string): string {
  try {
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin) return url.href
    return url.pathname + url.search
  } catch {
    return href
  }
}

export function AnalyticsWrapper() {
  const { consent, hasConsent } = useConsent()
  const { user } = useAuth()
  const pathname = usePathname()

  const analyticsGranted = Boolean(consent?.analytics)

  /* 1. Загружаем / выгружаем трекер по согласию пользователя. */
  useEffect(() => {
    if (!isAnalyticsConfigured()) return

    // Пока согласия нет (баннер не закрыт) или аналитика отклонена —
    // трекер убираем ВМЕСТЕ с очередью: события, случившиеся до согласия,
    // не должны «догонять» пользователя после нажатия «Принять».
    if (!hasConsent || !analyticsGranted) {
      unloadAnalyticsScript()
      return
    }

    loadAnalyticsScript()
  }, [analyticsGranted, hasConsent])

  /* 2. Вовлечённость: время на странице + глубина скролла. */
  const engagementRef = useRef({
    path: pathname,
    startedAt: Date.now(),
    maxScroll: 0,
    flushed: false,
  })

  const updateMaxScroll = useCallback(() => {
    if (typeof document === "undefined") return
    const doc = document.documentElement
    const scrollable = doc.scrollHeight - window.innerHeight
    const percent =
      scrollable > 0
        ? Math.min(100, Math.round((window.scrollY / scrollable) * 100))
        : 100
    const state = engagementRef.current
    if (percent > state.maxScroll) state.maxScroll = percent
  }, [])

  const sendEngagement = useCallback(() => {
    const state = engagementRef.current
    if (state.flushed) return

    const seconds = Math.round((Date.now() - state.startedAt) / 1000)
    if (seconds < MIN_ENGAGEMENT_SECONDS) return

    state.flushed = true
    trackEvent(AnalyticsEvent.ENGAGEMENT, {
      path: state.path,
      seconds,
      max_scroll_pct: state.maxScroll,
    })
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return

    const onScroll = () => updateMaxScroll()
    const onHide = () => {
      if (document.visibilityState === "hidden") sendEngagement()
    }
    const onVisible = () => {
      if (document.visibilityState === "visible") engagementRef.current.flushed = false
    }
    const onPageHide = () => sendEngagement()

    window.addEventListener("scroll", onScroll, { passive: true })
    window.addEventListener("resize", onScroll, { passive: true })
    window.addEventListener("pagehide", onPageHide)
    document.addEventListener("visibilitychange", onHide)
    document.addEventListener("visibilitychange", onVisible)

    return () => {
      window.removeEventListener("scroll", onScroll)
      window.removeEventListener("resize", onScroll)
      window.removeEventListener("pagehide", onPageHide)
      document.removeEventListener("visibilitychange", onHide)
      document.removeEventListener("visibilitychange", onVisible)
    }
  }, [sendEngagement, updateMaxScroll])

  // Смена маршрута в App Router: фиксируем вовлечённость прошлого экрана.
  useEffect(() => {
    const state = engagementRef.current
    if (state.path === pathname) return

    sendEngagement()
    engagementRef.current = {
      path: pathname,
      startedAt: Date.now(),
      maxScroll: 0,
      flushed: false,
    }
  }, [pathname, sendEngagement])

  /* 3. Автотрек кликов и отправки форм (делегирование на document). */
  useEffect(() => {
    if (typeof document === "undefined") return

    let lastSignature = ""
    let lastSignatureAt = 0

    const onClick = (event: MouseEvent) => {
      if (!isAnalyticsActive()) return

      const target = event.target as Element | null
      if (!target || typeof target.closest !== "function") return

      // Элементы с data-umami-event трекер Umami обрабатывает сам.
      if (target.closest("[data-umami-event]")) return
      if (target.closest('[data-track="off"]')) return

      const el = target.closest(TRACKABLE_SELECTOR)
      if (!el) return

      const label = describeElement(el)
      const kind = elementKind(el)
      const path =
        el.tagName === "A" && (el as HTMLAnchorElement).href
          ? hrefToPath((el as HTMLAnchorElement).href)
          : undefined

      const signature = `${kind}|${label}|${path ?? ""}`
      const now = Date.now()
      if (signature === lastSignature && now - lastSignatureAt < CLICK_DEDUPE_MS) return
      lastSignature = signature
      lastSignatureAt = now

      const data: UmamiEventData = {
        element: kind,
        label,
        path: window.location.pathname,
      }
      if (path) data.href = path
      const id = el.getAttribute("id")
      if (id) data.id = id
      const name = el.getAttribute("name")
      if (name) data.name = name

      trackEvent(AnalyticsEvent.CLICK, data)
    }

    const onSubmit = (event: Event) => {
      if (!isAnalyticsActive()) return
      const form = event.target as HTMLFormElement | null
      if (!form || form.tagName !== "FORM") return
      if (form.getAttribute("data-track") === "off") return

      const data: UmamiEventData = { path: window.location.pathname }
      const id = form.getAttribute("id")
      if (id) data.id = id
      const name = form.getAttribute("name")
      if (name) data.name = name
      const action = form.getAttribute("action")
      if (action) data.action = action

      trackEvent(AnalyticsEvent.FORM_SUBMIT, data)
    }

    document.addEventListener("click", onClick, { capture: true, passive: true })
    document.addEventListener("submit", onSubmit, { capture: true, passive: true })

    return () => {
      document.removeEventListener("click", onClick, { capture: true })
      document.removeEventListener("submit", onSubmit, { capture: true })
    }
  }, [])

  /* 4. Привязываем залогиненного пользователя к внутреннему UUID.
        Никаких PII: только id из Supabase. */
  useEffect(() => {
    if (!analyticsGranted || !user?.id) return
    identifyUser(`supabase:${user.id}`)
  }, [analyticsGranted, user?.id])

  return null
}

export { trackEvent } from "@/lib/analytics"
