"use client"

import { useAuth } from "@/components/auth-provider"
import { Loader2 } from "lucide-react"

export function UserDataLoadingBar() {
  const { user, profileLoading } = useAuth()

  if (!user || !profileLoading) return null

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9998] flex items-center justify-center gap-2 py-2 px-4 bg-zinc-900/95 backdrop-blur-sm border-b border-zinc-800 text-zinc-300 text-sm"
      role="status"
      aria-live="polite"
      aria-label="Загрузка данных пользователя"
    >
      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-orange-500" />
      <span>Загрузка данных пользователя...</span>
    </div>
  )
}
