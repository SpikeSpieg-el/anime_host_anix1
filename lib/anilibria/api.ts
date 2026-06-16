const ANILIBRIA_API_BASE = 'https://api.anilibria.tv/v3';

// AniLibria API v3 interfaces
interface AniLibriaNames {
  ru: string;
  en: string;
  alternative?: string[];
}

interface AniLibriaPosters {
  original?: string;
  small?: string;
  medium?: string;
  large?: string;
}

interface AniLibriaStatus {
  code: string;
  string: string;
}

interface AniLibriaType {
  code: string;
  string: string;
  series?: number;
  length?: number;
}

interface AniLibriaSeason {
  code: string;
  string: string;
  year: number;
  week_day: number;
}

interface AniLibriaPlayer {
  episode?: number;
  last?: number;
  list?: Record<string, {
    episode: number;
    hls?: Record<string, string>;
    host?: string;
  }>;
}

interface AniLibriaTorrent {
  torrent_id: number;
  hash: string;
  leechers: number;
  seeders: number;
  downloads: number;
  total_size: number;
  quality: {
    string: string;
    code: string;
  };
  series: {
    string: string;
  };
  uploaded_timestamp: number;
}

interface AniLibriaTorrents {
  list: AniLibriaTorrent[];
}

interface AniLibriaTitle {
  id: number;
  code: string;
  names: AniLibriaNames;
  posters: AniLibriaPosters;
  updated: number;
  last_change: number;
  status: AniLibriaStatus;
  type: AniLibriaType;
  genres: string[];
  season: AniLibriaSeason;
  year: number;
  week_day: number;
  description: string;
  player?: AniLibriaPlayer;
  torrents?: AniLibriaTorrents;
}

// Common interfaces (reused from other APIs)
export interface Anime {
  id: string;
  title: string;
  altTitles?: string[];
  image?: string;
  description?: string;
  status?: string;
  year?: number;
}

export interface AnimeInfo {
  id: string;
  title: string;
  altTitles?: string[];
  image?: string;
  description?: string;
  status?: string;
  genres?: string[];
  rating?: string;
  year?: number;
  episodes?: Episode[];
}

export interface Episode {
  id: string;
  episode: string;
  title?: string;
}

export interface AnimeSearchResult {
  currentPage: number;
  hasNextPage: boolean;
  results: Anime[];
}

async function fetchAniLibria<T>(endpoint: string, params: Record<string, string | string[]> = {}): Promise<T> {
  const url = new URL(`${ANILIBRIA_API_BASE}${endpoint}`);
  Object.entries(params).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(val => url.searchParams.append(key, val));
    } else {
      url.searchParams.append(key, value);
    }
  });

  const response = await fetch(url.toString(), {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });

  if (!response.ok) {
    throw new Error(`AniLibria API error: ${response.status}`);
  }

  return response.json();
}

function convertAniLibriaTitle(title: AniLibriaTitle): Anime {
  const altTitles: string[] = [];
  
  if (title.names.en) {
    altTitles.push(title.names.en);
  }
  if (title.names.alternative) {
    altTitles.push(...title.names.alternative);
  }

  const imageUrl = title.posters?.original || title.posters?.large || title.posters?.medium;

  return {
    id: title.id.toString(),
    title: title.names.ru,
    altTitles,
    image: imageUrl,
    description: title.description,
    status: title.status.string,
    year: title.year,
  };
}

export async function searchAniLibria(query: string, limit: number = 20, page: number = 1): Promise<AnimeSearchResult> {
  const itemsPerPage = limit;
  const offset = (page - 1) * itemsPerPage;

  const response = await fetchAniLibria<{ list: AniLibriaTitle[] }>('/title/search', {
    search: query,
    limit: limit.toString(),
    after: offset.toString(),
    filter: 'id,code,names,posters,description,status,year,genres',
  });

  const results = response.list.map(convertAniLibriaTitle);

  return {
    currentPage: page,
    hasNextPage: results.length === limit,
    results,
  };
}

