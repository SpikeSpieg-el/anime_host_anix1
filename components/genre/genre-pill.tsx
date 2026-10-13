import Link from "next/link"
import { cn } from "@/lib/utils"
import { getGenrePath, type GenreLanding } from "@/lib/seo/genre-landings"

const SIZES = {
  sm: { root: "px-3.5 py-1.5 text-xs gap-1.5" },
  md: { root: "px-4 py-2 text-sm gap-2" },
  lg: { root: "px-5 py-2.5 text-base gap-2.5 sm:text-[17px]" },
} as const

interface GenrePillProps {
  genre: GenreLanding
  size?: keyof typeof SIZES
  /** Показать короткое описание жанра второй строкой. Только для крупных плашек. */
  showHint?: boolean
  className?: string
}

/**
 * Плашка жанра для /genre и для блока «Другие жанры» на странице жанра.
 *
 * Кликабельная вся площадь, но <Link> содержит ТОЛЬКО название: цветная точка
 * лежит рядом. Иначе anchor text получается «🟠 Исекай», и поисковик видит
 * мусор вместо ключевого слова. Эмодзи здесь не используются — только span с
 * background-color.
 *
 * Клик по всей плашке сделан псевдоэлементом after:inset-0 — сам <a> остаётся
 * ровно по размеру текста.
 */
export function GenrePill({
  genre,
  size = "md",
  showHint = false,
  className,
}: GenrePillProps) {
  const sizes = SIZES[size]

  return (
    <div
      className={cn(
        "group relative flex items-center rounded-full border border-border/80 bg-gradient-to-br from-secondary/70 to-secondary/20",
        "transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60",
        "hover:from-primary/20 hover:to-primary/5 hover:shadow-lg hover:shadow-primary/10",
        "dark:border-white/10 dark:from-zinc-900/80 dark:to-zinc-900/30",
        "dark:hover:border-orange-500/60 dark:hover:shadow-orange-500/10",
        showHint && "flex-col items-start gap-1.5 rounded-2xl px-4 py-3",
        showHint ? "gap-2" : sizes.root,
        className,
      )}
    >
      <span className="flex shrink-0 items-center gap-2">
        <span
          aria-hidden
          className={cn(
            "shrink-0 rounded-full ring-1 ring-inset ring-white/15 transition-transform duration-200 group-hover:scale-110",
            showHint ? "h-2 w-2" : "h-2.5 w-2.5",
          )}
          style={{ backgroundColor: genre.accent }}
        />
        <Link
          href={getGenrePath(genre.slug)}
          className={cn(
            "font-bold text-foreground transition-colors after:absolute after:inset-0 after:content-['']",
            "group-hover:text-primary dark:text-white dark:group-hover:text-orange-400",
            showHint ? "text-sm" : "whitespace-nowrap",
          )}
        >
          {genre.name}
        </Link>
      </span>

      {showHint && (
        <span className="relative z-10 line-clamp-2 text-[11px] leading-snug text-muted-foreground dark:text-zinc-500">
          {genre.hint}
        </span>
      )}
    </div>
  )
}