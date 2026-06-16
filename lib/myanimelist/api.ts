const MAL_API_BASE = 'https://api.myanimelist.net/v2';

// MyAnimeList API v2 interfaces
interface MALManga {
  id: number;
  title: string;
  main_picture?: {
    medium: string;
    large: string;
  };
  alternative_titles?: {
    en?: string;
    ja?: string;
  };
  synopsis?: string;
  mean?: number;
  rank?: number;
  popularity?: number;
  num_list_users?: number;
  num_scoring_users?: number;
  status?: string;
  genres?: Array<{
    id: number;
    name: string;
  }>;
  start_date?: string;
  end_date?: string;
  num_chapters?: number;
  num_volumes?: number;
  media_type?: string;
}

interface MALMangaResponse {
  data: MALManga[];
  paging?: {
    next?: string;
    previous?: string;
  };
}

interface MALMangaDetail extends MALManga {
  background?: string;
  related_anime?: Array<{
    node: {
      id: number;
      title: string;
      main_picture?: {
        medium: string;
      };
    };
    relation_type: string;
  }>;
  related_manga?: Array<{
    node: {
      id: number;
      title: string;
      main_picture?: {
        medium: string;
      };
    };
    relation_type: string;
  }>;
  recommendations?: Array<{
    node: {
      id: number;
      title: string;
      main_picture?: {
        medium: string;
      };
    };
    num_recommendations: number;
  }>;
}

// Reuse common interfaces from jikan/api.ts
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

// Get MAL Client ID from environment or use default
const MAL_CLIENT_ID = process.env.NEXT_PUBLIC_MAL_CLIENT_ID || '';

async function fetchMAL<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(`${MAL_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.append(key, value);
  });

  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  if (MAL_CLIENT_ID) {
    headers['X-MAL-Client-ID'] = MAL_CLIENT_ID;
  }

  const response = await fetch(url.toString(), { headers });

  if (!response.ok) {
    throw new Error(`MAL API error: ${response.status}`);
  }

  return response.json();
}

function convertMALManga(malManga: MALManga): Manga {
  const altTitles: string[] = [];
  
  if (malManga.alternative_titles?.en) {
    altTitles.push(malManga.alternative_titles.en);
  }
  if (malManga.alternative_titles?.ja) {
    altTitles.push(malManga.alternative_titles.ja);
  }

  const imageUrl = malManga.main_picture?.large || malManga.main_picture?.medium;

  // Extract year from start_date (format: "2023-01-01" or "2023")
  let year: number | undefined;
  if (malManga.start_date) {
    const yearMatch = malManga.start_date.match(/^(\d{4})/);
    if (yearMatch) {
      year = parseInt(yearMatch[1], 10);
    }
  }

  return {
    id: malManga.id.toString(),
    title: malManga.title,
    altTitles,
    image: imageUrl,
    description: malManga.synopsis,
    status: malManga.status,
    year,
  };
}

export async function searchMALManga(query: string, page: number = 1, limit: number = 20): Promise<MangaSearchResult> {
  const offset = (page - 1) * limit;

  const response = await fetchMAL<MALMangaResponse>('/manga', {
    q: query,
    limit: limit.toString(),
    offset: offset.toString(),
    fields: 'id,title,main_picture,alternative_titles,synopsis,status,mean,start_date,num_chapters,num_volumes,media_type,genres',
  });

  const results = response.data.map(convertMALManga);

  return {
    currentPage: page,
    hasNextPage: !!response.paging?.next,
    results,
  };
}

export async function getMALMangaRanking(
  rankingType: 'all' | 'manga' | 'novels' | 'oneshots' | 'doujin' | 'manhwa' | 'manhua' = 'all',
  page: number = 1,
  limit: number = 20
): Promise<MangaSearchResult> {
  const offset = (page - 1) * limit;

  const response = await fetchMAL<MALMangaResponse>(`/manga/ranking/${rankingType}`, {
    limit: limit.toString(),
    offset: offset.toString(),
    fields: 'id,title,main_picture,alternative_titles,synopsis,status,mean,start_date,num_chapters,num_volumes,media_type,genres,rank',
  });

  const results = response.data.map(convertMALManga);

  return {
    currentPage: page,
    hasNextPage: !!response.paging?.next,
    results,
  };
}

export async function getMALMangaInfo(id: string): Promise<MangaInfo | null> {
  try {
    const response = await fetchMAL<{ data: MALMangaDetail }>(`/manga/${id}`, {
      fields: 'id,title,main_picture,alternative_titles,synopsis,background,status,mean,rank,popularity,num_list_users,num_scoring_users,start_date,end_date,num_chapters,num_volumes,media_type,genres,related_anime,related_manga,recommendations',
    });

    const manga = response.data;
    const altTitles: string[] = [];
    
    if (manga.alternative_titles?.en) {
      altTitles.push(manga.alternative_titles.en);
    }
    if (manga.alternative_titles?.ja) {
      altTitles.push(manga.alternative_titles.ja);
    }

    const imageUrl = manga.main_picture?.large || manga.main_picture?.medium;

    // Extract year from start_date
    let year: number | undefined;
    if (manga.start_date) {
      const yearMatch = manga.start_date.match(/^(\d{4})/);
      if (yearMatch) {
        year = parseInt(yearMatch[1], 10);
      }
    }

    return {
      id: manga.id.toString(),
      title: manga.title,
      altTitles,
      image: imageUrl,
      description: manga.synopsis,
      status: manga.status,
      genres: manga.genres?.map(g => g.name),
      rating: manga.mean?.toString(),
      year,
      chapters: [], // MAL API doesn't provide chapter information
    };
  } catch (error) {
    console.error('[MAL] Error fetching manga info:', error);
    return null;
  }
}

export async function getMALMangaChapterPages(mangaId: string, chapterId: string): Promise<string[]> {
  // MAL API doesn't provide chapter pages
  // This would need to be implemented with a different API or service
  console.warn('[MAL] Chapter pages not available via MAL API');
  return [];
}
