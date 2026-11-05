"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowDown, Loader2, Newspaper } from "lucide-react";
import { NewsCard } from "@/components/news/news-card";
import {
  formatNewsDateLabel,
  getNewsDateKey,
  newsDateToIsoDate,
  pluralizeNews,
} from "@/lib/news/date";
import type { NewsFeedItem, NewsFeedPage } from "@/lib/news/types";

interface NewsFeedProps {
  initialItems: NewsFeedItem[];
  initialHasNextPage: boolean;
  /** true — агрегатор отдал аварийный снимок, потому что источники недоступны. */
  initialIsFallback?: boolean;
  /** Размер порции; совпадает с limit на сервере, чтобы каскад был ровным. */
  pageSize?: number;
}

interface NewsDateGroup {
  key: string;
  label: string;
  iso?: string;
  items: NewsFeedItem[];
}

function groupByDate(items: NewsFeedItem[]): NewsDateGroup[] {
  const groups = new Map<string, NewsDateGroup>();

  for (const item of items) {
    const key = getNewsDateKey(item.date) || "unknown";
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        label: formatNewsDateLabel(item.date),
        iso: newsDateToIsoDate(item.date),
        items: [],
      };
      groups.set(key, group);
    }
    group.items.push(item);
  }

  return Array.from(groups.values());
}

function FeedSkeleton() {
  return (
    <div
      aria-hidden
      className="flex h-full flex-col overflow-hidden rounded-xl border bg-secondary/30 dark:border-zinc-800/80 dark:bg-zinc-900/40 sm:rounded-2xl"
    >
      <div className="h-44 w-full animate-pulse bg-zinc-800/80 dark:bg-zinc-800" />
      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex gap-2">
          <div className="h-5 w-16 animate-pulse rounded-md bg-zinc-800/80 dark:bg-zinc-800" />
          <div className="h-5 w-14 animate-pulse rounded-md bg-zinc-800/80 dark:bg-zinc-800" />
        </div>
        <div className="h-5 w-full animate-pulse rounded bg-zinc-800/80 dark:bg-zinc-800" />
        <div className="h-5 w-2/3 animate-pulse rounded bg-zinc-800/80 dark:bg-zinc-800" />
        <div className="mt-auto space-y-2 border-t pt-4 dark:border-white/5">
          <div className="h-3 w-full animate-pulse rounded bg-zinc-800/60 dark:bg-zinc-800/60" />
          <div className="h-3 w-4/5 animate-pulse rounded bg-zinc-800/60 dark:bg-zinc-800/60" />
        </div>
      </div>
    </div>
  );
}

