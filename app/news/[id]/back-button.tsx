"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"

export function BackButton() {
  const router = useRouter()

  return (
    <button
      onClick={() => router.back()}
      className="inline-flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent border border-border hover:border-blue-500/50 text-muted-foreground hover:text-foreground font-medium rounded-xl transition-all mb-6 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:border-zinc-800 dark:hover:border-blue-500/50 dark:text-zinc-400 dark:hover:text-white"
    >
      <ArrowLeft className="w-4 h-4" />
      Назад
    </button>
  )
}
