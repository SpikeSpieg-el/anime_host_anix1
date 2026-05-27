"use client"

import { useAuth } from "@/components/auth-provider"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export function LogoutLoadingScreen() {
  const { loading, user } = useAuth()
  const pathname = usePathname()
  const [show, setShow] = useState(false)
  const [wasOnGacha, setWasOnGacha] = useState(false)

  useEffect(() => {
    // Отслеживаем, были ли мы на гача странице
    if (pathname === "/gacha") {
      setWasOnGacha(true)
    }
  }, [pathname])

  useEffect(() => {
    if (loading) {
      // Показываем полноценный экран загрузки если:
      // 1. Выход с гача страницы (были на гача и сейчас loading)
      // 2. Или есть флаг выхода в sessionStorage
      const isLoggingOut = sessionStorage.getItem('logout-in-progress') === 'true'
      
      if (wasOnGacha || isLoggingOut) {
        // Небольшая задержка для плавного появления
        const timeout = setTimeout(() => {
          setShow(true)
        }, 100)

        return () => clearTimeout(timeout)
      }
    } else {
      setShow(false)
      
      // Очищаем флаги и сбрасываем состояние после завершения
      sessionStorage.removeItem('logout-in-progress')
      if (!user) {
        setWasOnGacha(false)
      }
    }

    // Сохраняем состояние авторизации
    if (user) {
      localStorage.setItem('user-was-logged-in', 'true')
    } else if (loading === false) {
      localStorage.removeItem('user-was-logged-in')
    }
  }, [loading, user, wasOnGacha])

  // Слушаем событие начала выхода
  useEffect(() => {
    const handleLogoutStart = () => {
      sessionStorage.setItem('logout-in-progress', 'true')
    }

    window.addEventListener('logout-start', handleLogoutStart)
    
    return () => {
      window.removeEventListener('logout-start', handleLogoutStart)
    }
  }, [])

  if (!show) return null

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-zinc-950/90 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4">
        {/* Анимированный логотип */}
        <div className="w-16 h-16 animate-pulse">
          <img src="/icon.svg" alt="Logo" className="w-full h-full" />
        </div>
        
        {/* Спиннер загрузки */}
        <div className="relative w-12 h-12">
          <div className="absolute inset-0 border-4 border-zinc-800 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-orange-500 rounded-full border-t-transparent animate-spin"></div>
        </div>
        
        {/* Текст загрузки */}
        <p className="text-zinc-400 text-sm animate-pulse">Выход из аккаунта...</p>
      </div>
    </div>
  )
}