export function NewsFeed({
  initialItems,
  initialHasNextPage,
  initialIsFallback = false,
  pageSize = 12,
}: NewsFeedProps) {
  const [items, setItems] = useState<NewsFeedItem[]>(initialItems);
  const [hasNextPage, setHasNextPage] = useState(initialHasNextPage);
  const [nextPage, setNextPage] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState(initialIsFallback);
  const [autoLoadSupported, setAutoLoadSupported] = useState(true);

  const seenIds = useRef(new Set(initialItems.map((item) => item.id)));
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const prefetchedRef = useRef(false);

  const groups = useMemo(() => groupByDate(items), [items]);

  const indexById = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach((item, index) => map.set(item.id, index));
    return map;
  }, [items]);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || !hasNextPage) return;

    loadingRef.current = true;
    setLoading(true);
    setError(null);

    try {
      let pageToFetch = nextPage;
      let latestHasNextPage = false;
      let attempts = 0;
      const collected: NewsFeedItem[] = [];

      // Shikimori отдаёт страницы по порядку, а MAL/Jikan на разных страницах
      // может вернуть те же самые новости. Поэтому листаем до 3 страниц, пока
      // не найдём хотя бы одну новую карточку — иначе лента «залипала» бы на
      // дубликатах и пользователь видел бесконечный индикатор загрузки.
      while (attempts < 3) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 20_000);
        let response: Response;

        try {
          response = await fetch(`/api/news?page=${pageToFetch}&limit=${pageSize}`, {
            cache: "no-cache",
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeout);
        }

        if (!response.ok) throw new Error(`News API responded with ${response.status}`);

        const data = (await response.json()) as NewsFeedPage;
        latestHasNextPage = Boolean(data.hasNextPage);
        setIsFallback(Boolean(data.isFallback));

        const fresh: NewsFeedItem[] = [];
        for (const item of data.items ?? []) {
          if (!item || typeof item.id !== "string" || seenIds.current.has(item.id)) continue;
          seenIds.current.add(item.id);
          fresh.push(item);
        }
        collected.push(...fresh);
        pageToFetch += 1;
        attempts += 1;

        if (fresh.length > 0 || !latestHasNextPage) break;
      }

      if (collected.length > 0) {
        setItems((previous) => [...previous, ...collected]);
      }

      setNextPage(pageToFetch);
      setHasNextPage(latestHasNextPage && collected.length > 0);

      if (collected.length === 0) {
        // Дальше листать нечего: либо API сказал «конец», либо все три
        // страницы вернули только дубликаты.
        setHasNextPage(false);
      }
    } catch (loadError) {
      console.error("[NewsFeed] Failed to load more news:", loadError);
      setError("Не удалось загрузить ещё новости. Проверьте соединение и попробуйте снова.");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [hasNextPage, nextPage, pageSize]);

  useEffect(() => {
    setAutoLoadSupported(typeof IntersectionObserver !== "undefined");
  }, []);

  // Бесконечная прокрутка: подгружаем порцию, когда до конца ленты остаётся
  // меньше ~1200 px. rootMargin большой, чтобы карточки успевали появиться до
  // того, как пользователь дойдёт до края (это и есть «бесшовность»).
  useEffect(() => {
    if (!hasNextPage || !autoLoadSupported || error) return;
    if (typeof IntersectionObserver === "undefined") return;
    const node = sentinelRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { rootMargin: "1200px 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [autoLoadSupported, error, hasNextPage, loadMore]);

  // Если после подгрузки порции сентинел всё ещё в зоне видимости (короткая
  // лента / высокий экран), IntersectionObserver не пришлёт повторное событие:
  // проверяем сами и подгружаем следующую порцию.
  useEffect(() => {
    if (!hasNextPage || loading || !autoLoadSupported || error) return;
    const node = sentinelRef.current;
    if (!node) return;

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight + 1200) void loadMore();
  }, [autoLoadSupported, error, hasNextPage, items, loadMore, loading]);

  // Предивная подгрузка: как только первый экран отрисован, сразу тянем
  // следующую порцию в фоне. Пользователь ещё читает верх ленты, а данные уже
  // лежат в кеше — к моменту скролла вниз подгрузка происходит мгновенно.
  useEffect(() => {
    if (prefetchedRef.current || !hasNextPage || error) return;
    prefetchedRef.current = true;
    const timer = setTimeout(() => {
      void loadMore();
    }, 500);
    return () => clearTimeout(timer);
  }, [error, hasNextPage, loadMore]);

  const showRetry = Boolean(error) && !loading;

  return (
    <div>
      {isFallback && (
        <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-relaxed text-amber-500 dark:text-amber-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Некоторые источники новостей временно недоступны — часть материалов может быть
            из сохранённого снимка.
          </span>
        </div>
      )}

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.key} aria-labelledby={`news-date-${group.key}`}>
            {/* Лёгкое отделение по датам: тонкая линия и липкая подпись, а не
                отдельные страницы. */}
            <div className="news-date-divider sticky z-20 -mx-4 mb-4 flex items-center gap-3 border-b border-border/40 bg-background/85 px-4 py-2.5 backdrop-blur-md dark:border-white/5 dark:bg-background/80">
              <time
                id={`news-date-${group.key}`}
                dateTime={group.iso}
                className="shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground dark:text-zinc-400"
              >
                {group.label}
              </time>
              <span
                aria-hidden
                className="h-px flex-1 bg-gradient-to-r from-border via-border/60 to-transparent dark:from-white/10 dark:via-white/5"
              />
              <span className="shrink-0 text-[10px] text-muted-foreground/70 dark:text-zinc-600">
                {pluralizeNews(group.items.length)}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {group.items.map((item) => {
                // Глобальный индекс по всей ленте, а не внутри группы: каскад
                // появления должен идти сверху вниз без «прыжков» на границах дат.
                const globalIndex = indexById.get(item.id) ?? 0;

                return (
                  <NewsCard
                    key={item.id}
                    item={item}
                    revealIndex={globalIndex % pageSize}
                    priority={globalIndex < 3}
                  />
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div ref={sentinelRef} aria-hidden className="h-1 w-full" />

      {loading && (
        <div className="mt-6">
          <p className="mb-3 flex items-center justify-center gap-2 text-xs text-muted-foreground dark:text-zinc-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Загружаем ещё новости…
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <FeedSkeleton key={index} />
            ))}
          </div>
        </div>
      )}

      {showRetry && (
        <div className="mt-6 flex flex-col items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-5 text-center">
          <AlertCircle className="h-5 w-5 text-red-400" aria-hidden />
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => void loadMore()}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-xs font-medium text-foreground transition-colors hover:bg-accent dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            Попробовать снова
          </button>
        </div>
      )}

      {!loading && !error && !hasNextPage && items.length > 0 && (
        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <Newspaper className="h-5 w-5 text-muted-foreground/50 dark:text-zinc-700" aria-hidden />
          <p className="text-xs text-muted-foreground dark:text-zinc-500">
            Вы дошли до конца ленты — это все новости на данный момент.
          </p>
        </div>
      )}

      {/* Ручной фолбэк: если IntersectionObserver недоступен (старый браузер),
          лента остаётся рабочей — просто по кнопке. */}
      {!autoLoadSupported && hasNextPage && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-secondary px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700"
          >
            <ArrowDown className="h-4 w-4" aria-hidden />
            Показать ещё
          </button>
        </div>
      )}

      <p role="status" aria-live="polite" className="sr-only">
        {loading ? "Загружаем ещё новости" : ""}
      </p>
    </div>
  );
}
