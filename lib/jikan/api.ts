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
