const MANGALIB_PROXY_BASE = '/api/manga/mangalib';

// Расширенный интерфейс главы (добавлено поле volume)
export interface MangalibChapter {
  id: string;
  chapter: string;
  volume?: string;
  title?: string;
  lang: string;
  provider: 'mangalib';
}

// Интерфейсы для типизации API MangaLib
interface MangalibSearchResult {
  id: number;
  slug: string;
  rus_name: string;
  en_name: string;
}

interface MangalibBranch {
  id: number;
  name?: string;
}

interface MangalibMangaDetails {
  data?: {
    branches?: MangalibBranch[];
  };
}

interface MangalibChapterResponseItem {
  id: number;
  chapter: string;
  volume?: string;
  name?: string;
}

async function fetchMangalib<T>(endpoint: string, retries: number = 3): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const url = `${MANGALIB_PROXY_BASE}?endpoint=${encodeURIComponent(endpoint)}`;
      console.log(`[Mangalib] Fetching via proxy: ${url} (attempt ${attempt + 1}/${retries})`);
      
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Mangalib API error: ${response.status}`);
      }

      return response.json() as Promise<T>;
    } catch (error) {
      lastError = error as Error;
      console.warn(`[Mangalib] Fetch attempt ${attempt + 1}/${retries} failed:`, error);
      
      if (attempt < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }
  
  throw lastError || new Error('Mangalib API: Max retries exceeded');
}

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, '')
    .trim();
}

export async function searchMangalibSlug(title: string, altTitles: string[] = []): Promise<string | null> {
  try {
    const allSearchQueries = [title, ...altTitles].filter(Boolean);
    const normalizedInputTitles = new Set(allSearchQueries.map(normalizeTitle));

    console.log(`[Mangalib] Searching for:`, allSearchQueries.slice(0, 3));

    const queriesToExecute = allSearchQueries.slice(0, 5);
    
    // Оптимизация: Выполняем поисковые запросы параллельно
    const searchPromises = queriesToExecute.map(async (query) => {
      const endpoint = `/search/?query=${encodeURIComponent(query)}&page=1`;
      try {
        const res = await fetchMangalib<{ data?: MangalibSearchResult[] }>(endpoint);
        return res.data || [];
      } catch (err) {
        console.warn(`[Mangalib] Search request failed for query "${query}":`, err);
        return [];
      }
    });

    const resultsArray = await Promise.all(searchPromises);
    
    const seenSlugs = new Set<string>();
    const allResults: MangalibSearchResult[] = [];
    let firstFallbackSlug: string | null = null;

    // Собираем результаты в один плоский массив уникальных тайтлов
    for (const results of resultsArray) {
      if (results.length > 0 && !firstFallbackSlug) {
        firstFallbackSlug = results[0].slug;
      }
      for (const item of results) {
        if (!seenSlugs.has(item.slug)) {
          seenSlugs.add(item.slug);
          allResults.push(item);
        }
      }
    }

    console.log(`[Mangalib] Total unique results collected: ${allResults.length}`);

    // 1. Поиск точного совпадения
    for (const item of allResults) {
      const normRus = normalizeTitle(item.rus_name || '');
      const normEn = normalizeTitle(item.en_name || '');
      const normSlug = normalizeTitle(item.slug ? item.slug.replace(/-/g, ' ') : '');

      if (
        normalizedInputTitles.has(normRus) ||
        normalizedInputTitles.has(normEn) ||
        normalizedInputTitles.has(normSlug)
      ) {
        console.log(`[Mangalib] Exact match found! Slug: ${item.slug}`);
        return item.slug;
      }
    }

    // 2. Частичное совпадение
    for (const item of allResults) {
      const normRus = normalizeTitle(item.rus_name || '');
      const normEn = normalizeTitle(item.en_name || '');
      
      for (const inputTitle of normalizedInputTitles) {
        if (inputTitle.length > 3) {
          if (normRus.includes(inputTitle) || normEn.includes(inputTitle) || inputTitle.includes(normRus) || inputTitle.includes(normEn)) {
            console.log(`[Mangalib] Partial match found! Slug: ${item.slug}`);
            return item.slug;
          }
        }
      }
    }

    if (firstFallbackSlug) {
      console.log(`[Mangalib] No exact match found, using first search result fallback: ${firstFallbackSlug}`);
      return firstFallbackSlug;
    }

    console.log(`[Mangalib] No match found at all for any query`);
    return null;
  } catch (error) {
    console.error('[Mangalib] Error searching title slug:', error);
    return null;
  }
}

export async function getMangalibChaptersBySlug(
  slug: string, 
  maxChaptersLimit: number = 3000 // Увеличен лимит для сверхдлинных тайтлов
): Promise<MangalibChapter[]> {
  try {
    const cleanedSlug = slug.replace(/[_\-]+$/, '').trim();
    
    if (cleanedSlug.length <= 2 || /^(ru|en|ja|ko|zh|es|fr|de|it|pt|pl|tr|ar|vi|th|id|ms|hi|bn|uk|be|kk|uz)$/.test(cleanedSlug)) {
      console.warn('[Mangalib] Invalid slug:', cleanedSlug);
      return [];
    }
    
    const detailEndpoint = `/manga/${cleanedSlug}/`;
    const details = await fetchMangalib<MangalibMangaDetails>(detailEndpoint);
    
    const branchId = details.data?.branches?.[0]?.id;
    if (!branchId) {
      console.warn('[Mangalib] No branch found for slug:', cleanedSlug);
      return [];
    }

    let allChapters: MangalibChapterResponseItem[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const chaptersEndpoint = `/manga/${cleanedSlug}/chapters/?branch_id=${branchId}&limit=100&page=${page}`;
      const chaptersRes = await fetchMangalib<{ data?: MangalibChapterResponseItem[] }>(chaptersEndpoint);
      
      if (!chaptersRes.data || !Array.isArray(chaptersRes.data) || chaptersRes.data.length === 0) {
        break;
      }

      allChapters = allChapters.concat(chaptersRes.data);
      
      if (chaptersRes.data.length < 100 || allChapters.length >= maxChaptersLimit) {
        hasMore = false;
      } else {
        page++;
      }
    }

    return allChapters.map(ch => ({
      id: ch.id.toString(),
      chapter: ch.chapter,
      volume: ch.volume,
      title: ch.name || undefined,
      lang: 'ru',
      provider: 'mangalib' as const
    }));
  } catch (error) {
    console.error('[Mangalib] Error getting chapters:', error);
    return [];
  }
}

export async function getMangalibChapterPages(chapterId: string): Promise<string[]> {
  try {
    const endpoint = `/chapter/${chapterId}/`;
    const res = await fetchMangalib<{ data?: { pages?: Array<{ link: string }> } }>(endpoint);
    
    if (!res.data?.pages || !Array.isArray(res.data.pages)) {
      return [];
    }

    return res.data.pages
      .map(p => p?.link)
      .filter(Boolean);
  } catch (error) {
    console.error('[Mangalib] Error getting chapter pages:', error);
    return [];
  }
}