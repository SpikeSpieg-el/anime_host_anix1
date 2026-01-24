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

      // Пробуем несколько сервисов для определения региона
      let response: Response | null = null
      let data: any = null
      

 
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

      
      // Сервис 1: ipapi.co
      try {
        const { signal } = createTimeoutController(5000)
        response = await fetch('https://ipapi.co/json/', { signal })
        if (response.ok) {
          data = await response.json()
        }
      } catch (error) {
        console.warn('ipapi.co failed:', error)
      }
      
      // Сервис 2: ip-api.com (backup)
      if (!data) {
        try {
          const { signal } = createTimeoutController(5000)
          response = await fetch('http://ip-api.com/json/', { signal })
          if (response.ok) {
            const apiData = await response.json()
            data = {
              country_name: apiData.country,
              country_code: apiData.countryCode
            }
          }
        } catch (error) {
          console.warn('ip-api.com failed:', error)
        }
      }
      
      // Сервис 3: ipgeolocation.io (backup)
      if (!data) {
        try {
          const { signal } = createTimeoutController(5000)
          response = await fetch('https://api.ipgeolocation.io/ipgeo', { signal })
          if (response.ok) {
            const geoData = await response.json()
            data = {
              country_name: geoData.country_name,
              country_code: geoData.country_code2
            }
          }
        } catch (error) {
          console.warn('ipgeolocation.io failed:', error)
        }
      }
      
      // Если все сервисы не сработали, используем заглушку
      if (!data) {
        // Делаем запрос на свой API (server-side proxy), чтобы избежать CORS
        const { signal } = createTimeoutController(5000)
        const apiResponse = await fetch('/api/region', { signal, cache: 'no-store' })
        if (!apiResponse.ok) {
          throw new Error('Region API failed')
        }

        data = await apiResponse.json()
        if (!data) {
          throw new Error('Region API returned empty payload')
        }
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
      <div className="flex items-center gap-2 text-zinc-600 text-xs bg-zinc-900/60 backdrop-blur-md px-2 py-1.5 rounded-md border border-zinc-800/30">
        <Globe className="w-3 h-3 animate-pulse" />
        <span className="opacity-75">Проверка...</span>
      </div>
    )
  }

  if (detectedCountry === 'Unknown') {
    return (
      <div className="flex items-center gap-1.5 text-zinc-500 text-xs bg-zinc-900/60 backdrop-blur-md px-2 py-1.5 rounded-md border border-zinc-800/30">
        <Globe className="w-3 h-3" />
        <span className="opacity-75">Регион не определен</span>
      </div>
    )
  }

  // Показываем текущий статус (минималистичный)
  return (
    <div className="flex items-center gap-1.5 text-zinc-600 text-xs bg-zinc-900/60 backdrop-blur-md px-2 py-1.5 rounded-md border border-zinc-800/30">
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
