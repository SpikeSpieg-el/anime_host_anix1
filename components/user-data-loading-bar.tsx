"use client"

import { useAuth } from "@/components/auth-provider"
import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

export function UserDataLoadingBar() {
  const { user, profileLoading, loading } = useAuth()
  const [forceHide, setForceHide] = useState(false)

  // Показываем загрузку при выходе из аккаунта (когда loading=true)
  // или при загрузке профиля (когда profileLoading=true)
  const isLoading = loading || profileLoading

  // Автоматически скрываем через 15 секунд для защиты от зависания
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        console.warn('[UserDataLoadingBar] Force hiding after timeout')
        setForceHide(true)
      }, 15000)

      return () => clearTimeout(timeout)
    } else {
      setForceHide(false)
    }
  }, [isLoading])

  if (!isLoading || forceHide) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center gap-2 py-2 px-4 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 text-zinc-300 text-sm"
      role="status"
      aria-live="polite"
      aria-label={loading ? "Выход из аккаунта..." : "Загрузка данных пользователя..."}
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-orange-500" />
      <span>{loading ? "Выход из аккаунта..." : "Загрузка данных пользователя..."}</span>
    </div>
  )
}
