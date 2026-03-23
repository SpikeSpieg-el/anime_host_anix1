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
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [currentDomain, setCurrentDomain] = useState<number>(0) // Индекс текущего домена

  // Таймаут для загрузки плеера
  const [loadTimeout, setLoadTimeout] = useState<NodeJS.Timeout | null>(null)

  // Альтернативные домены Kodik (kodikplayer.com приоритетный для работы с Redirector)
  const kodikDomains = [
    'kodikplayer.com',   // Приоритетный домен для Redirector расширения
    'kodik.info'        // Основной домен (будет перенаправлен)
  ]

  const playerSrc = useMemo(() => {
    const domain = kodikDomains[currentDomain]
    const params = new URLSearchParams({
      shikimoriID: shikimoriId,
      episode: String(episode),
      types: 'anime,anime-serial',
      no_ads: 'true', 
      block_blocked_countries: 'false', // Отключаем блокировку стран
      hide_selectors: 'false',
      autoplay: '0'
    })
    
    // Добавляем параметр страны если выбрана не Россия
    if (selectedCountry && selectedCountry !== 'RU') {
      params.append('country', selectedCountry)
    }
    
    // Для kodikplayer.com используем прямой URL без параметра domain
    // Для остальных доменов добавляем domain параметр
    let url: string
    if (domain === 'kodikplayer.com') {
      url = `https://${domain}/find-player?${params.toString()}`
    } else {
      params.append('domain', domain)
      url = `https://${domain}/find-player?${params.toString()}`
    }
    
    console.log(`Kodik player URL (domain ${currentDomain + 1}/${kodikDomains.length}):`, url)
    return url
  }, [shikimoriId, episode, selectedCountry, currentDomain])

  const handleCountryChange = (countryCode: string) => {
    setSelectedCountry(countryCode)
    onCountryChange?.(countryCode)
  }

  const tryNextDomain = () => {
    const nextDomain = (currentDomain + 1) % kodikDomains.length
    
    // Если мы перепробовали все домены и вернулись к первому
    if (nextDomain === 0) {
      console.log('❌ All Kodik domains failed after trying:', kodikDomains.join(', '))
      setIsLoading(false)
      setHasError(true)
      setErrorMessage(`Все ${kodikDomains.length} доменов Kodik недоступны. Попробуйте позже или используйте резервный плеер.`)
    } else {
      console.log(`🔄 Switching from ${kodikDomains[currentDomain]} to ${kodikDomains[nextDomain]} (${nextDomain + 1}/${kodikDomains.length})`)
      setCurrentDomain(nextDomain)
      setIsLoading(true)
      setHasError(false)
      setErrorMessage('')
      // Перезапускаем таймаут для нового домена
      setTimeout(() => {
        if (loadTimeout) {
          clearTimeout(loadTimeout)
        }
        const timeout = setTimeout(() => {
          if (isLoading) {
            console.log(`⏱️ Timeout on ${kodikDomains[nextDomain]}, trying next domain automatically`)
            tryNextDomain()
          }
        }, 8000)
        setLoadTimeout(timeout)
      }, 100)
    }
  }

  const handleStartPlayer = () => {
    onStart?.()
    setIsStarted(true)
    setIsLoading(true)
    setHasError(false)
    setErrorMessage('')
    setCurrentDomain(0) // Всегда начинаем с .com домена
    
    // Очищаем предыдущий таймаут
    if (loadTimeout) {
      clearTimeout(loadTimeout)
    }
    
    // Устанавливаем таймаут на 8 секунд для проверки
    const timeout = setTimeout(() => {
      if (isLoading) {
        console.log(`⏱️ Timeout on ${kodikDomains[currentDomain]}, trying next domain automatically`)
        tryNextDomain()
      }
    }, 8000)
    
    setLoadTimeout(timeout)
  }

  useEffect(() => {
    // Очищаем таймаут при изменении домена
    if (loadTimeout) {
      clearTimeout(loadTimeout)
    }
  }, [currentDomain])

  // Мониторинг состояния плеера для обнаружения разрыва соединения
  useEffect(() => {
    if (!isStarted || hasError) return

    let checkCount = 0
    const maxChecks = 5 // Проверяем 5 раз с интервалом 3 секунды
    
    const checkInterval = setInterval(() => {
      checkCount++
      
      // Если iframe все еще загружается после долгого времени, возможно проблема
      if (isLoading && checkCount >= maxChecks) {
        console.log(`🔍 Player still loading after ${checkCount * 3}s on ${kodikDomains[currentDomain]}, trying next domain`)
        clearInterval(checkInterval)
        tryNextDomain()
        return
      }
      
      // Если достигли лимита проверок и плеер работает, останавливаем мониторинг
      if (checkCount >= maxChecks) {
        clearInterval(checkInterval)
        console.log(`✅ Player monitoring completed for ${kodikDomains[currentDomain]}`)
      }
    }, 3000) // Каждые 3 секунды

    return () => {
      clearInterval(checkInterval)
    }
  }, [isStarted, isLoading, hasError, currentDomain])

  // Глобальный обработчик сообщений об ошибках Kodik
  useEffect(() => {
    const handleKodikError = (event: any) => {
      // Проверяем, это сообщение об ошибке Kodik
      if (typeof event.data === 'string' && 
          (event.data.includes('kodik') || 
           event.data.includes('разорвал соединение') || 
           event.data.includes('не отправил данные'))) {
        
        console.log(`🚨 Kodik error detected: ${event.data}`)
        
        // Если плеер запущен и есть ошибка, пробуем следующий домен
        if (isStarted && !hasError) {
          console.log(`❌ Kodik error on ${kodikDomains[currentDomain]}, switching domain`)
          tryNextDomain()
        }
      }
    }

    // Слушаем сообщения от window (для ошибок от UI)
    window.addEventListener('message', handleKodikError)
    
    return () => {
      window.removeEventListener('message', handleKodikError)
    }
  }, [isStarted, hasError, currentDomain])

  // Обработчик postMessage сообщений от плеера Kodik
  useEffect(() => {
    if (!isStarted) return

    const handleMessage = (event: MessageEvent) => {
      // Проверяем, что сообщение от Kodik плеера
      const validOrigins = kodikDomains.map(domain => `https://${domain}`)
      if (!validOrigins.includes(event.origin)) {
        return
      }

      console.log('Kodik message received:', event.data)

      // Проверяем на сообщение об ошибке или разрыве соединения
      if (typeof event.data === 'string') {
        if (event.data.includes('разорвал соединение') || 
            event.data.includes('не отправил данные') ||
            event.data.includes('connection lost') ||
            event.data.includes('error')) {
          console.log(`❌ Connection lost on ${kodikDomains[currentDomain]}, trying next domain`)
          tryNextDomain()
          return
        }
      }

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
  }, [isStarted, episode, onEpisodeChange, currentDomain])

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-zinc-950 border border-white/5 shadow-2xl">
      {!isStarted ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {/* Детектор региона в углу */}
          <div className="z-20">
            <RegionDetector onCountryChange={handleCountryChange} onRegionDetected={onRegionDetected} />
          </div>
          
          <div className="flex-1 flex items-center justify-center group cursor-pointer" 
               onClick={handleStartPlayer}
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
          {isLoading && !hasError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <PlayerLoading />
              <div className="absolute top-4 right-4 bg-zinc-800/80 text-zinc-300 text-xs px-2 py-1 rounded">
                Проверка домена {currentDomain + 1}/{kodikDomains.length}: {kodikDomains[currentDomain]}
              </div>
              {currentDomain === 0 && kodikDomains[currentDomain] === 'kodikplayer.com' && (
                <div className="absolute top-4 left-4 bg-green-600/80 text-white text-xs px-2 py-1 rounded">
                  ✅ Приоритетный домен
                </div>
              )}
              {currentDomain > 0 && (
                <div className="absolute top-4 left-4 bg-orange-600/80 text-white text-xs px-2 py-1 rounded">
                  Переключение на зеркало...
                </div>
              )}
              {currentDomain === 1 && kodikDomains[currentDomain] === 'kodik.info' && (
                <div className="absolute bottom-4 left-4 bg-blue-600/80 text-white text-xs px-3 py-2 rounded max-w-xs">
                  💡 Установите Redirector для автоматического перенаправления с kodik.info
                </div>
              )}
            </div>
          )}
          
          {hasError ? (
             <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-400 gap-4 bg-zinc-900 p-6">
                <AlertCircle className="w-12 h-12 text-red-500" />
                <div className="text-center">
                  <p className="text-lg font-medium text-white mb-2">Все домены Kodik недоступны</p>
                  <p className="text-sm text-zinc-400 mb-4">
                    {errorMessage || 'Проверьте подключение к интернету или отключите AdBlock'}
                  </p>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => {
                        setIsStarted(false)
                        setHasError(false)
                        setErrorMessage('')
                        setCurrentDomain(0) // Сбрасываем на первый домен
                        setIsLoading(true) // Готовимся к новой проверке
                      }}
                      className="text-orange-500 hover:underline text-sm"
                    >
                      Попробовать снова
                    </button>
                    <div className="text-xs text-zinc-500 bg-zinc-800 p-3 rounded">
                      <p className="font-medium text-zinc-400 mb-1">💡 Решение для ПК:</p>
                      <p>Установите расширение Redirector с настройками:</p>
                      <p className="font-mono text-xs mt-1">
                        kodik.info/* → kodikplayer.com/$1
                      </p>
                    </div>
                  </div>
                </div>
             </div>
          ) : (
            <iframe
              src={playerSrc}
              className={`h-full w-full transition-opacity duration-700 ${isLoading ? 'opacity-0' : 'opacity-100'}`}
              allowFullScreen
              // ВАЖНО: Оптимизированные разрешения для работы Kodik плеера
              // allow-popups-to-escape-sandbox позволяет открывать окна при необходимости
              // allow-top-navigation позволяет навигацию для некоторых функций плеера
              sandbox="allow-forms allow-scripts allow-same-origin allow-presentation allow-popups-to-escape-sandbox allow-top-navigation"
              loading="lazy"
              onLoad={() => {
                console.log(`✅ Kodik player loaded successfully on ${kodikDomains[currentDomain]}`)
                setIsLoading(false)
                // Очищаем таймаут при успешной загрузке
                if (loadTimeout) {
                  clearTimeout(loadTimeout)
                  setLoadTimeout(null)
                }
              }}
              onError={(e) => {
                console.error(`❌ iframe error on ${kodikDomains[currentDomain]}:`, e)
                // Автоматически пробуем следующий домен при ошибке загрузки
                console.log(`🔄 Auto-switching to next domain due to iframe error`)
                tryNextDomain()
              }}
            />
          )}
        </>
      )}
    </div>
  )
}
