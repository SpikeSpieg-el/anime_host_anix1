"use client"

import { useState, useEffect } from "react"
import { Globe, Shield, CheckCircle, AlertTriangle, X } from "lucide-react"

interface RegionDetectorProps {
  onCountryChange?: (country: string) => void
  onRegionDetected?: (isRussia: boolean) => void
}

export function RegionDetector({ onCountryChange, onRegionDetected }: RegionDetectorProps) {
  const [detectedCountry, setDetectedCountry] = useState<string | null>(null)
  const [isRussia, setIsRussia] = useState<boolean | null>(null)
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [isChecking, setIsChecking] = useState(true)
  const [suggestionAccepted, setSuggestionAccepted] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)

  useEffect(() => {
    detectRegion()
  }, [])

  const detectRegion = async () => {
    try {
      // Создаем таймаут вручную для совместимости
      const createTimeoutController = (timeoutMs: number) => {
        if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
          return { signal: AbortSignal.timeout(timeoutMs) }
        } else {
          const controller = new AbortController()
          setTimeout(() => controller.abort(), timeoutMs)
          return { signal: controller.signal }
        }
      }

      // Делаем запрос на свой API (server-side proxy), чтобы избежать CORS
      const { signal } = createTimeoutController(5000)
      const response = await fetch('/api/region', { signal, cache: 'no-store' })
      if (!response.ok) {
        throw new Error('Region API failed')
      }

      const data = await response.json()
      if (!data) {
        throw new Error('Region API returned empty payload')
      }
      
      const country = data.country_name || data.country || 'Unknown'
      const countryCode = data.country_code || data.country || ''
      
      setDetectedCountry(country)
      
      // Проверяем, Россия ли это
      const russiaDetected = countryCode === 'RU' || 
                            country.toLowerCase().includes('russia') || 
                            country.toLowerCase().includes('россия')
      
      setIsRussia(russiaDetected)
      
      // Уведомляем о завершении детекции региона
      if (onRegionDetected) {
        onRegionDetected(russiaDetected)
      }
      
      // Если Россия, показываем предложение без автоматического применения
      if (russiaDetected) {
        setShowSuggestion(true)
        // Не применяем автоматически - ждем действия пользователя
      } else {
        // Если не Россия, сразу сообщаем родительскому компоненту
        if (onCountryChange) {
          onCountryChange(countryCode)
        }
      }
      
    } catch (error) {
      console.error('Error detecting region:', error)
      // В случае ошибки, предполагаем что не Россия и используем заглушку
      setIsRussia(false)
      setDetectedCountry('Unknown')
      if (onRegionDetected) {
        onRegionDetected(false)
      }
      if (onCountryChange) {
        onCountryChange('US') // По умолчанию США
      }
    } finally {
      setIsChecking(false)
    }
  }

  const handleCountrySuggestion = (useDifferentCountry: boolean) => {
    if (useDifferentCountry) {
      // Предлагаем выбрать другую страну (например, Казахстан)
      if (onCountryChange) {
        onCountryChange('KZ') // Казахстан
      }
      setIsRussia(false)
      setSuggestionAccepted(true)
    } else {
      // Остаемся с Россией
      if (onCountryChange) {
        onCountryChange('RU')
      }
      setSuggestionAccepted(true)
    }
    setShowSuggestion(false)
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    setShowSuggestion(false)
  }

  if (isChecking) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground text-xs bg-card/60 backdrop-blur-md px-2 py-1.5 rounded-md border border-border/30">
        <Globe className="w-3 h-3 animate-pulse" />
        <span className="opacity-75">Проверка...</span>
      </div>
    )
  }

  if (detectedCountry === 'Unknown') {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs bg-card/60 backdrop-blur-md px-2 py-1.5 rounded-md border border-border/30">
        <Globe className="w-3 h-3" />
        <span className="opacity-75">Регион не определен</span>
      </div>
    )
  }

  // Показываем текущий статус (минималистичный)
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground text-xs bg-card/60 backdrop-blur-md px-2 py-1.5 rounded-md border border-border/30">
      <Globe className="w-3 h-3" />
      <span className="opacity-75">
        {detectedCountry?.slice(0, 10) || 'Unknown'}
      </span>
      {isRussia === false && (
        <CheckCircle className="w-2.5 h-2.5 text-green-500" />
      )}
      {suggestionAccepted && isRussia === false && (
        <span className="text-xs text-green-500 opacity-75">✓</span>
      )}
    </div>
  )
}
