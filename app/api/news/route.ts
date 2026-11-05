import { NextResponse } from "next/server";
import { getAggregatedNews, toNewsFeedPage } from "@/lib/news/aggregator";

/**
 * Лента новостей для бесконечной прокрутки.
 *
 * Первая страница рендерится на сервере (SEO, LCP), а этот маршрут отдаёт
 * следующие порции. Ответ намеренно не содержит htmlBody/htmlFooter —
 * клиенту нужны только поля карточки.
 *
 * Кэш: 5 минут на CDN + stale-while-revalidate. Новости обновляются не чаще
 * раза в минуту, а каждый скролл не должен бить в Shikimori/Jikan заново.
 */
export const revalidate = 300;

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 24;

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.min(1000, parsePositiveInt(searchParams.get("page"), 1));
  const limit = Math.min(MAX_LIMIT, parsePositiveInt(searchParams.get("limit"), DEFAULT_LIMIT));

  try {
    const { items, hasNextPage, isFallback } = await getAggregatedNews(page, limit);

    return NextResponse.json(toNewsFeedPage(items, hasNextPage, page, limit, isFallback), {
      headers: {
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      },
    });
  } catch (error) {
    console.error("[api/news] Failed to load news page:", error);

    return NextResponse.json(
      {
        items: [],
        hasNextPage: false,
        page,
        limit,
        error: "Не удалось загрузить новости. Попробуйте ещё раз.",
      },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
