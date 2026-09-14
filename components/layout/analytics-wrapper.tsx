"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useConsent } from "@/components/providers/consent-provider"
import { useAuth } from "@/components/auth/auth-provider"
import {
  buildGuestProperties, buildUserProperties, getGuestIdentity, identifyUser,
  isAnalyticsEnabled, loadAnalyticsScript, sanitizeAnalyticsUrl,
  trackPageview, unloadAnalyticsScript,
} from "@/lib/analytics"
import { installAnalyticsDomTracking } from "@/lib/analytics-dom"
import { installNativeVideoTracking } from "@/lib/analytics-video"
import { installEngagementTracking } from "@/lib/analytics-engagement"
import { activityRecorder } from "@/components/providers/account-stats-recorder"

export function AnalyticsWrapper() {
  const { consent, hasConsent } = useConsent()
  const { user, sessionLoading, profile } = useAuth()
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const granted = hasConsent && Boolean(consent?.analytics)
  const url = sanitizeAnalyticsUrl(`${pathname}${search ? `?${search}` : ""}`)

  useEffect(() => {
    if (granted) loadAnalyticsScript()
    else unloadAnalyticsScript()
  }, [granted])

  // Identify before this route's pageview.
  // Авторизованный — `supabase:<uuid>` + свойства профиля (повторный identify,
  // когда профиль догрузился: Umami обновляет свойства по ключу).
  // Гость — стабильный `guest:<uuid>` + свойства, чтобы в Umami его можно было
  // отличить, профилировать и фильтровать, а не потерять как анонима.
  useEffect(() => {
    if (!granted || sessionLoading) return
    if (user?.id) {
      identifyUser(`supabase:${user.id}`, buildUserProperties(profile))
    } else {
      const visitor = getGuestIdentity()
      identifyUser(visitor.id, buildGuestProperties(visitor))
    }
  }, [granted, user?.id, sessionLoading, profile])

  useEffect(() => {
    if (sessionLoading) return
    void activityRecorder.recordActivity({
      eventType: "page_view",
      category: "time",
      payload: { path: pathname },
    })
  }, [pathname, url, user?.id, sessionLoading])

  useEffect(() => {
    if (!granted || sessionLoading) return
    trackPageview(url)
  }, [granted, url, sessionLoading])

  useEffect(() => {
    if (!granted || !isAnalyticsEnabled()) return
    return installEngagementTracking(url)
  }, [granted, url])

  useEffect(() => installAnalyticsDomTracking(), [])
  useEffect(() => {
    if (granted) return installNativeVideoTracking()
  }, [granted])
  return null
}

export { trackEvent } from "@/lib/analytics"
