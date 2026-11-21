"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { startTransition, useEffect } from "react"
import { RefreshCw, Home } from "lucide-react"

/**
 * Временная ошибка страницы тайтла.
 *
 * Сюда попадаем, когда Shikimori не ответил (429/5xx/таймаут) и тайтл
 * загрузить не удалось, — см. resolveMissingWatchAnime в page.tsx. Раньше
 * вместо этого показывалось «Аниме не найдено» с <meta robots=noindex>, и
 * поисковики выкидывали живые страницы из индекса. Здесь noindex нет:
 * страница честно говорит «попробуйте ещё раз».
 */
export default function WatchError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error("[watch] Ошибка загрузки тайтла:", error)
  }, [error])

  return (
    <main className="min-h-[100dvh] bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center space-y-5">
        <img src="/icon.svg" alt="" aria-hidden="true" className="w-14 h-14 mx-auto opacity-80" />
        <h1 className="text-xl md:text-2xl font-bold">Тайтл временно недоступен</h1>
        <p className="text-sm text-muted-foreground">
          Источник данных об аниме сейчас не отвечает. Обычно это проходит за минуту — обновите страницу.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={() =>
              // Ошибка серверная: reset() сам по себе лишь перерисует тот же
              // результат, поэтому сначала просим сервер отрендерить заново.
              startTransition(() => {
                router.refresh()
                reset()
              })
            }
            className="inline-flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white hover:bg-orange-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Обновить
          </button>
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-semibold hover:bg-muted transition-colors"
          >
            <Home className="w-4 h-4" aria-hidden="true" />
            На главную
          </Link>
        </div>
      </div>
    </main>
  )
}
