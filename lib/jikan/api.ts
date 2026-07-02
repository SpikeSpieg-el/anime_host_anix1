import { findShikimoriAnimeMatch, findShikimoriAnimeByMalId, toLinkedAnimeFromShikimori } from "@/lib/shikimori";
import type { LinkedAnime } from "@/lib/shikimori/types";

const JIKAN_API_BASE = 'https://api.jikan.moe/v4';

interface JikanManga {
  mal_id: number;
  title: string;
  title_english?: string;
  title_japanese?: string;
  titles: Array<{
    type: string;
    title: string;
  }>;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
    webp: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  synopsis?: string;
  status?: string;
  publishing?: boolean;
  score?: number;
  scored_by?: number;
  rank?: number;
  popularity?: number;
  members?: number;
  favorites?: number;
  genres?: Array<{
    mal_id: number;
    type: string;
    name: string;
    url: string;
  }>;
  published?: {
    from?: string;
    to?: string;
    prop?: {
      from?: {
        day?: number;
        month?: number;
        year?: number;
      };
      to?: {
        day?: number;
        month?: number;
        year?: number;
      };
      string?: string;
    };
  };
  chapters?: number;
  volumes?: number;
}

interface JikanResponse<T> {
  data: T[];
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: {
      count: number;
      total: number;
      per_page: number;
    };
  };
}

interface JikanMangaDetail {
  mal_id: number;
  title: string;
  title_english?: string;
  title_japanese?: string;
  titles: Array<{
    type: string;
    title: string;
  }>;
  images: {
    jpg: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
    webp: {
      image_url: string;
      small_image_url: string;
      large_image_url: string;
    };
  };
  synopsis?: string;
  background?: string;
  status?: string;
  publishing?: boolean;
  score?: number;
  scored_by?: number;
  rank?: number;
  popularity?: number;
  members?: number;
  favorites?: number;
  genres?: Array<{
    mal_id: number;
    type: string;
    name: string;
    url: string;
  }>;
  published?: {
    from?: string;
    to?: string;
    prop?: {
      from?: {
        day?: number;
        month?: number;
        year?: number;
      };
      to?: {
        day?: number;
        month?: number;
        year?: number;
      };
      string?: string;
    };
  };
  chapters?: number;
  volumes?: number;
}

export interface Manga {
  id: string;
  title: string;
  altTitles?: string[];
  image?: string;
  description?: string;
  status?: string;
  year?: number;
}

export interface MangaInfo {
  id: string;
  title: string;
  altTitles?: string[];
  image?: string;
  description?: string;
  status?: string;
  genres?: string[];
  rating?: string;
  year?: number;
  chapters?: Chapter[];
}

export interface Chapter {
  id: string;
  chapter: string;
  title?: string;
  lang?: string;
}

export interface MangaSearchResult {
  currentPage: number;
  hasNextPage: boolean;
  results: Manga[];
}

async function fetchJikan<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${JIKAN_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`Jikan API error: ${response.status}`);
  }

  return response.json();
}

function convertJikanManga(jikanManga: JikanManga): Manga {
  const altTitles = jikanManga.titles
    .filter(t => t.type !== 'Default' && t.type !== 'English')
    .map(t => t.title);

  const imageUrl = jikanManga.images.jpg.large_image_url;

  return {
    id: jikanManga.mal_id.toString(),
    title: jikanManga.title_english || jikanManga.title,
    altTitles,
    image: imageUrl,
    description: jikanManga.synopsis,
    status: jikanManga.status,
    year: jikanManga.published?.prop?.from?.year,
  };
}

export async function searchManga(query: string, page: number = 1): Promise<MangaSearchResult> {
  const limit = 20;
  const offset = (page - 1) * limit;

  const response = await fetchJikan<JikanResponse<JikanManga>>('/manga', {
    q: query,
    limit: limit.toString(),
    page: page.toString(),
    sfw: 'true',
  });

  const results = response.data.map(convertJikanManga);

  return {
    currentPage: page,
    hasNextPage: response.pagination.has_next_page,
    results,
  };
}

export async function getPopularManga(page: number = 1): Promise<MangaSearchResult> {
  const limit = 20;

  const response = await fetchJikan<JikanResponse<JikanManga>>('/top/manga', {
    page: page.toString(),
    limit: limit.toString(),
  });

  const results = response.data.map(convertJikanManga);

  return {
    currentPage: page,
    hasNextPage: response.pagination.has_next_page,
    results,
  };
}

