import Link from "next/link"
import { ChevronRight, Compass } from "lucide-react"

import { GENRES_MAP } from "@/lib/shikimori/config"

/**
 * Порядок жанров на главной.
 *
 * Имена берутся из `GENRES_MAP`, потому что каталог фильтрует именно по нему
 * (`/catalog?genre=Исекай`). Если какое-то имя из списка исчезнет из карты,
 * чип просто не отрисуется, а не превратится в ссылку с пустой выдачей.
 */
const FEATURED_GENRES = [
  "Экшен",
  "Приключения",
  "Комедия",
  "Драма",
  "Романтика",
  "Фэнтези",
  "Исекай",
  "Сверхъестественное",
  "Психология",
  "Триллер",
  "Ужасы",
  "Повседневность",
  "Спорт",
  "Меха",
  "Сэйнэн",
  "Сёдзё",
]

/**
 * Блок «Что посмотреть» — вход в каталог по жанру.
 *
 * Стоит над «Популярным» намеренно: к моменту, когда человек доскроллил до
 * хитов сезона, выбор у него уже сделан. А над «Популярным» он обычно ещё
 * думает, что вообще смотреть, — и жанр отвечает на этот вопрос быстрее,
 * чем рейтинг.
 */
export function WhatToWatch() {
  const genres = FEATURED_GENRES.filter((name) => GENRES_MAP[name])

  return (
    <section id="genres" className="mb-12 sm:mb-20">
      <div className="rounded-xl sm:rounded-2xl border bg-secondary/40 overflow-hidden dark:bg-zinc-900/40 dark:border-zinc-800">
        {/* Шапка блока */}
        <div className="flex items-start gap-3 sm:gap-4 p-4 sm:p-6 pb-3 sm:pb-4">
          <div className="shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center">
            <Compass className="w-5 h-5 sm:w-6 sm:h-6 text-orange-400" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground dark:text-white">
              Что посмотреть
            </h2>
            <p className="text-muted-foreground text-xs sm:text-sm mt-1 dark:text-zinc-400">
              Не знаете, с чего начать? Выберите жанр — и покажем, что смотрят
              чаще всего.
            </p>
          </div>

          <Link
            href="/catalog"
            className="hidden sm:flex shrink-0 items-center gap-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-500 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold transition-colors whitespace-nowrap"
          >
            Весь каталог
            <ChevronRight className="w-3 h-3 sm:w-4 sm:h-4" />
          </Link>
        </div>

        {/* Жанры */}
        <div className="px-4 sm:px-6 pb-4 sm:pb-6">
          <div className="flex flex-wrap gap-1.5 sm:gap-2">
            {genres.map((name) => (
              <Link
                key={name}
                href={`/catalog?genre=${encodeURIComponent(name)}`}
                className="inline-flex items-center px-2.5 sm:px-3.5 py-1.5 sm:py-2 rounded-full bg-secondary/50 hover:bg-accent text-muted-foreground hover:text-accent-foreground border border-transparent hover:border-accent text-xs sm:text-sm font-medium transition-colors dark:bg-zinc-800/50 dark:text-zinc-300 dark:hover:bg-zinc-700 dark:hover:text-white"
              >
                {name}
              </Link>
            ))}
          </div>

          <Link
            href="/catalog"
            className="sm:hidden mt-3 inline-flex items-center gap-1.5 text-orange-500 text-xs sm:text-sm font-bold"
          >
            Весь каталог
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </section>
  )
}
