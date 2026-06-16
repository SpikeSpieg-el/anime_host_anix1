const COMICK_PROXY_BASE = '/api/manga/comick';

export interface ComickManga {
  id: string;
  title: string;
  altTitles?: string[];
  image?: string;
  description?: string;
  status?: string;
  year?: number;
  genres?: string[];
}

export interface ComickChapter {
  id: string;
  chapter: string;
  title?: string;
  lang?: string;
}

async function fetchComick<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${COMICK_PROXY_BASE}`);
  url.searchParams.append('endpoint', endpoint);
  
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  console.log(`[Comick] Fetching via proxy: ${url.toString()}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url.toString(), {
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const text = await response.text();
      console.error(`[Comick] API error ${response.status}: ${text.substring(0, 200)}`);
      throw new Error(`Comick API error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[Comick] Response received for ${endpoint}`);
    return data;
  } catch (error) {
    clearTimeout(timeout);
    console.error(`[Comick] Fetch error for ${url.toString()}:`, error);
    throw error;
  }
}

export async function searchComick(query: string, limit: number = 20): Promise<ComickManga[]> {
  try {
    const response = await fetchComick<{ comics: any[] }>('/search', {
      q: query,
      limit: limit.toString(),
    });

    if (!response.comics || !Array.isArray(response.comics)) {
      console.warn('[Comick] No comics in search response');
      return [];
    }

    return response.comics.map(comic => ({
      id: comic.slug || comic.id,
      title: comic.title || comic.name || 'Unknown',
      altTitles: comic.altTitles || [],
      image: comic.md_covers?.[0]?.b2key 
        ? `https://meo.comick.pictures/${comic.md_covers[0].b2key}` 
        : undefined,
      description: comic.desc,
      status: comic.status,
      year: comic.year,
      genres: comic.genres?.map((g: any) => g.name || g) || [],
    }));
  } catch (error) {
    console.error('[Comick] Error searching manga:', error);
    return [];
  }
}

export async function getComickChapters(comicId: string): Promise<ComickChapter[]> {
  try {
    const response = await fetchComick<{ chapters: any[] }>(`/comic/${comicId}/chapters`, {
      lang: 'en',
      limit: '100',
    });

    if (!response.chapters || !Array.isArray(response.chapters)) {
      return [];
    }

    const chapters = response.chapters
      .filter((ch: any) => ch.chap)
      .map((ch: any) => ({
        id: ch.hid || ch.id,
        chapter: ch.chap,
        title: ch.title,
        lang: ch.lang || 'en',
      }));

    // Remove duplicates
    const seen = new Set<string>();
    return chapters.filter(ch => {
      if (seen.has(ch.chapter)) return false;
      seen.add(ch.chapter);
      return true;
    });
  } catch (error) {
    console.error('[Comick] Error getting chapters:', error);
    return [];
  }
}

export async function getComickChapterPages(chapterId: string): Promise<string[]> {
  try {
    const response = await fetchComick<{ chapter: any; images: any[] }>(`/chapter/${chapterId}`);

    if (!response.images || !Array.isArray(response.images)) {
      return [];
    }

    return response.images.map((img: any) => {
      if (typeof img === 'string') return img;
      return img.url || img.b2key ? `https://meo.comick.pictures/${img.b2key || img.url}` : undefined;
    }).filter(Boolean) as string[];
  } catch (error) {
    console.error('[Comick] Error getting chapter pages:', error);
    return [];
  }
}

export async function getComickInfo(comicId: string): Promise<ComickManga | null> {
  try {
    const response = await fetchComick<{ comic: any }>(`/comic/${comicId}`);

    if (!response.comic) {
      return null;
    }

    const comic = response.comic;
    return {
      id: comic.slug || comic.id,
      title: comic.title || comic.name || 'Unknown',
      altTitles: comic.altTitles || [],
      image: comic.md_covers?.[0]?.b2key 
        ? `https://meo.comick.pictures/${comic.md_covers[0].b2key}` 
        : undefined,
      description: comic.desc || comic.description,
      status: comic.status,
      year: comic.year,
      genres: comic.genres?.map((g: any) => g.name || g) || [],
    };
  } catch (error) {
    console.error('[Comick] Error fetching comic info:', error);
    return null;
  }
}

export async function getPopularComick(limit: number = 20): Promise<ComickManga[]> {
  try {
    // Use trending endpoint
    const response = await fetchComick<{ comics: any[] }>('/trending', {
      limit: limit.toString(),
    });

    if (!response.comics || !Array.isArray(response.comics)) {
      console.warn('[Comick] No comics in popular response');
      return [];
    }

    return response.comics.map(comic => ({
      id: comic.slug || comic.id,
      title: comic.title || comic.name || 'Unknown',
      altTitles: comic.altTitles || [],
      image: comic.md_covers?.[0]?.b2key 
        ? `https://meo.comick.pictures/${comic.md_covers[0].b2key}` 
        : undefined,
      description: comic.desc,
      status: comic.status,
      year: comic.year,
      genres: comic.genres?.map((g: any) => g.name || g) || [],
    }));
  } catch (error) {
    console.error('[Comick] Error getting popular manga:', error);
    return [];
  }
}
