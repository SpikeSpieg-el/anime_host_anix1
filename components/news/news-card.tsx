"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Calendar, Globe, Newspaper, User } from "lucide-react";
import { getProxiedSrc } from "@/lib/image-loader";
import { newsDateToIsoDate } from "@/lib/news/date";
import { stripHtml } from "@/lib/news/text";
import type { NewsFeedItem, NewsSource } from "@/lib/news/types";
import { getNewsPath } from "@/lib/seo/news-url";
import { cn } from "@/lib/utils";

const SOURCE_LABEL: Record<NewsSource, string> = {
  shikimori: "Shikimori",
  jikan: "MAL",
  custom: "Weebx",
};

const SOURCE_CLASS: Record<NewsSource, string> = {
  custom:
    "bg-purple-500/10 text-purple-400 border border-purple-500/20 dark:bg-purple-500/15 dark:text-purple-400",
  jikan: "bg-orange-500/10 text-orange-400 dark:bg-orange-500/15 dark:text-orange-400",
  shikimori: "bg-blue-500/10 text-blue-400 dark:bg-blue-500/15 dark:text-blue-400",
};

function NewsCardImage({
  src,
  alt,
  priority,
}: {
  src?: string;
  alt: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setLoaded(false);
    // Картинка из кэша браузера может успеть загрузиться до гидратации:
    // onLoad тогда не сработает, и без этой проверки карточка останется
    // с opacity-0 навсегда.
    if (imgRef.current?.complete) setLoaded(true);
  }, [src]);

  return (
    <div className="relative w-full h-44 overflow-hidden bg-zinc-900 flex-shrink-0">
      {src ? (
        <>
          <div
            aria-hidden
            className={cn(
              "absolute inset-0 bg-gradient-to-br from-zinc-800 via-zinc-800/80 to-zinc-900 transition-opacity duration-500",
              loaded ? "opacity-0" : "animate-pulse opacity-100",
            )}
          />
          <img
            ref={imgRef}
            src={getProxiedSrc(src)}
            alt={alt}
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            onLoad={() => setLoaded(true)}
            className={cn(
              "relative h-full w-full object-cover transition-[opacity,filter,transform] duration-700 group-hover:scale-105",
              loaded ? "opacity-100 blur-0" : "opacity-0 blur-md",
            )}
          />
        </>
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-blue-500/10 via-zinc-900 to-zinc-950">
          <Newspaper className="h-10 w-10 text-zinc-700" aria-hidden />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
    </div>
  );
}

export interface NewsCardProps {
  item: NewsFeedItem;
  /** Индекс в порции — задаёт задержку каскадного появления. */
  revealIndex?: number;
  /** Первые карточки грузим eager: они попадают в LCP. */
  priority?: boolean;
  className?: string;
}

export function NewsCard({ item, revealIndex = 0, priority = false, className }: NewsCardProps) {
  const title = stripHtml(item.title) || "Новость";
  const excerpt = stripHtml(item.excerpt);
  const dateTime = newsDateToIsoDate(item.date);

  return (
    <Link
      href={getNewsPath(item.id, title)}
      style={{ animationDelay: `${Math.min(revealIndex, 11) * 55}ms` }}
      className={cn(
        "news-card-reveal group flex h-full flex-col overflow-hidden rounded-xl border bg-secondary/40 transition-all hover:border-blue-500/50 hover:bg-secondary active:scale-[0.98] sm:rounded-2xl sm:hover:-translate-y-1 sm:hover:shadow-xl sm:hover:shadow-black/50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:hover:border-blue-500/50 dark:hover:bg-zinc-900",
        className,
      )}
    >
      <NewsCardImage src={item.imageUrl} alt={title} priority={priority} />

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2 sm:mb-3">
          <span className="inline-flex items-center gap-1 rounded-md bg-secondary/50 px-2 py-1 text-[10px] font-medium text-muted-foreground sm:text-xs dark:bg-zinc-800/50 dark:text-zinc-500">
            <Calendar className="h-3 w-3" aria-hidden />
            <time dateTime={dateTime}>{item.date}</time>
          </span>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium sm:text-xs",
              SOURCE_CLASS[item.source],
            )}
          >
            <Globe className="h-3 w-3" aria-hidden />
            {SOURCE_LABEL[item.source]}
          </span>
        </div>

        <h3 className="mb-2 line-clamp-2 text-sm font-bold leading-snug text-foreground transition-colors group-hover:text-blue-400 sm:line-clamp-3 sm:text-base dark:text-zinc-100">
          {title}
        </h3>

        {item.animeTitle && (
          <p className="mb-1.5 line-clamp-1 text-[11px] font-medium text-blue-400/80 sm:text-xs">
            {item.animeTitle}
          </p>
        )}

        {excerpt && (
          <p className="mb-3 line-clamp-3 flex-1 text-xs leading-relaxed text-muted-foreground sm:mb-4 sm:text-sm dark:text-zinc-400">
            {excerpt}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between gap-2 border-t pt-3 sm:pt-4 dark:border-white/5">
          <div className="flex min-w-0 items-center gap-2 text-[10px] text-muted-foreground sm:text-xs dark:text-zinc-500">
            <User className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{item.author}</span>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-blue-400 transition-all group-hover:gap-2 sm:text-xs">
            Читать
            <ArrowRight className="h-3 w-3" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}
