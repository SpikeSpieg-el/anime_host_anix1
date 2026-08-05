'use client'

import { useState, useEffect } from 'react'
import { Sparkles, Zap } from 'lucide-react'

export function PerformanceToggle() {
  const [isLite, setIsLite] = useState(false)

  // При загрузке страницы проверяем, включен ли сохраненный простой режим
  useEffect(() => {
    const savedMode = localStorage.getItem('lite-mode') === 'true'
    setIsLite(savedMode)
    if (savedMode) {
      document.documentElement.classList.add('lite-mode')
    }
  }, [])

  // Функция переключения режимов
  const toggleMode = () => {
    const nextMode = !isLite
    setIsLite(nextMode)
    localStorage.setItem('lite-mode', String(nextMode))

    if (nextMode) {
      document.documentElement.classList.add('lite-mode')
    } else {
      document.documentElement.classList.remove('lite-mode')
    }
  }

  return (
    <button
      onClick={toggleMode}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-secondary/60 hover:bg-secondary text-xs font-medium transition-all dark:bg-zinc-900 dark:border-zinc-800 dark:hover:bg-zinc-800"
      title={isLite ? "Переключить на крутой режим (со спецэффектами)" : "Переключить на простой режим (быстрая работа)"}
    >
      {isLite ? (
        <>
          <Zap className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
          <span className="text-foreground dark:text-zinc-200">Режим: Простой</span>
        </>
      ) : (
        <>
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-foreground dark:text-zinc-200">Режим: Графика</span>
        </>
      )}
    </button>
  )
}