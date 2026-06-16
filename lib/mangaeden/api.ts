const MANGAEDEN_PROXY_BASE = '/api/manga/mangaeden';

// MangaEden API interfaces
interface MangaEdenMangaListItem {
  i: string; // ID
  t: string; // Title
  im: string; // Image
  a?: string[]; // Alias
  s: number; // Status (1 = completed, 2 = ongoing)
  ld: number; // Last chapter date
  h: number; // Hits
}

interface MangaEdenMangaInfo {
  title: string;
  description?: string;
  status: number;
  genres?: string[];
  author?: string;
  artist?: string;
  released?: number;
  chapters?: MangaEdenChapter[];
}

interface MangaEdenChapter {
  chapter: number;
  title?: string;
  id: string;
  date: number;
  language: number;
}

interface MangaEdenChapterImages {
  images: Array<{
    h: number;
    w: number;
    x0: number;
    y0: number;
    xf: number;
    yf: number;
  }>;
}

// Common interfaces (reused from other APIs)
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

async function fetchMangaEden<T>(endpoint: string): Promise<T> {
  const url = `${MANGAEDEN_PROXY_BASE}?endpoint=${encodeURIComponent(endpoint)}`;
  console.log(`[MangaEden] Fetching via proxy: ${url}`);

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`MangaEden API error: ${response.status}`);
  }

  return response.json();
}

function convertMangaEdenListItem(item: MangaEdenMangaListItem): Manga {
  return {
    id: item.i,
    title: item.t,
    image: item.im,
    status: item.s === 1 ? 'completed' : item.s === 2 ? 'ongoing' : undefined,
    altTitles: item.a,
  };
}

export async function searchMangaEden(query: string, page: number = 1, limit: number = 20): Promise<MangaSearchResult> {
  try {
    // Get all manga list (MangaEden doesn't have a search endpoint, so we fetch and filter)
    const response = await fetchMangaEden<{ manga: MangaEdenMangaListItem[]; page: number; start: number; end: number; total: number }>(
      '/list/0/'
    );

    const allManga = response.manga;
    
    // Filter by query (case-insensitive)
    const filtered = allManga.filter(item => 
      item.t.toLowerCase().includes(query.toLowerCase()) ||
      item.a?.some(alt => alt.toLowerCase().includes(query.toLowerCase()))
    );

    const offset = (page - 1) * limit;
    const paginatedResults = filtered.slice(offset, offset + limit);

    return {
      currentPage: page,
      hasNextPage: offset + limit < filtered.length,
      results: paginatedResults.map(convertMangaEdenListItem),
    };
  } catch (error) {
    console.error('[MangaEden] Error searching manga:', error);
    return {
      currentPage: page,
      hasNextPage: false,
      results: [],
    };
  }
}

export async function getMangaEdenList(page: number = 1, limit: number = 20): Promise<MangaSearchResult> {
  try {
    const offset = (page - 1) * limit;
    const response = await fetchMangaEden<{ manga: MangaEdenMangaListItem[]; page: number; start: number; end: number; total: number }>(
      `/list/0/?p=${page}&l=${limit}`
    );

    const results = response.manga.map(convertMangaEdenListItem);

    return {
      currentPage: page,
      hasNextPage: response.end < response.total,
      results,
    };
  } catch (error) {
    console.error('[MangaEden] Error getting manga list:', error);
    return {
      currentPage: page,
      hasNextPage: false,
      results: [],
    };
  }
}

export async function getMangaEdenInfo(id: string): Promise<MangaInfo | null> {
  try {
    const response = await fetchMangaEden<MangaEdenMangaInfo>(`/manga/${id}/`);

    const chapters: Chapter[] = [];
    if (response.chapters) {
      response.chapters.forEach(ch => {
        chapters.push({
          id: ch.id,
          chapter: ch.chapter.toString(),
          title: ch.title,
          lang: ch.language === 0 ? 'en' : ch.language === 1 ? 'it' : 'unknown',
        });
      });
    }

    return {
      id,
      title: response.title,
      description: response.description,
      status: response.status === 1 ? 'completed' : response.status === 2 ? 'ongoing' : undefined,
      genres: response.genres,
      year: response.released,
      chapters,
    };
  } catch (error) {
    console.error('[MangaEden] Error fetching manga info:', error);
    return null;
  }
}

export async function getMangaEdenChapterPages(chapterId: string): Promise<string[]> {
  try {
    const response = await fetchMangaEden<MangaEdenChapterImages>(`/chapter/${chapterId}/`);

    if (!response.images || !Array.isArray(response.images)) {
      return [];
    }

    // MangaEden uses a different image format with coordinates
    // We need to construct the image URLs
    // The format is: https://cdn.mangaeden.com/mangas/.../chapter_id/image_number.jpg
    return response.images.map((_, index) => 
      `https://cdn.mangaeden.com/mangas/${chapterId}/${index + 1}.jpg`
    );
  } catch (error) {
    console.error('[MangaEden] Error getting chapter pages:', error);
    return [];
  }
}