export async function getRecentManga(page: number = 1): Promise<MangaSearchResult> {
  const limit = 20;

  const response = await fetchJikan<JikanResponse<JikanManga>>('/manga', {
    page: page.toString(),
    limit: limit.toString(),
    order_by: 'score',
    sort: 'desc',
    sfw: 'true',
  });

  const results = response.data.map(convertJikanManga);

  return {
    currentPage: page,
    hasNextPage: response.pagination.has_next_page,
    results,
  };
}

export async function getMangaInfo(id: string): Promise<MangaInfo | null> {
  try {
    const response = await fetchJikan<{ data: JikanMangaDetail }>(`/manga/${id}/full`);

    const manga = response.data;
    const altTitles = manga.titles
      .filter(t => t.type !== 'Default' && t.type !== 'English')
      .map(t => t.title);

    const imageUrl = manga.images.jpg.large_image_url;

    return {
      id: manga.mal_id.toString(),
      title: manga.title_english || manga.title,
      altTitles,
      image: imageUrl,
      description: manga.synopsis,
      status: manga.status,
      genres: manga.genres?.map(g => g.name),
      rating: manga.score?.toString(),
      year: manga.published?.prop?.from?.year,
      chapters: [], // Jikan doesn't provide chapter information
    };
  } catch (error) {
    console.error('Error fetching manga info:', error);
    return null;
  }
}

export async function getMangaChapterPages(mangaId: string, chapterId: string): Promise<string[]> {
  // Jikan API doesn't provide chapter pages
  // This would need to be implemented with a different API or service
  console.warn('Chapter pages not available via Jikan API');
  return [];
}

// --- Anime News ---

interface JikanNewsArticle {
  mal_id: number;
  url: string;
  title: string;
  date: string;
  author_username: string;
  author_url: string;
  forum_url: string;
  images: {
    jpg: {
      image_url: string;
      small_image_url?: string;
      large_image_url?: string;
    };
  };
  comments: number;
  excerpt: string;
}

interface JikanNewsResponse {
  data: JikanNewsArticle[];
  pagination: {
    last_visible_page: number;
    has_next_page: boolean;
    current_page: number;
    items: { count: number; total: number; per_page: number };
  };
}

interface JikanAnimeBrief {
  mal_id: number;
  title: string;
  title_english?: string;
  images: {
    jpg: { large_image_url: string; image_url: string };
  };
}

export interface AnimeNewsItem {
  id: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  date: string;
  author: string;
  comments: number;
  url: string;
  source: 'jikan';
  animeId: number;
  animeTitle: string;
  animeImage?: string;
  linkedAnime?: LinkedAnime;
  htmlBody?: string;
}

async function fetchJikanCached<T>(endpoint: string, params: Record<string, string> = {}, revalidate = 1800): Promise<T> {
  const url = new URL(`${JIKAN_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      if (attempt > 0) {
        const delay = 1000 * attempt;
        console.log(`[fetchJikanCached] Retry ${attempt} after ${delay}ms for ${endpoint}`);
        await new Promise(r => setTimeout(r, delay));
      }

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        next: { revalidate },
      });

      if (response.status === 429) {
        console.warn(`[fetchJikanCached] Rate limited on ${endpoint}, will retry...`);
        lastError = new Error(`Jikan API rate limited: 429`);
        continue;
      }

      if (!response.ok) {
        throw new Error(`Jikan API error: ${response.status}`);
      }

      return response.json();
    } catch (e) {
      lastError = e as Error;
      if (attempt < 2) continue;
    }
  }

  throw lastError || new Error(`Jikan API failed after retries`);
}

function transformJikanNews(article: any, animeId: number, animeTitle: string, animeImage?: string, linkedAnime?: LinkedAnime, htmlBody?: string): AnimeNewsItem {
  const images = article.images?.jpg || {};
  return {
    id: `jikan-${animeId}-${article.mal_id}`,
    title: article.title || 'Без названия',
    excerpt: article.excerpt || article.title || '',
    imageUrl: images.large_image_url || images.image_url || undefined,
    date: article.date ? new Date(article.date).toLocaleDateString('ru-RU') : new Date().toLocaleDateString('ru-RU'),
    author: article.author_username || 'MAL',
    comments: article.comments || 0,
    url: article.url || `https://myanimelist.net/anime/${animeId}`,
    source: 'jikan',
    animeId,
    animeTitle,
    animeImage,
    linkedAnime,
    htmlBody,
  };
}

/**
 * Resolve the matching Shikimori anime for a Jikan/MAL anime, so news can link to
 * the correct internal anime page. Tries a direct MAL-ID lookup first (verified via
 * Shikimori's `myanimelist_id` field, so it's exact), falling back to title matching.
 */
