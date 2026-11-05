import { getForumNewsPaginated, getNewsById } from "@/lib/shikimori";
import { getJikanNews, getJikanNewsById } from "@/lib/jikan/api";
import { createClient } from "@supabase/supabase-js";
import type { NewsItem } from "@/lib/shikimori/types";
import type { AnimeNewsItem } from "@/lib/jikan/api";
import { getNewsPath, parseNewsParam } from "@/lib/seo/news-url";
import { parseNewsTimestamp } from "@/lib/news/date";
import type { NewsFeedItem, NewsFeedPage, NewsSource } from "@/lib/news/types";
import { toFeedItem } from "@/lib/news/text";
import { FALLBACK_NEWS, getFallbackNewsById } from "@/lib/news/fallback";

export type { NewsSource } from "@/lib/news/types";

export interface AggregatedNewsItem extends NewsFeedItem {
  /** Счётчик комментариев Shikimori. В интерфейсе не показывается, но остаётся
   *  в данных для админки/аналитики. */
  comments: number;
  htmlBody?: string;
  htmlFooter?: string;
  linkedAnime?: NewsItem['linkedAnime'];
}

function fromShikimori(item: NewsItem): AggregatedNewsItem {
  return {
    id: item.id,
    title: item.title,
    excerpt: item.excerpt,
    imageUrl: item.imageUrl,
    date: item.date,
    dateTimestamp: parseNewsTimestamp(item.date),
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
    dateTimestamp: parseNewsTimestamp(item.date),
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

async function getCustomNews(offset = 0, limit = 12): Promise<{ items: AggregatedNewsItem[]; total: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return { items: [], total: 0 };

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const from = Math.max(0, offset);
  const to = from + Math.max(1, limit) - 1;

  const { data, error, count } = await supabase
    .from("custom_news")
    .select("*", { count: "exact" })
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) {
    console.error("[getCustomNews] Error:", error);
    return { items: [], total: 0 };
  }

  const items = (data || []).map((item: any) => ({
    id: `custom-${item.id}`,
    title: item.title,
    excerpt: item.excerpt,
    imageUrl: item.image_url || undefined,
    date: new Date(item.created_at).toLocaleDateString("ru-RU"),
    dateTimestamp: new Date(item.created_at).getTime(),
    author: item.author || "Редакция Weebx",
    comments: 0,
    url: getNewsPath(`custom-${item.id}`, item.title),
    source: 'custom' as NewsSource,
    htmlBody: item.body || undefined,
  }));

  return { items, total: count || 0 };
}

export interface GetAggregatedNewsOptions {
  /**
   * Jikan/MAL — самый медленный источник: на страницу он обходит top/anime и
   * затем новости каждого тайтла последовательно, с паузами. Для следующих
   * страниц бесконечной ленты он не нужен: Shikimori + custom закрывают
   * выдачу, а лента начинает отвечать за секунды, а не за минуты.
   */
  includeJikan?: boolean
}

export async function getAggregatedNews(
  page = 1,
  limit = 12,
  options: GetAggregatedNewsOptions = {},
): Promise<{ items: AggregatedNewsItem[]; hasNextPage: boolean; isFallback: boolean }> {
  // На первой странице выделяем место под свежие кастомные новости (до 4 штук),
  // на следующих — по 2. Смещение считается от РЕАЛЬНОГО числа показанных
  // кастомных новостей, а не от «page * limit»: лимиты первой и следующих
  // страниц разные, и старый расчёт (page * customLimit) пропускал новости и
  // застревал на одних и тех же записях при бесконечной прокрутке.
  const firstPageCustomLimit = Math.min(4, limit);
  const customLimit = page === 1 ? firstPageCustomLimit : Math.min(2, limit);
  const customOffset = page === 1 ? 0 : firstPageCustomLimit + (page - 2) * customLimit;
  const externalLimit = limit - customLimit;

  const includeJikan = options.includeJikan ?? true;
  const jikanCount = includeJikan ? Math.min(4, Math.floor(externalLimit / 2)) : 0;
  const shikimoriLimit = Math.max(1, externalLimit - jikanCount);

  const customPromise = getCustomNews(customOffset, customLimit);
  const shikimoriPromise = getForumNewsPaginated(page, shikimoriLimit).catch(() => [] as NewsItem[]);
  const jikanPromise = includeJikan
    ? getJikanNews(jikanCount, page).catch(() => [] as AnimeNewsItem[])
    : Promise.resolve([] as AnimeNewsItem[]);

  const [customRes, shikimoriNews, jikanNews] = await Promise.all([customPromise, shikimoriPromise, jikanPromise]);

  const customNews = customRes.items;
  const shikimoriItems = shikimoriNews.slice(0, shikimoriLimit).map(fromShikimori);
  const jikanItems = jikanNews.map(fromJikan);

  const merged = [...customNews, ...shikimoriItems, ...jikanItems];
  merged.sort((a, b) => b.dateTimestamp - a.dateTimestamp);

  const hasSourceItems = merged.length > 0;
  const hasNextPage = hasSourceItems
    ? shikimoriNews.length >= shikimoriLimit ||
      (includeJikan && jikanItems.length > 0) ||
      customOffset + customNews.length < customRes.total
    : false;

  // Все три источника недоступны — отдаём последний сохранённый снимок, чтобы
  // вместо пустой страницы пользователь видел ленту. Режим помечаем, чтобы
  // интерфейс мог честно сказать, что новости не свежие.
  const items = hasSourceItems ? merged.slice(0, limit) : FALLBACK_NEWS.slice(0, limit);

  return { items, hasNextPage, isFallback: !hasSourceItems };
}

/** Форма ответа API ленты: без тяжёлых HTML-полей, только карточка. */
export function toNewsFeedPage(
  items: AggregatedNewsItem[],
  hasNextPage: boolean,
  page: number,
  limit: number,
  isFallback = false,
): NewsFeedPage {
  return {
    items: items.map(toFeedItem),
    hasNextPage,
    page,
    limit,
    isFallback,
  };
}

export async function getAggregatedNewsById(id: string): Promise<AggregatedNewsItem | null> {
  // Handle custom news
  if (id.startsWith('custom-')) {
    const customId = id.replace('custom-', '');
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data, error } = await supabase
        .from("custom_news")
        .select("*")
        .eq("id", customId)
        .single();

      if (error || !data) return getFallbackNewsById(id);

      return {
        id: `custom-${data.id}`,
        title: data.title,
        excerpt: data.excerpt,
        imageUrl: data.image_url || undefined,
        date: new Date(data.created_at).toLocaleDateString("ru-RU"),
        dateTimestamp: new Date(data.created_at).getTime(),
        author: data.author || "Администрация",
        comments: 0,
        url: getNewsPath(`custom-${data.id}`, data.title),
        source: 'custom' as NewsSource,
        htmlBody: data.body || undefined,
      };
    }
    return getFallbackNewsById(id);
  }

  if (id.startsWith('jikan-')) {
    const jikanNews = await getJikanNewsById(id);
    if (!jikanNews) return getFallbackNewsById(id);
    return fromJikan(jikanNews);
  }

  const shikimoriNews = await getNewsById(parseNewsParam(id));
  if (!shikimoriNews) return getFallbackNewsById(id);
  return fromShikimori(shikimoriNews);
}
