"use client"

import { useConsent } from "@/components/providers/consent-provider"
import { Analytics } from "@vercel/analytics/next"

export function AnalyticsWrapper() {
  const { consent } = useConsent()

  if (!consent?.analytics) return null

  return <Analytics />
}