async function resolveLinkedAnime(malId: number, titles: (string | undefined)[]): Promise<LinkedAnime | undefined> {
  try {
    const direct = await findShikimoriAnimeByMalId(malId);
    if (direct) return toLinkedAnimeFromShikimori(direct);
  } catch (e) {
    console.error('[resolveLinkedAnime] Direct MAL id lookup failed:', e);
  }

  const uniqueTitles = Array.from(new Set(titles.filter((t): t is string => !!t && t.trim().length > 0)));
  if (uniqueTitles.length === 0) return undefined;

  try {
    const [primary, ...alt] = uniqueTitles;
    const match = await findShikimoriAnimeMatch(primary, alt);
    return match ? toLinkedAnimeFromShikimori(match) : undefined;
  } catch (e) {
    console.error('[resolveLinkedAnime] Failed to match anime title:', e);
    return undefined;
  }
}

const MAL_NEWS_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

async function fetchMalNewsPageHtml(malNewsId: number): Promise<string | null> {
  try {
    const res = await fetch(`https://myanimelist.net/news/${malNewsId}`, {
      headers: MAL_NEWS_HEADERS,
      next: { revalidate: 86400 },
    });
    if (!res.ok) return null;
    return await res.text();
  } catch (e) {
    console.error(`[fetchMalNewsPageHtml] Failed for news ${malNewsId}:`, e);
    return null;
  }
}

function extractMalNewsContent(html: string): string | null {
  const match = html.match(/<div class="content clearfix">([\s\S]*?)\s*<\/div>\s*<div class="tags">/);
  return match ? match[1].trim() : null;
}

/**
 * Sanitize MAL's raw news HTML: convert manga links to our internal catalog (MAL manga IDs
 * map 1:1 to ours), verify+convert anime links to internal `/watch/{id}` when Shikimori has a
 * confirmed match, and make all remaining external links open in a new tab.
 */
async function sanitizeMalNewsHtml(html: string): Promise<string> {
  let result = html;

  result = result.replace(
    /href="https?:\/\/myanimelist\.net\/manga\/(\d+)\/?[^"]*"/g,
    (_m, id) => `href="/manga/${id}"`
  );

  const animeIdRegex = /href="https?:\/\/myanimelist\.net\/anime\/(\d+)\/?[^"]*"/g;
  const ids = new Set<number>();
  let m: RegExpExecArray | null;
  while ((m = animeIdRegex.exec(result)) !== null) {
    ids.add(parseInt(m[1], 10));
  }

  const idList = Array.from(ids);
  const idMap = new Map<number, number | null>();
  const concurrency = 5;
  for (let i = 0; i < idList.length; i += concurrency) {
    const batch = idList.slice(i, i + concurrency);
    const results = await Promise.all(batch.map(async (id) => {
      try {
        const match = await findShikimoriAnimeByMalId(id);
        return [id, match ? match.id : null] as const;
      } catch {
        return [id, null] as const;
      }
    }));
    results.forEach(([id, shikimoriId]) => idMap.set(id, shikimoriId));
  }

  result = result.replace(
    /href="https?:\/\/myanimelist\.net\/anime\/(\d+)\/?[^"]*"/g,
    (fullMatch, idStr) => {
      const shikimoriId = idMap.get(parseInt(idStr, 10));
      return shikimoriId ? `href="/watch/${shikimoriId}"` : fullMatch;
    }
  );

  // Open all remaining absolute links (external sites, unmatched anime links) in a new tab
  result = result.replace(
    /<a(?![^>]*target=)([^>]*href="https?:\/\/[^"]+")/g,
    '<a$1 target="_blank" rel="noopener noreferrer"'
  );

  return result;
}

/**
 * Fetch and sanitize the full body of a MAL news article by scraping its news page,
 * since Jikan's API only exposes a short excerpt. Returns undefined on any failure
 * so callers can gracefully fall back to the excerpt.
 */
async function getMalNewsFullBody(malNewsId: number): Promise<string | undefined> {
  try {
    const html = await fetchMalNewsPageHtml(malNewsId);
    if (!html) return undefined;
    const raw = extractMalNewsContent(html);
    if (!raw) return undefined;
    return await sanitizeMalNewsHtml(raw);
  } catch (e) {
    console.error(`[getMalNewsFullBody] Failed for news ${malNewsId}:`, e);
    return undefined;
  }
}

function normalizeForRelevance(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9а-яё]/gi, '');
}

/**
 * MAL news articles are fetched from a specific anime's "/news" feed, but many articles there
 * are generic multi-title roundups (e.g. "North American Anime & Manga Releases for April")
 * that get cross-posted to every anime's feed. Only treat an article as actually being
 * "about" the anime if its own title/excerpt mentions that anime's name.
 */
