import { getForumNewsPaginated, getNewsById } from "@/lib/shikimori";
import { getJikanNews, getJikanNewsById } from "@/lib/jikan/api";
import { createClient } from "@supabase/supabase-js";
import type { NewsItem } from "@/lib/shikimori/types";
import type { AnimeNewsItem } from "@/lib/jikan/api";

export type NewsSource = 'shikimori' | 'jikan' | 'custom';

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

async function getCustomNews(limit: number): Promise<AggregatedNewsItem[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return [];

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data, error } = await supabase
    .from("custom_news")
    .select("*")
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[getCustomNews] Error:", error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: `custom-${item.id}`,
    title: item.title,
    excerpt: item.excerpt,
    imageUrl: item.image_url || undefined,
    date: new Date(item.created_at).toLocaleDateString("ru-RU"),
    dateTimestamp: new Date(item.created_at).getTime(),
    author: item.author || "Администрация",
    comments: 0,
    url: `/news/custom-${item.id}`,
    source: 'custom' as NewsSource,
    htmlBody: item.body || undefined,
  }));
}

export async function getAggregatedNews(page = 1, limit = 12): Promise<{ items: AggregatedNewsItem[]; hasNextPage: boolean }> {
  const customLimit = Math.min(3, limit); // Показываем до 3 кастомных новостей
  const externalLimit = limit - customLimit;
  
  const jikanCount = Math.min(4, externalLimit);
  const shikimoriLimit = Math.max(1, externalLimit - jikanCount);

  const customPromise = getCustomNews(customLimit);
  const shikimoriPromise = getForumNewsPaginated(page, shikimoriLimit).catch(() => [] as NewsItem[]);
  const jikanPromise = getJikanNews(jikanCount, page).catch(() => [] as AnimeNewsItem[]);

  const [customNews, shikimoriNews, jikanNews] = await Promise.all([customPromise, shikimoriPromise, jikanPromise]);

  console.log(`[getAggregatedNews] Page ${page} — Custom: ${customNews.length}, Shikimori: ${shikimoriNews.length}, Jikan: ${jikanNews.length}`);

  const shikimoriItems = shikimoriNews.slice(0, shikimoriLimit).map(fromShikimori);
  const jikanItems = jikanNews.map(fromJikan);

  const merged = [...customNews, ...shikimoriItems, ...jikanItems];
  merged.sort((a, b) => b.dateTimestamp - a.dateTimestamp);

  const hasNextPage = shikimoriNews.length >= shikimoriLimit || jikanItems.length > 0;
  const items = merged.slice(0, limit);

  console.log(`[getAggregatedNews] Returning ${items.length} items, hasNextPage: ${hasNextPage}`);
  return { items, hasNextPage };
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

      if (error || !data) return null;

      return {
        id: `custom-${data.id}`,
        title: data.title,
        excerpt: data.excerpt,
        imageUrl: data.image_url || undefined,
        date: new Date(data.created_at).toLocaleDateString("ru-RU"),
        dateTimestamp: new Date(data.created_at).getTime(),
        author: data.author || "Администрация",
        comments: 0,
        url: `/news/custom-${data.id}`,
        source: 'custom' as NewsSource,
        htmlBody: data.body || undefined,
      };
    }
    return null;
  }

  if (id.startsWith('jikan-')) {
    const jikanNews = await getJikanNewsById(id);
    if (!jikanNews) return null;
    return fromJikan(jikanNews);
  }

  const shikimoriNews = await getNewsById(id);
  if (!shikimoriNews) return null;
  return fromShikimori(shikimoriNews);
}
