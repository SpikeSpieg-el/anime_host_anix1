"use client"

import { useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { easterEggs } from "@/lib/easter-eggs"

/**
 * Пасхалки, включаемые параметром в URL (?matrix, ?nyan и т.д.).
 *
 * Почему это отдельный компонент, а не код внутри HomePageClient.
 *
 * `useSearchParams()` во время серверного рендера вынуждает React выбросить
 * ВСЁ поддерево до ближайшей Suspense-границы и отрисовать его на клиенте
 * (`BAILOUT_TO_CLIENT_SIDE_RENDERING`). Пока эта логика жила в
 * HomePageClient, из HTML главной пропадала вся основная часть — новости,
 * «Что посмотреть», лента обновлений и ссылки на /watch; Google видел
 * пустую страницу с одним баннером. Проверялось в прод-сборке: в HTML
 * оставались только скелетоны с data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING".
 *
 * Здесь тот же bailout, но он ограничен этим компонентом: собственной
 * Suspense-границей с пустым фолбэком. Пасхалки — не контент, им серверный
 * рендер не нужен.
 */
export function HomeEasterEggs() {
  const searchParams = useSearchParams()

  useEffect(() => {
    easterEggs.forEach((egg) => {
      // Извлекаем имя команды без префикса
      let commandName = ""
      if (egg.command.startsWith("?")) {
        commandName = egg.command.slice(1) // убираем ?
      } else if (egg.command.startsWith("/")) {
        commandName = egg.command.slice(1) // убираем /
      }

      if (searchParams.get(commandName) === null) return

      // Команда найдена в URL — выполняем её
      setTimeout(() => {
        egg.action()
      }, 1000)
    })
  }, [searchParams])

  return null
}
