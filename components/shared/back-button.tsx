"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface BackButtonProps {
  /**
   * Куда уводить, когда истории нет — прямой заход по ссылке, из закладки или
   * из поисковика. Без этого fallback'а router.back() на первой странице
   * просто ничего не делает, и человек оказывается в тупике.
   */
  fallbackHref?: string
  className?: string
  label?: string
}

/**
 * Кнопка «Назад». Повторяет поведение /watch: router.back() при непустой
 * истории, иначе переход на fallbackHref.
 */
export function BackButton({
  fallbackHref = "/",
  className,
  label = "Назад",
}: BackButtonProps) {
  const router = useRouter()

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        if (typeof window !== "undefined" && window.history.length > 1) {
          router.back()
        } else {
          router.push(fallbackHref)
        }
      }}
      className={cn(
        "gap-2 rounded-xl border border-border bg-secondary/60 text-muted-foreground transition-all hover:bg-accent hover:text-foreground",
        className,
      )}
    >
      <ArrowLeft className="w-4 h-4" />
      <span>{label}</span>
    </Button>
  )
}