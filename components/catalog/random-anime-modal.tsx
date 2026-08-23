'use client'

import { useEffect, useState } from 'react'
import { AnimeCard } from '@/components/shared/anime-card'
import { Button } from '@/components/ui/button'
import { X, Sparkles } from 'lucide-react'
import type { Anime } from '@/lib/shikimori'
import { useRouter } from 'next/navigation'

interface RandomAnimeModalProps {
  anime: Anime | null
  onClose: () => void
}

export function RandomAnimeModal({ anime, onClose }: RandomAnimeModalProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  // Закрытие по Escape и блокировка фонового скролла
  useEffect(() => {
    if (!anime) return

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    const originalOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.body.style.overflow = originalOverflow
      document.removeEventListener('keydown', handleEscape)
    }
  }, [anime, onClose])

  const handleNavigate = async () => {
    if (anime) {
      setIsLoading(true)
      await Promise.resolve(router.push(`/watch/${anime.id}`, { scroll: false }))
        .finally(() => {
          setIsLoading(false)
          onClose()
        })
    }
  }

  if (!anime) return null

  return (
    /* Оверлей начинается сразу под хедером (top-16 на моб, md:top-20 на десктопе) */
    <div
      onClick={onClose}
      className="fixed inset-x-0 bottom-0 top-16 md:top-20 z-40 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      aria-modal="true"
      role="dialog"
    >
      {/* Загрузчик */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-white text-sm font-medium">Переход...</span>
          </div>
        </div>
      )}

      <div
        onClick={(e) => e.stopPropagation()}
        className={`relative flex flex-col w-full max-w-xs sm:max-w-md md:max-w-lg max-h-[calc(100dvh-4rem-1.5rem)] md:max-h-[calc(100dvh-5rem-2rem)] bg-background border border-border dark:bg-zinc-900 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 ${isLoading ? 'pointer-events-none' : ''}`}
      >
        {/* Шапка */}
        <div className="flex items-center justify-between px-3.5 py-2.5 sm:px-5 sm:py-3.5 border-b border-border dark:border-zinc-800 shrink-0">
          <h2 className="text-sm sm:text-base md:text-lg font-bold text-foreground flex items-center gap-2 dark:text-white truncate">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 shrink-0 animate-pulse" />
            <span>Случайное аниме</span>
          </h2>
          <button
            onClick={onClose}
            className="p-1 sm:p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors dark:text-zinc-400 dark:hover:text-white dark:hover:bg-zinc-800"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Контент с карточкой (скроллится при нехватке высоты) */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5 flex items-center justify-center">
          <div className="w-full max-w-[220px] sm:max-w-[260px] md:max-w-[280px]">
            <AnimeCard 
              anime={anime} 
              variant="default"
              className="w-full shadow-lg"
            />
          </div>
        </div>

        {/* Кнопки */}
        <div className="flex flex-col-reverse sm:flex-row items-center gap-2 p-2.5 sm:p-4 border-t border-border dark:border-zinc-800 bg-secondary/30 dark:bg-zinc-900/90 shrink-0">
          <Button
            variant="outline"
            onClick={onClose}
            className="w-full sm:w-1/2 h-9 sm:h-10 text-xs sm:text-sm border-border hover:bg-secondary dark:border-zinc-800 dark:hover:bg-zinc-800 dark:text-zinc-300"
          >
            Закрыть
          </Button>
          <Button
            onClick={handleNavigate}
            className="w-full sm:w-1/2 h-9 sm:h-10 text-xs sm:text-sm bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-md shadow-orange-500/20"
          >
            Смотреть аниме
          </Button>
        </div>
      </div>
    </div>
  )
}