function isArticleAboutAnime(article: any, titles: string[]): boolean {
  const text = normalizeForRelevance(`${article.title || ''} ${article.excerpt || ''}`);
  return titles.some(t => {
    const norm = normalizeForRelevance(t);
    return norm.length > 2 && text.includes(norm);
  });
}

export async function getJikanAnimeNews(animeId: number, animeTitle?: string, animeImage?: string, limit = 5, altTitles: string[] = []): Promise<AnimeNewsItem[]> {
  try {
    const response = await fetchJikanCached<JikanNewsResponse>(`/anime/${animeId}/news`, { limit: limit.toString() }, 1800);
    if (!response.data || !Array.isArray(response.data)) return [];

    const allTitles = [animeTitle, ...altTitles].filter((t): t is string => !!t);
    const linkedAnime = await resolveLinkedAnime(animeId, allTitles);

    return response.data.map(a => {
      const relevant = isArticleAboutAnime(a, allTitles);
      return transformJikanNews(a, animeId, animeTitle || '', animeImage, relevant ? linkedAnime : undefined);
    });
  } catch (e) {
    console.error(`[getJikanAnimeNews] Failed for anime ${animeId}:`, e);
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function getJikanNews(limit = 12, page = 1): Promise<AnimeNewsItem[]> {
  try {
    const perPage = 25;
    const topAnimeCount = Math.min(25, Math.ceil((page * limit) / 2) + 5);
    console.log(`[getJikanNews] Fetching ${topAnimeCount} top airing anime from Jikan (page ${page})...`);
    const topResponse = await fetchJikanCached<{ data: JikanAnimeBrief[] }>('/top/anime', {
      filter: 'airing',
      limit: topAnimeCount.toString(),
    }, 3600);

    const topAnime = topResponse.data || [];
    console.log(`[getJikanNews] Got ${topAnime.length} top anime from Jikan`);
    if (topAnime.length === 0) return [];

    const results: AnimeNewsItem[] = [];
    for (let i = 0; i < topAnime.length; i++) {
      const anime = topAnime[i];
      try {
        if (i > 0) await sleep(600);
        console.log(`[getJikanNews] Fetching news for anime ${anime.mal_id} (${anime.title_english || anime.title})...`);
        const news = await getJikanAnimeNews(
          anime.mal_id,
          anime.title_english || anime.title,
          anime.images?.jpg?.large_image_url || anime.images?.jpg?.image_url,
          perPage,
          [anime.title, anime.title_english].filter(Boolean) as string[]
        );
        console.log(`[getJikanNews] Got ${news.length} news for anime ${anime.mal_id}`);
        results.push(...news);
        if (results.length >= page * limit * 2) break;
      } catch (e) {
        console.error(`[getJikanNews] Failed to fetch news for anime ${anime.mal_id}:`, e);
      }
    }

    console.log(`[getJikanNews] Total news collected: ${results.length}`);

    results.sort((a, b) => {
      const dateA = new Date(a.date.split('.').reverse().join('-')).getTime() || 0;
      const dateB = new Date(b.date.split('.').reverse().join('-')).getTime() || 0;
      return dateB - dateA;
    });

    const offset = (page - 1) * limit;
    return results.slice(offset, offset + limit);
  } catch (e) {
    console.error('[getJikanNews] Failed:', e);
    return [];
  }
}

export async function getJikanNewsById(id: string): Promise<AnimeNewsItem | null> {
  try {
    const parts = id.replace('jikan-', '').split('-');
    const animeId = parseInt(parts[0], 10);
    const newsId = parseInt(parts[1], 10);
    if (!animeId || !newsId) return null;

    const response = await fetchJikanCached<JikanNewsResponse>(`/anime/${animeId}/news`, { limit: '100' }, 3600);
    const article = response.data.find(a => a.mal_id === newsId);
    if (!article) return null;

    let animeTitle = '';
    let animeImage: string | undefined;
    let altTitles: string[] = [];
    try {
      const animeResp = await fetchJikanCached<{ data: JikanAnimeBrief }>(`/anime/${animeId}`, {}, 3600);
      animeTitle = animeResp.data.title_english || animeResp.data.title || '';
      animeImage = animeResp.data.images?.jpg?.large_image_url;
      altTitles = [animeResp.data.title, animeResp.data.title_english].filter(Boolean) as string[];
    } catch {}

    const allTitles = [animeTitle, ...altTitles].filter((t): t is string => !!t);
    const linkedAnime = await resolveLinkedAnime(animeId, allTitles);
    const relevant = isArticleAboutAnime(article, allTitles);
    const htmlBody = await getMalNewsFullBody(article.mal_id);

    return transformJikanNews(article, animeId, animeTitle, animeImage, relevant ? linkedAnime : undefined, htmlBody);
  } catch {
    return null;
  }
}
