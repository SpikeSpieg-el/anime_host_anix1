const REMANGA_API_BASE = 'https://api.remanga.org/api';

export interface RemangaChapter {
  id: string;
  chapter: string;
  title?: string;
  lang: string;
  provider: 'remanga';
}

async function fetchRemanga<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': 'https://remanga.org/',
      'Origin': 'https://remanga.org'
    }
  });

  if (!response.ok) {
    throw new Error(`Remanga API error: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, '')
    .trim();
}

interface RemangaSearchResult {
  dir: string;
  rus_name: string;
  en_name: string;
}

export async function searchRemangaSlug(title: string, altTitles: string[] = []): Promise<string | null> {
  try {
    const allSearchQueries = [title, ...altTitles].filter(Boolean);
    const normalizedInputTitles = new Set(allSearchQueries.map(normalizeTitle));

    console.log(`[Remanga] Searching for:`, allSearchQueries.slice(0, 3));

    let firstFallbackSlug: string | null = null;
    const seenDirs = new Set<string>();
    const allResults: RemangaSearchResult[] = [];

    // Fetch search results for queries (limit to top 5 search queries to find better matches)
    for (const query of allSearchQueries.slice(0, 5)) {
      const url = `${REMANGA_API_BASE}/search/?query=${encodeURIComponent(query)}&page=1`;
      console.log(`[Remanga] Searching query: "${query}"`);
      const res = await fetchRemanga<{ content?: Array<RemangaSearchResult> }>(url);
      
      if (res.content && res.content.length > 0) {
        console.log(`[Remanga] Found ${res.content.length} results for "${query}"`);
        if (!firstFallbackSlug) {
          firstFallbackSlug = res.content[0].dir;
        }

        for (const item of res.content) {
          if (!seenDirs.has(item.dir)) {
            seenDirs.add(item.dir);
            allResults.push(item);
          }
        }
      } else {
        console.log(`[Remanga] No results for "${query}"`);
      }
    }

    console.log(`[Remanga] Total unique results collected: ${allResults.length}`);

    // Find exact match among the collected results
    for (const item of allResults) {
      const normRus = normalizeTitle(item.rus_name || '');
      const normEn = normalizeTitle(item.en_name || '');
      const normDir = normalizeTitle(item.dir ? item.dir.replace(/-/g, ' ') : '');

      if (
        normalizedInputTitles.has(normRus) ||
        normalizedInputTitles.has(normEn) ||
        normalizedInputTitles.has(normDir)
      ) {
        console.log(`[Remanga] Exact match found! Dir: ${item.dir} matching title: "${item.en_name}" / "${item.rus_name}"`);
        return item.dir;
      }
    }

    // Try partial matching (check if any normalized input title is contained in result titles)
    for (const item of allResults) {
      const normRus = normalizeTitle(item.rus_name || '');
      const normEn = normalizeTitle(item.en_name || '');
      
      for (const inputTitle of normalizedInputTitles) {
        if (inputTitle.length > 3) { // Only check for longer titles to avoid false matches
          if (normRus.includes(inputTitle) || normEn.includes(inputTitle) || inputTitle.includes(normRus) || inputTitle.includes(normEn)) {
            console.log(`[Remanga] Partial match found! Dir: ${item.dir} matching: "${item.en_name}" / "${item.rus_name}"`);
            return item.dir;
          }
        }
      }
    }

    if (firstFallbackSlug) {
      console.log(`[Remanga] No exact match found, using first search result fallback: ${firstFallbackSlug}`);
      return firstFallbackSlug;
    }

    console.log(`[Remanga] No match found at all for any query`);
    return null;
  } catch (error) {
    console.error('[Remanga] Error searching title slug:', error);
    return null;
  }
}

export async function getRemangaChaptersBySlug(slug: string): Promise<RemangaChapter[]> {
  try {
    // 1. Get title details to fetch the branches (translation groups)
    const detailUrl = `${REMANGA_API_BASE}/titles/${slug}/`;
    const details = await fetchRemanga<{ content?: { branches?: Array<{ id: number }> } }>(detailUrl);
    
    const branchId = details.content?.branches?.[0]?.id;
    if (!branchId) {
      console.warn('[Remanga] No branch found for slug:', slug);
      return [];
    }

    // 2. Fetch all chapters for the branch using paginated requests (Remanga limits to 30 per page)
    let allChapters: Array<{ id: number; chapter: string; name?: string }> = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const chaptersUrl = `${REMANGA_API_BASE}/titles/chapters/?branch_id=${branchId}&limit=100&page=${page}&user_id=null`;
      const chaptersRes = await fetchRemanga<{ content?: Array<{ id: number; chapter: string; name?: string }> }>(chaptersUrl);
      
      if (!chaptersRes.content || !Array.isArray(chaptersRes.content) || chaptersRes.content.length === 0) {
        break;
      }

      allChapters = allChapters.concat(chaptersRes.content);
      
      // Remanga returns max 30 chapters per page. If we got fewer than 30, we've reached the end.
      // Also prevent infinite loops with a safety ceiling of 1500 chapters.
      if (chaptersRes.content.length < 30 || allChapters.length >= 1500) {
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
      lang: 'ru', // Remanga translations are always in Russian
      provider: 'remanga' as const
    }));
  } catch (error) {
    console.error('[Remanga] Error getting chapters:', error);
    return [];
  }
}

export async function getRemangaChapterPages(chapterId: string): Promise<string[]> {
  try {
    const url = `${REMANGA_API_BASE}/titles/chapters/${chapterId}/`;
    const res = await fetchRemanga<{ content?: { pages?: Array<Array<{ link: string }>> } }>(url);
    
    if (!res.content?.pages || !Array.isArray(res.content.pages)) {
      return [];
    }

    const pages = res.content.pages
      .map(p => p?.[0]?.link)
      .filter(Boolean);

    // Filter out all reimg2.org subdomains (img.reimg.org, img3.reimg2.org, etc.) due to impenetrable hotlink protection
    // These images will always return 403 Forbidden
    const filteredPages = pages.filter(url => !url.includes('reimg2.org') && !url.includes('reimg.org'));
    
    if (filteredPages.length === 0 && pages.length > 0) {
      console.warn('[Remanga] All pages filtered out due to reimg.org hotlink protection');
    }
    
    return filteredPages;
  } catch (error) {
    console.error('[Remanga] Error getting chapter pages:', error);
    return [];
  }
}
