"use client"

import { useState, useEffect, useMemo } from "react"
import { PlayerLoading } from "@/components/player-loading"
import { AlertCircle } from "lucide-react"
import { RegionDetector } from "@/components/region-detector"

interface KodikPlayerProps {
  shikimoriId: string
  title: string
  poster: string
  episode: number
  onStart?: () => void
  onCountryChange?: (country: string) => void
  onRegionDetected?: (isRussia: boolean) => void
}

export function KodikPlayer({ shikimoriId, title, poster, episode, onStart, onCountryChange, onRegionDetected }: KodikPlayerProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [isStarted, setIsStarted] = useState(false)
  const [hasError, setHasError] = useState(false)
  const [selectedCountry, setSelectedCountry] = useState<string>('RU') // По умолчанию Россия

  const playerSrc = useMemo(() => {
    const params = new URLSearchParams({
      shikimoriID: shikimoriId,
      episode: String(episode),
      types: 'anime,anime-serial',
      no_ads: 'true', 
      block_blocked_countries: 'false', // Отключаем блокировку стран
      hide_selectors: 'false',
      autoplay: '0',
      domain: 'kodik.info'
    })
    
    // Добавляем параметр страны если выбрана не Россия
    if (selectedCountry && selectedCountry !== 'RU') {
      params.append('country', selectedCountry)
    }
    
    return `//kodik.info/find-player?${params.toString()}`
  }, [shikimoriId, episode, selectedCountry])

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode)
    onCountryChange?.(countryCode)
  }

  useEffect(() => {
    setIsLoading(true)
    setHasError(false)
  }, [episode])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-950 border border-white/5 shadow-2xl">
      {!isStarted ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Детектор региона в углу */}
          <div className="  z-20">
            <RegionDetector onCountryChange={handleCountryChange} onRegionDetected={onRegionDetected} />
          </div>
          
          <div className="flex-1 flex items-center justify-center group cursor-pointer" 
               onClick={() => {
                 onStart?.()
                 setIsStarted(true)
               }}
          >
            {/* Фон-постер */}
            <img 
              src={poster} 
              className="absolute inset-0 w-full h-full object-cover opacity-30 blur-sm transition-opacity group-hover:opacity-40" 
              alt="" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
            
            {/* Кнопка Play */}
            <button
              className="relative z-10 flex items-center gap-3 px-6 py-3 sm:px-8 sm:py-4 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl font-bold transition-all transform group-hover:scale-105 shadow-[0_0_30px_rgba(234,88,12,0.4)]"
            >
              <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
                 <path d="M8 5v14l11-7z" />
              </svg>
              <span className="text-sm sm:text-base">Смотреть {episode} серию</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {isLoading && !hasError && <PlayerLoading />}
          
          {hasError ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 gap-2 bg-zinc-900">
                <AlertCircle className="w-8 h-8 text-red-500" />
                <p>Плеер недоступен или заблокирован AdBlock</p>
                <button 
                  onClick={() => setIsStarted(false)}
                  className="text-xs text-orange-500 hover:underline"
                >
                  Попробовать снова
                </button>
             </div>
          ) : (
            <iframe
              src={playerSrc}
              className={`h-full w-full transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              allowFullScreen
              // ВАЖНО: Убраны 'allow-popups' и 'allow-top-navigation'.
              // Это запрещает плееру открывать новые вкладки с рекламой.
              sandbox="allow-forms allow-scripts allow-same-origin allow-presentation"
              loading="lazy"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false)
                setHasError(true)
              }}
            />
          )}
        </>
      )}
    </div>
  )
}