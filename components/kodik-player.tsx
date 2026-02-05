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
  onEpisodeChange?: (episode: number) => void
  onProgressUpdate?: (info: {
    season?: number
    episode: number
    time?: string
    translation?: string
    currentTime?: number
    duration?: number
  }) => void
}

interface KodikMessage {
  type?: string
  data?: {
    episode?: number
    time?: number
    // Другие возможные поля от Kodik плеера
  }
}

export function KodikPlayer({ shikimoriId, title, poster, episode, onStart, onCountryChange, onRegionDetected, onEpisodeChange, onProgressUpdate }: KodikPlayerProps) {
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

  // Обработчик postMessage сообщений от плеера Kodik
  useEffect(() => {
    if (!isStarted) return

    const handleMessage = (event: MessageEvent) => {
      // Проверяем, что сообщение от Kodik плеера
      if (!event.origin.includes('kodik.info') && !event.origin.includes('kodik.cc')) {
        return
      }

      console.log('Kodik message received:', event.data)

      try {
        let newEpisode: number | undefined
        let progressInfo: {
          season?: number
          episode?: number
          time?: string
          translation?: string
          currentTime?: number
          duration?: number
        } = {}
        
        // Kodik использует формат {key: 'kodik_player_current_episode', value: {episode: X, season: Y, ...}}
        if (typeof event.data === 'object' && event.data.key === 'kodik_player_current_episode') {
          if (event.data.value?.episode && typeof event.data.value.episode === 'number') {
            newEpisode = event.data.value.episode
            progressInfo.episode = event.data.value.episode
            progressInfo.season = event.data.value.season
            progressInfo.translation = event.data.value.translation?.title
            progressInfo.currentTime = event.data.value.seconds
            progressInfo.duration = event.data.value.duration
            
            // Форматируем время
            if (event.data.value.time) {
              progressInfo.time = event.data.value.time
            } else if (event.data.value.seconds) {
              const mins = Math.floor(event.data.value.seconds / 60)
              const secs = Math.floor(event.data.value.seconds % 60)
              progressInfo.time = `${mins}:${secs.toString().padStart(2, '0')}`
            }
            
            // Отправляем полные данные о прогрессе
            if (progressInfo.episode) {
              onProgressUpdate?.({
                episode: progressInfo.episode,
                season: progressInfo.season,
                time: progressInfo.time,
                translation: progressInfo.translation,
                currentTime: progressInfo.currentTime,
                duration: progressInfo.duration
              })
            }
          }
        }
        // Другие возможные форматы для совместимости
        else if (typeof event.data === 'object') {
          // Формат { type: 'episode', data: { episode: 2 } }
          if (event.data.type === 'episode' && event.data.data?.episode) {
            newEpisode = event.data.data.episode
          }
          // Формат { episode: 2 }
          else if (event.data.episode && typeof event.data.episode === 'number') {
            newEpisode = event.data.episode
          }
          // Формат { data: { episode: 2 } }
          else if (event.data.data?.episode && typeof event.data.data.episode === 'number') {
            newEpisode = event.data.data.episode
          }
          // Формат с информацией о времени и серии { time: 123, episode: 2 }
          else if (event.data.time && typeof event.data.time === 'number' && 
                   event.data.episode && typeof event.data.episode === 'number') {
            newEpisode = event.data.episode
          }
        }
        // Простой формат - просто число
        else if (typeof event.data === 'number' && event.data > 0) {
          newEpisode = event.data
        }
        // Строковый формат
        else if (typeof event.data === 'string') {
          const match = event.data.match(/episode[:\s]+(\d+)/i)
          if (match && match[1]) {
            newEpisode = parseInt(match[1], 10)
          }
        }
        
        // Если нашли новую серию и она отличается от текущей
        if (newEpisode && newEpisode !== episode && newEpisode > 0) {
          console.log('Kodik: Episode changed to', newEpisode)
          onEpisodeChange?.(newEpisode)
        }
      } catch (error) {
        console.warn('Error parsing Kodik message:', error)
      }
    }

    window.addEventListener('message', handleMessage)
    
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [isStarted, episode, onEpisodeChange])

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