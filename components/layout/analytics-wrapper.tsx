"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { useConsent } from "@/components/providers/consent-provider"
import { useAuth } from "@/components/auth/auth-provider"
import {
  identifyUser, isAnalyticsEnabled, loadAnalyticsScript, sanitizeAnalyticsUrl,
  trackPageview, unloadAnalyticsScript,
} from "@/lib/analytics"
import { installAnalyticsDomTracking } from "@/lib/analytics-dom"
import { installNativeVideoTracking } from "@/lib/analytics-video"
import { installEngagementTracking } from "@/lib/analytics-engagement"

export function AnalyticsWrapper() {
  const { consent, hasConsent } = useConsent()
  const { user, sessionLoading } = useAuth()
  const pathname = usePathname()
  const search = useSearchParams().toString()
  const granted = hasConsent && Boolean(consent?.analytics)
  const url = sanitizeAnalyticsUrl(`${pathname}${search ? `?${search}` : ""}`)

  useEffect(() => {
    if (granted) loadAnalyticsScript()
    else unloadAnalyticsScript()
  }, [granted])

  // Identify before this route's pageview. Clear identity on logout/account switch.
  useEffect(() => {
    if (granted && !sessionLoading) identifyUser(user?.id ? `supabase:${user.id}` : "")
  }, [granted, user?.id, sessionLoading])

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
