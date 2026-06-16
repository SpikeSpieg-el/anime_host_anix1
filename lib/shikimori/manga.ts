import { BASE_URL, HEADERS } from './config';
import { shikimoriJson } from './client';

export interface ShikimoriMangaChapter {
  id: string;
  chapter: string;
  title?: string;
  lang: string;
  provider: 'shikimori';
  url?: string; // External link to reading site
}

interface ShikimoriManga {
  id: number;
  name: string;
  russian: string;
  english: string[];
  synonyms: string[];
  kind: string;
  score: number;
  status: string;
  volumes: number;
  chapters: number;
  image: {
    original: string;
    preview: string;
  };
  description: string;
  genres: Array<{ id: number; name: string; russian: string }>;
}

interface ShikimoriSearchResult {
  id: number;
  name: string;
  russian: string;
  english: string[];
  kind: string;
  score: number;
}

function normalizeTitle(t: string): string {
  return t
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]/gi, '')
    .trim();
}

/**
 * Search for manga on Shikimori by title
 * Returns the Shikimori manga ID
 */
export async function searchShikimoriMangaId(title: string, altTitles: string[] = []): Promise<number | null> {
  try {
    const allSearchQueries = [title, ...altTitles].filter(Boolean);
    const normalizedInputTitles = new Set(allSearchQueries.map(normalizeTitle));

    console.log(`[ShikimoriManga] Searching for:`, allSearchQueries.slice(0, 3));

    let firstFallbackId: number | null = null;
    const seenIds = new Set<number>();
    const allResults: ShikimoriSearchResult[] = [];

    // Fetch search results for queries
    for (const query of allSearchQueries.slice(0, 5)) {
      const url = `${BASE_URL}/mangas/search?q=${encodeURIComponent(query)}&limit=10`;
      console.log(`[ShikimoriManga] Searching query: "${query}"`);
      
      try {
        const res = await shikimoriJson<ShikimoriSearchResult[]>(url, { next: { revalidate: 3600 } }, { fallback: [] });
        
        if (res && res.length > 0) {
          console.log(`[ShikimoriManga] Found ${res.length} results for "${query}"`);
          if (!firstFallbackId) {
            firstFallbackId = res[0].id;
          }

          for (const item of res) {
            if (!seenIds.has(item.id)) {
              seenIds.add(item.id);
              allResults.push(item);
            }
          }
        } else {
          console.log(`[ShikimoriManga] No results for "${query}"`);
        }
      } catch (error) {
        console.error(`[ShikimoriManga] Error searching for "${query}":`, error);
      }
    }

    console.log(`[ShikimoriManga] Total unique results collected: ${allResults.length}`);

    // Find exact match among the collected results
    for (const item of allResults) {
      const normRus = normalizeTitle(item.russian || '');
      const normEn = normalizeTitle(item.name || '');
      
      // Check all English names
      for (const enName of item.english || []) {
        const normEnAlt = normalizeTitle(enName);
        if (normalizedInputTitles.has(normRus) || normalizedInputTitles.has(normEn) || normalizedInputTitles.has(normEnAlt)) {
          console.log(`[ShikimoriManga] Exact match found! ID: ${item.id} matching: "${item.name}" / "${item.russian}"`);
          return item.id;
        }
      }

      if (normalizedInputTitles.has(normRus) || normalizedInputTitles.has(normEn)) {
        console.log(`[ShikimoriManga] Exact match found! ID: ${item.id} matching: "${item.name}" / "${item.russian}"`);
        return item.id;
      }
    }

    // Try partial matching
    for (const item of allResults) {
      const normRus = normalizeTitle(item.russian || '');
      const normEn = normalizeTitle(item.name || '');
      
      for (const inputTitle of normalizedInputTitles) {
        if (inputTitle.length > 3) {
          if (normRus.includes(inputTitle) || normEn.includes(inputTitle) || inputTitle.includes(normRus) || inputTitle.includes(normEn)) {
            console.log(`[ShikimoriManga] Partial match found! ID: ${item.id} matching: "${item.name}" / "${item.russian}"`);
            return item.id;
          }
        }
      }
    }

    if (firstFallbackId) {
      console.log(`[ShikimoriManga] No exact match found, using first search result fallback: ${firstFallbackId}`);
      return firstFallbackId;
    }

    console.log(`[ShikimoriManga] No match found at all for any query`);
    return null;
  } catch (error) {
    console.error('[ShikimoriManga] Error searching manga ID:', error);
    return null;
  }
}

