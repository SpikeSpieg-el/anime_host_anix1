import { getForumNewsPaginated, getNewsById } from "@/lib/shikimori";
import { getJikanNews, getJikanNewsById } from "@/lib/jikan/api";
import type { NewsItem } from "@/lib/shikimori/types";
import type { AnimeNewsItem } from "@/lib/jikan/api";

export type NewsSource = 'shikimori' | 'jikan';

export interface AggregatedNewsItem {
  id: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  date: string;
  dateTimestamp: number;
  author: string;
  comments: number;
  url: string;
  source: NewsSource;
  htmlBody?: string;
  htmlFooter?: string;
  linkedAnime?: NewsItem['linkedAnime'];
  animeTitle?: string;
  animeImage?: string;
}

function parseDateToTimestamp(dateStr: string): number {
  if (dateStr.includes('.')) {
    const parts = dateStr.split('.');
    if (parts.length === 3) {
      return new Date(`${parts[2]}-${parts[1]}-${parts[0]}`).getTime() || 0;
    }
  }
  return new Date(dateStr).getTime() || 0;
}

function fromShikimori(item: NewsItem): AggregatedNewsItem {
  return {
    id: item.id,
    title: item.title,
    excerpt: item.excerpt,
    imageUrl: item.imageUrl,
    date: item.date,
    dateTimestamp: parseDateToTimestamp(item.date),
    author: item.author,
    comments: item.comments,
    url: item.url,
    source: 'shikimori',
    htmlBody: item.htmlBody,
    htmlFooter: item.htmlFooter,
    linkedAnime: item.linkedAnime,
  };
}

function fromJikan(item: AnimeNewsItem): AggregatedNewsItem {
  return {
    id: item.id,
    title: item.title,
    excerpt: item.excerpt,
    imageUrl: item.imageUrl || item.animeImage,
    date: item.date,
    dateTimestamp: parseDateToTimestamp(item.date),
    author: item.author,
    comments: item.comments,
    url: item.url,
    source: 'jikan',
    animeTitle: item.animeTitle,
    animeImage: item.animeImage,
    linkedAnime: item.linkedAnime,
    htmlBody: item.htmlBody,
  };
}

export async function getAggregatedNews(page = 1, limit = 12): Promise<{ items: AggregatedNewsItem[]; hasNextPage: boolean }> {
  const jikanCount = 6;
  const shikimoriLimit = limit - Math.min(jikanCount, limit - 2);
  const shikimoriPromise = getForumNewsPaginated(page, Math.max(1, shikimoriLimit)).catch(() => [] as NewsItem[]);
  const jikanPromise = getJikanNews(jikanCount, page).catch(() => [] as AnimeNewsItem[]);

  const [shikimoriNews, jikanNews] = await Promise.all([shikimoriPromise, jikanPromise]);

  console.log(`[getAggregatedNews] Page ${page} — Shikimori: ${shikimoriNews.length} items, Jikan: ${jikanNews.length} items`);

  const hasNextShikimori = shikimoriNews.length >= shikimoriLimit;
  const shikimoriItems = shikimoriNews.slice(0, Math.max(1, shikimoriLimit)).map(fromShikimori);
  const jikanItems = jikanNews.map(fromJikan);

  const merged = [...shikimoriItems, ...jikanItems];
  merged.sort((a, b) => b.dateTimestamp - a.dateTimestamp);

  const hasNextPage = hasNextShikimori || jikanItems.length > 0;
  const items = merged.slice(0, limit);

  console.log(`[getAggregatedNews] Returning ${items.length} items, hasNextPage: ${hasNextPage}`);
  return { items, hasNextPage };
}

export async function getAggregatedNewsById(id: string): Promise<AggregatedNewsItem | null> {
  if (id.startsWith('jikan-')) {
    const jikanNews = await getJikanNewsById(id);
    if (!jikanNews) return null;
    return fromJikan(jikanNews);
  }

  const shikimoriNews = await getNewsById(id);
  if (!shikimoriNews) return null;
  return fromShikimori(shikimoriNews);
}