export async function getAniLibriaUpdates(limit: number = 20, page: number = 1): Promise<AnimeSearchResult> {
  const itemsPerPage = limit;
  const offset = (page - 1) * itemsPerPage;

  const response = await fetchAniLibria<{ list: AniLibriaTitle[] }>('/title/updates', {
    limit: limit.toString(),
    after: offset.toString(),
    filter: 'id,code,names,posters,description,status,year,genres',
  });

  const results = response.list.map(convertAniLibriaTitle);

  return {
    currentPage: page,
    hasNextPage: results.length === limit,
    results,
  };
}

export async function getAniLibriaSchedule(): Promise<Anime[]> {
  const response = await fetchAniLibria<{ list: AniLibriaTitle[] }>('/title/schedule', {
    filter: 'id,code,names,posters,description,status,year,genres,season',
  });

  return response.list.map(convertAniLibriaTitle);
}

export async function getAniLibriaRandom(): Promise<Anime | null> {
  try {
    const response = await fetchAniLibria<{ list: AniLibriaTitle[] }>('/title/random', {
      filter: 'id,code,names,posters,description,status,year,genres',
    });

    if (response.list.length === 0) {
      return null;
    }

    return convertAniLibriaTitle(response.list[0]);
  } catch (error) {
    console.error('[AniLibria] Error fetching random title:', error);
    return null;
  }
}

export async function getAniLibriaInfo(id: string): Promise<AnimeInfo | null> {
  try {
    const response = await fetchAniLibria<AniLibriaTitle>('/title', {
      id: id,
      filter: 'id,code,names,posters,description,status,year,genres,player,type',
      playlist_type: 'array',
    });

    const altTitles: string[] = [];
    
    if (response.names.en) {
      altTitles.push(response.names.en);
    }
    if (response.names.alternative) {
      altTitles.push(...response.names.alternative);
    }

    const imageUrl = response.posters?.original || response.posters?.large || response.posters?.medium;

    // Convert player episodes to Episode interface
    const episodes: Episode[] = [];
    if (response.player?.list) {
      Object.entries(response.player.list).forEach(([key, episode]) => {
        episodes.push({
          id: key,
          episode: episode.episode.toString(),
        });
      });
    }

    return {
      id: response.id.toString(),
      title: response.names.ru,
      altTitles,
      image: imageUrl,
      description: response.description,
      status: response.status.string,
      genres: response.genres,
      year: response.year,
      episodes,
    };
  } catch (error) {
    console.error('[AniLibria] Error fetching title info:', error);
    return null;
  }
}

export async function getAniLibriaByCode(code: string): Promise<AnimeInfo | null> {
  try {
    const response = await fetchAniLibria<AniLibriaTitle>('/title', {
      code: code,
      filter: 'id,code,names,posters,description,status,year,genres,player,type',
      playlist_type: 'array',
    });

    const altTitles: string[] = [];
    
    if (response.names.en) {
      altTitles.push(response.names.en);
    }
    if (response.names.alternative) {
      altTitles.push(...response.names.alternative);
    }

    const imageUrl = response.posters?.original || response.posters?.large || response.posters?.medium;

    // Convert player episodes to Episode interface
    const episodes: Episode[] = [];
    if (response.player?.list) {
      Object.entries(response.player.list).forEach(([key, episode]) => {
        episodes.push({
          id: key,
          episode: episode.episode.toString(),
        });
      });
    }

    return {
      id: response.id.toString(),
      title: response.names.ru,
      altTitles,
      image: imageUrl,
      description: response.description,
      status: response.status.string,
      genres: response.genres,
      year: response.year,
      episodes,
    };
  } catch (error) {
    console.error('[AniLibria] Error fetching title by code:', error);
    return null;
  }
}

export async function getAniLibriaEpisodeStream(animeId: string, episodeId: string): Promise<string | null> {
  try {
    const response = await fetchAniLibria<AniLibriaTitle>('/title', {
      id: animeId,
      filter: 'player',
      playlist_type: 'array',
    });

    const episode = response.player?.list?.[episodeId];
    if (!episode?.hls) {
      return null;
    }

    // Return highest quality available
    const hls = episode.hls as Record<string, string>;
    return hls['1080p'] || hls['720p'] || hls['480p'] || hls['360p'] || null;
  } catch (error) {
    console.error('[AniLibria] Error fetching episode stream:', error);
    return null;
  }
}