/**
 * Get manga details from Shikimori
 */
export async function getShikimoriMangaInfo(id: number): Promise<ShikimoriManga | null> {
  try {
    const url = `${BASE_URL}/mangas/${id}`;
    const data = await shikimoriJson<ShikimoriManga | null>(url, { next: { revalidate: 3600 }, headers: HEADERS }, { fallback: null });
    return data;
  } catch (error) {
    console.error('[ShikimoriManga] Error getting manga info:', error);
    return null;
  }
}

/**
 * Get external manga links from Shikimori
 * Shikimori provides links to external manga reading sites
 */
export async function getShikimoriMangaLinks(id: number): Promise<Array<{ url: string; kind: string }>> {
  try {
    const url = `${BASE_URL}/mangas/${id}/external_links`;
    const data = await shikimoriJson<Array<{ url: string; kind: string }>>(url, { next: { revalidate: 3600 } }, { fallback: [] });
    return data || [];
  } catch (error) {
    console.error('[ShikimoriManga] Error getting external links:', error);
    return [];
  }
}

/**
 * Search for manga and get external links to Russian manga sites
 * Returns slugs for Remanga and Mangalib to fetch chapters directly
 */
export async function searchShikimoriMangaLinks(title: string, altTitles: string[] = []): Promise<{
  remangaSlug: string | null;
  mangalibSlug: string | null;
}> {
  try {
    const mangaId = await searchShikimoriMangaId(title, altTitles);
    
    if (!mangaId) {
      console.log('[ShikimoriManga] No manga ID found');
      return { remangaSlug: null, mangalibSlug: null };
    }

    const mangaInfo = await getShikimoriMangaInfo(mangaId);
    
    if (!mangaInfo) {
      console.log('[ShikimoriManga] No manga info found');
      return { remangaSlug: null, mangalibSlug: null };
    }

    console.log(`[ShikimoriManga] Found manga: ${mangaInfo.russian || mangaInfo.name} (${mangaInfo.chapters} chapters)`);

    // Get external links to find reading sites
    const externalLinks = await getShikimoriMangaLinks(mangaId);
    
    let remangaSlug: string | null = null;
    let mangalibSlug: string | null = null;

    // Extract slugs from external links
    for (const link of externalLinks) {
      const url = link.url.toLowerCase();
      
      // Extract Remanga slug: https://remanga.org/manga/xxx -> xxx
      if (url.includes('remanga.org') && !remangaSlug) {
        const match = url.match(/remanga\.org\/manga\/([^\/]+)/);
        if (match) {
          remangaSlug = match[1];
          console.log(`[ShikimoriManga] Found Remanga slug: ${remangaSlug}`);
        }
      }
      
      // Extract Mangalib slug: https://mangalib.me/xxx -> xxx
      // Filter out language codes (ru, en, etc.) and short slugs
      if (url.includes('mangalib.me') && !mangalibSlug) {
        const match = url.match(/mangalib\.me\/([^\/\?]+)/);
        if (match) {
          const potentialSlug = match[1];
          // Skip if it's a language code or too short to be a valid slug
          if (potentialSlug.length > 2 && !/^(ru|en|ja|ko|zh|es|fr|de|it|pt|pl|tr|ar|vi|th|id|ms|hi|bn|uk|be|kk|uz)$/.test(potentialSlug)) {
            mangalibSlug = potentialSlug;
            console.log(`[ShikimoriManga] Found Mangalib slug: ${mangalibSlug}`);
          }
        }
      }
    }

    return { remangaSlug, mangalibSlug };
  } catch (error) {
    console.error('[ShikimoriManga] Error searching manga links:', error);
    return { remangaSlug: null, mangalibSlug: null };
  }
}

/**
 * Get chapter pages from Shikimori
 * Note: Shikimori doesn't provide direct page access
 * This function returns empty and relies on fallback to other providers
 */
export async function getShikimoriChapterPages(chapterId: string): Promise<string[]> {
  console.log('[ShikimoriManga] Shikimori does not provide direct page access. Relying on fallback providers.');
  return [];
}
