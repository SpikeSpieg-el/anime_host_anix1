"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getGenrePath, type GenreLanding } from "@/lib/seo/genre-landings"

interface GenreCarouselProps {
  genres: GenreLanding[]
  className?: string
}

/** Ширина одной карточки + зазор. Держим вручную: scroll-snap прыгает по offsetLeft. */
const CARD_WIDTH = 232
const CARD_GAP = 16

/**
 * Карусель жанровых карточек.
 *
 * Раньше жанры выводились списком плашек: 37 штук занимали четыре экрана
 * высоты и уводили человека вниз от каталога тайтлов. Карусель держит блок
 * в двух-трёх строках на любой ширине, а свайп на мобиле остаётся нативным —
 * скролл-контейнера трогать не нужно.
 *
 * Прокрутка на кнопках — scrollBy, а не transform: со скролл-снапом это
 * единственный способ, который не ломает позицию карточек при ресайзе.
 */
export function GenreCarousel({ genres, className }: GenreCarouselProps) {
  const scrollerRef = useRef<HTMLUListElement>(null)
  // Границы, на которых кнопка гасится. Начальные false: до замера стрелки
  // активны, иначе на первом кадре они моргают.
  const [atStart, setAtStart] = useState(false)
  const [atEnd, setAtEnd] = useState(false)

  const syncEdges = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    // +1px допуск: часть браузеров отдаёт дробные scrollLeft при snap.
    setAtStart(el.scrollLeft <= 1)
    setAtEnd(maxScroll <= 1 || el.scrollLeft >= maxScroll - 1)
  }, [])

  useEffect(() => {
    const el = scrollerRef.current
    if (!el) return
    syncEdges()
    el.addEventListener("scroll", syncEdges, { passive: true })
    const observer = new ResizeObserver(syncEdges)
    observer.observe(el)
    return () => {
      el.removeEventListener("scroll", syncEdges)
      observer.disconnect()
    }
  }, [syncEdges, genres.length])

  const scrollByCards = useCallback((direction: 1 | -1) => {
    const el = scrollerRef.current
    if (!el) return
    el.scrollBy({
      left: direction * (CARD_WIDTH + CARD_GAP) * 2,
      behavior: "smooth",
    })
  }, [])

  if (genres.length === 0) return null

  return (
    <div className={cn("relative", className)}>
      {/* Стрелки только на широких экранах: на мобиле они лишние, там свайп.
          Гашение — из состояния, а не через disabled:-вариант: тот собирается
          вложенным `&:disabled`, и на части сборок dev-сервера правило не
          доходит до кнопки. */}
      <button
        type="button"
        onClick={() => scrollByCards(-1)}
        disabled={atStart}
        aria-label="Предыдущие жанры"
        className={cn(
          "absolute left-0 top-1/2 z-10 hidden h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
          "border border-border bg-background/90 text-foreground shadow-lg backdrop-blur",
          // transition-colors, а не transition-all: последний тянет в переход
          // и opacity, и у затухающей стрелки переход не доходит до конца —
          // кнопка остаётся видимой, но некликабельной.
          "transition-colors",
          "hover:border-primary/60 hover:bg-primary hover:text-black md:flex",
          "dark:border-white/10 dark:bg-zinc-900/90 dark:text-white dark:hover:bg-orange-500 dark:hover:text-black",
          atStart && "pointer-events-none opacity-0",
        )}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>

      <button
        type="button"
        onClick={() => scrollByCards(1)}
        disabled={atEnd}
        aria-label="Следующие жанры"
        className={cn(
          "absolute right-0 top-1/2 z-10 hidden h-10 w-10 translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full",
          "border border-border bg-background/90 text-foreground shadow-lg backdrop-blur",
          // transition-colors, а не transition-all: последний тянет в переход
          // и opacity, и у затухающей стрелки переход не доходит до конца —
          // кнопка остаётся видимой, но некликабельной.
          "transition-colors",
          "hover:border-primary/60 hover:bg-primary hover:text-black md:flex",
          "dark:border-white/10 dark:bg-zinc-900/90 dark:text-white dark:hover:bg-orange-500 dark:hover:text-black",
          atEnd && "pointer-events-none opacity-0",
        )}
      >
        <ChevronRight className="h-5 w-5" />
      </button>

      <ul
        ref={scrollerRef}
        className={cn(
          // Свайп/трекпад работают сами, скроллбар не нужен — стрелки и есть
          // навигация. Скроллбар прячем двумя свойствами: scrollbar-width
          // для Firefox, ::-webkit-scrollbar для Chromium/Safari.
          "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2",
          "[-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          // scroll-ps обязателен вместе с px: со снапом и без него браузер
          // «прилипает» к первой карточке на величину padding'а — scrollLeft
          // становится 40px вместо 0, и стрелка «влево» светится в начале.
          "md:px-10 md:scroll-ps-10",
          className,
        )}
      >
        {genres.map((genre) => (
          <li
            key={genre.slug}
            className="w-[9.5rem] shrink-0 snap-start sm:w-44 lg:w-[13.5rem]"
          >
            <Link
              href={getGenrePath(genre.slug)}
              className={cn(
                "group flex h-full flex-col gap-2 rounded-2xl border border-border/80 bg-gradient-to-br from-secondary/60 to-secondary/20 p-4",
                "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60",
                "hover:from-primary/20 hover:to-primary/5 hover:shadow-lg hover:shadow-primary/10",
                "dark:border-white/10 dark:from-zinc-900/80 dark:to-zinc-900/30",
                "dark:hover:border-orange-500/60 dark:hover:shadow-orange-500/10",
              )}
            >
              <span
                aria-hidden
                className="h-1.5 w-9 rounded-full transition-all duration-200 group-hover:w-14"
                style={{ backgroundColor: genre.accent }}
              />
              <span className="text-sm font-bold leading-tight text-foreground transition-colors group-hover:text-primary dark:text-white dark:group-hover:text-orange-400">
                {genre.name}
              </span>
              <span className="line-clamp-2 text-[11px] leading-snug text-muted-foreground dark:text-zinc-500">
                {genre.hint}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}