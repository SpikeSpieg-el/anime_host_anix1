"use client"

import { useState, useEffect } from 'react'

export function useTVMode() {
  const [isTVMode, setIsTVMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const checkTVMode = () => {
      if (typeof window === 'undefined') return false

      const userAgent = navigator.userAgent.toLowerCase()
      const isAndroidTV = 
        userAgent.includes('android') && 
        (userAgent.includes('tv') || 
         userAgent.includes('googletv') ||
         userAgent.includes('aftm') || 
         userAgent.includes('aftb'))

      const isHeadless = userAgent.includes('headless') || userAgent.includes('lighthouse')
      const isLargeScreen = window.innerWidth >= 1280 && window.innerHeight >= 720

      const storedPreference = localStorage.getItem('tv-mode-enabled')
      
      if (storedPreference !== null) {
        return storedPreference === 'true'
      }

      if (isHeadless) return false

      return isAndroidTV || (isLargeScreen && window.matchMedia('(hover: none)').matches && window.matchMedia('(pointer: coarse)').matches)
    }

    setIsTVMode(checkTVMode())
    setIsLoading(false)
  }, [])

  const toggleTVMode = (enabled: boolean) => {
    setIsTVMode(enabled)
    localStorage.setItem('tv-mode-enabled', enabled.toString())
  }

  return { isTVMode, isLoading, toggleTVMode }
}
