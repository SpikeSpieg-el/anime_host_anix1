import { NextResponse } from "next/server";
import { getAggregatedNews, toNewsFeedPage } from "@/lib/news/aggregator";
import type { NewsFeedPage } from "@/lib/news/types";

/**
 * Лента новостей для бесконечной прокрутки.
 *
 * Первая страница рендерится на сервере (SEO, LCP), а этот маршрут отдаёт
 * следующие порции. Ответ намеренно не содержит htmlBody/htmlFooter —
 * клиенту нужны только поля карточки.
 *
 * Скорость:
 *  - для страниц 2+ не трогаем Jikan/MAL (он обходит top/anime и новости
 *    каждого тайтла последовательно — именно он давал «жду больше минуты»);
 *  - ответы кешируются в памяти на 5 минут, поэтому повторный скролл и
 *    возврат назад по ленте мгновенные;
 *  - жёсткий таймаут 12 секунд: если Shikimori лежит, клиент сразу получает
 *    понятную ошибку с кнопкой «Попробовать снова», а не висит минуту.
 */
export const revalidate = 300;

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;
const REQUEST_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 5 * 60 * 1000;
const CACHE_MAX_ENTRIES = 100;

type CachedNewsPage = { data: NewsFeedPage; expiresAt: number };

const pageCache = new Map<string, CachedNewsPage>();

function readCache(key: string): NewsFeedPage | undefined {
  const entry = pageCache.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    pageCache.delete(key);
    return undefined;
  }
  return entry.data;
}

function writeCache(key: string, data: NewsFeedPage): void {
  if (pageCache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = pageCache.keys().next().value;
    if (oldestKey !== undefined) pageCache.delete(oldestKey);
  }
  pageCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const cacheHeaders = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.min(1000, parsePositiveInt(searchParams.get("page"), 1));
  const limit = Math.min(MAX_LIMIT, parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT));
  const cacheKey = `${page}:${limit}`;

  const cached = readCache(cacheKey);
  if (cached) {
    return NextResponse.json(cached, { headers: cacheHeaders });
  }

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("News API timeout")), REQUEST_TIMEOUT_MS);
  });

  try {
    const data = await Promise.race([
      getAggregatedNews(page, limit, { includeJikan: page === 1 }),
      timeout,
    ]);

    const payload = toNewsFeedPage(data.items, data.hasNextPage, page, limit, data.isFallback);

    // Аварийный снимок не кешируем: пусть следующий запрос попробует живые
    // источники снова.
    if (!data.isFallback) writeCache(cacheKey, payload);

    return NextResponse.json(payload, { headers: data.isFallback ? { "Cache-Control": "no-store" } : cacheHeaders });
  } catch (error) {
    console.error("[api/news] Failed to load news page:", error);

    return NextResponse.json(
      {
        items: [],
        hasNextPage: false,
        page,
        limit,
        isFallback: true,
        error: "Источники новостей не ответили вовремя. Попробуйте ещё раз.",
      },
      { status: 504, headers: { "Cache-Control": "no-store" } },
    );
  } finally {
    if (timer) clearTimeout(timer);
  }
}
