"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"

import { unloadAnalyticsScript } from "@/lib/analytics"

type ConsentPreferences = {
  necessary: boolean
  analytics: boolean
  marketing: boolean
}

type ConsentContextValue = {
  consent: ConsentPreferences | null
  hasConsent: boolean
  saveConsent: (prefs: ConsentPreferences) => void
  revokeConsent: () => void
}

const DEFAULT_CONSENT: ConsentPreferences = {
  necessary: true,
  analytics: false,
  marketing: false,
}

const ConsentContext = createContext<ConsentContextValue>({
  consent: null,
  hasConsent: false,
  saveConsent: () => {},
  revokeConsent: () => {},
})

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentPreferences | null>(null)
  const [hasConsent, setHasConsent] = useState(false)

  useEffect(() => {
    try {
      const stored = localStorage.getItem("cookie-consent-v1")
      if (stored) {
        const parsed = JSON.parse(stored) as ConsentPreferences
        setConsent(parsed)
        setHasConsent(true)
      }
    } catch {
      // ignore
    }
  }, [])

  const saveConsent = useCallback((prefs: ConsentPreferences) => {
    if (!prefs.analytics) unloadAnalyticsScript()
    try {
      localStorage.setItem("cookie-consent-v1", JSON.stringify(prefs))
      localStorage.setItem("cookie-consent-date", new Date().toISOString())
    } catch { /* consent still works when storage is unavailable */ }
    setConsent(prefs)
    setHasConsent(true)
  }, [])

  const revokeConsent = useCallback(() => {
    unloadAnalyticsScript()
    try {
      localStorage.removeItem("cookie-consent-v1")
      localStorage.removeItem("cookie-consent-date")
    } catch { /* no-op */ }
    setConsent(DEFAULT_CONSENT)
    setHasConsent(false)
  }, [])

  return (
    <ConsentContext.Provider value={{ consent, hasConsent, saveConsent, revokeConsent }}>
      {children}
    </ConsentContext.Provider>
  )
}

export function useConsent() {
  return useContext(ConsentContext)
}
