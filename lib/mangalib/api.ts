const MANGALIB_API_BASE = 'https://api.mangalib.me/api';

export interface MangalibChapter {
  id: string;
  chapter: string;
  title?: string;
  lang: string;
  provider: 'mangalib';
}

async function fetchMangalib<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://mangalib.me/',
      'Origin': 'https://mangalib.me'
    }
  });

  if (!response.ok) {
    throw new Error(`Mangalib API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, '')
    .trim();
}

interface MangalibSearchResult {
  id: number;
  slug: string;
  rus_name: string;
  en_name: string;
}

export async function searchMangalibSlug(title: string, altTitles: string[] = []): Promise<string | null> {
  try {
    const allSearchQueries = [title, ...altTitles].filter(Boolean);
    const normalizedInputTitles = new Set(allSearchQueries.map(normalizeTitle));

    console.log(`[Mangalib] Searching for:`, allSearchQueries.slice(0, 3));

    let firstFallbackSlug: string | null = null;
    const seenSlugs = new Set<string>();
    const allResults: MangalibSearchResult[] = [];

    // Fetch search results for queries (limit to top 5 search queries)
    for (const query of allSearchQueries.slice(0, 5)) {
      const url = `${MANGALIB_API_BASE}/search/?query=${encodeURIComponent(query)}&page=1`;
      console.log(`[Mangalib] Searching query: "${query}"`);
      const res = await fetchMangalib<{ data?: Array<MangalibSearchResult> }>(url);
      
      if (res.data && res.data.length > 0) {
        console.log(`[Mangalib] Found ${res.data.length} results for "${query}"`);
        if (!firstFallbackSlug) {
          firstFallbackSlug = res.data[0].slug;
        }

        for (const item of res.data) {
          if (!seenSlugs.has(item.slug)) {
            seenSlugs.add(item.slug);
            allResults.push(item);
          }
        }
      } else {
        console.log(`[Mangalib] No results for "${query}"`);
      }
    }

    console.log(`[Mangalib] Total unique results collected: ${allResults.length}`);

    // Find exact match among the collected results
    for (const item of allResults) {
      const normRus = normalizeTitle(item.rus_name || '');
      const normEn = normalizeTitle(item.en_name || '');
      const normSlug = normalizeTitle(item.slug ? item.slug.replace(/-/g, ' ') : '');

      if (
        normalizedInputTitles.has(normRus) ||
        normalizedInputTitles.has(normEn) ||
        normalizedInputTitles.has(normSlug)
      ) {
        console.log(`[Mangalib] Exact match found! Slug: ${item.slug} matching title: "${item.en_name}" / "${item.rus_name}"`);
        return item.slug;
      }
    }

    // Try partial matching
    for (const item of allResults) {
      const normRus = normalizeTitle(item.rus_name || '');
      const normEn = normalizeTitle(item.en_name || '');
      
      for (const inputTitle of normalizedInputTitles) {
        if (inputTitle.length > 3) {
          if (normRus.includes(inputTitle) || normEn.includes(inputTitle) || inputTitle.includes(normRus) || inputTitle.includes(normEn)) {
            console.log(`[Mangalib] Partial match found! Slug: ${item.slug} matching: "${item.en_name}" / "${item.rus_name}"`);
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

export async function getMangalibChaptersBySlug(slug: string): Promise<MangalibChapter[]> {
  try {
    // Get title details to fetch the branch
    const detailUrl = `${MANGALIB_API_BASE}/manga/${slug}/`;
    const details = await fetchMangalib<{ data?: { branches?: Array<{ id: number }> } }>(detailUrl);
    
    const branchId = details.data?.branches?.[0]?.id;
    if (!branchId) {
      console.warn('[Mangalib] No branch found for slug:', slug);
      return [];
    }

    // Fetch all chapters for the branch
    let allChapters: Array<{ id: number; chapter: string; name?: string }> = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const chaptersUrl = `${MANGALIB_API_BASE}/manga/${slug}/chapters/?branch_id=${branchId}&limit=100&page=${page}`;
      const chaptersRes = await fetchMangalib<{ data?: Array<{ id: number; chapter: string; name?: string }> }>(chaptersUrl);
      
      if (!chaptersRes.data || !Array.isArray(chaptersRes.data) || chaptersRes.data.length === 0) {
        break;
      }

      allChapters = allChapters.concat(chaptersRes.data);
      
      if (chaptersRes.data.length < 100 || allChapters.length >= 1500) {
        hasMore = false;
      } else {
        page++;
      }
    }

    if (allChapters.length === 0) {
      return [];
    }

    return allChapters.map(ch => ({
      id: ch.id.toString(),
      chapter: ch.chapter,
      title: ch.name || undefined,
      lang: 'ru', // Mangalib translations are in Russian
      provider: 'mangalib' as const
    }));
  } catch (error) {
    console.error('[Mangalib] Error getting chapters:', error);
    return [];
  }
}

export async function getMangalibChapterPages(chapterId: string): Promise<string[]> {
  try {
    const url = `${MANGALIB_API_BASE}/chapter/${chapterId}/`;
    const res = await fetchMangalib<{ data?: { pages?: Array<{ link: string }> } }>(url);
    
    if (!res.data?.pages || !Array.isArray(res.data.pages)) {
      return [];
    }

    const pages = res.data.pages
      .map(p => p?.link)
      .filter(Boolean);

    return pages;
  } catch (error) {
    console.error('[Mangalib] Error getting chapter pages:', error);
    return [];
  }
}
