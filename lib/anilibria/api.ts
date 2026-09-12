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

interface AniLibriaHlsQualities {
  fhd?: string;
  hd?: string;
  sd?: string;
}

interface AniLibriaPlayer {
  episode?: number;
  last?: number;
  /** Хост для построения ссылок на поток (api v3), напр. "cache.libria.fun". */
  host?: string;
  list?: Record<string, {
    episode: number;
    hls?: AniLibriaHlsQualities;
    host?: string;
  }>;
}

export interface AniLibriaTorrent {
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
  /** Путь для скачивания .torrent из api v3: "/public/torrent/download.php?id=...". */
  url?: string;
  magnet?: string;
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
    });

    const player = response.player;
    const episode = player?.list?.[episodeId] ?? player?.list?.[String(Number(episodeId))];
    if (!episode?.hls) {
      return null;
    }

    // В api v3 ссылки относительные, домен лежит в player.host
    // (пример из документации: https://cache.libria.fun/videos/media/ts/...)
    const host = player?.host || episode.host;
    if (!host) return null;

    const hls = episode.hls;
    const path = hls.fhd || hls.hd || hls.sd || null;
    if (!path) return null;

    return `https://${host}${path}`;
  } catch (error) {
    console.error('[AniLibria] Error fetching episode stream:', error);
    return null;
  }
}

/** Обёртка над одним качеством серии AniLibria. */
export interface AniLibriaEpisodeQuality {
  /** Человекочитаемая метка качества: "1080p", "720p", "480p". */
  label: string;
  /** Абсолютная ссылка на HLS-плейлист. */
  url: string;
}

export interface AniLibriaPlayback {
  titleId: number;
  code: string;
  /** Русское название релиза. */
  title: string;
  /** Все доступные качества для запрошенной серии. */
  qualities: AniLibriaEpisodeQuality[];
  torrents: AniLibriaTorrent[];
}

/** Абсолютная ссылка на .torrent-файл AniLibria. */
export function getAniLibriaTorrentDownloadUrl(torrent: AniLibriaTorrent): string {
  const base = 'https://www.anilibria.tv';
  if (torrent.url) {
    return torrent.url.startsWith('http') ? torrent.url : `${base}${torrent.url}`;
  }
  return `${base}/public/torrent/download.php?id=${torrent.torrent_id}`;
}

/**
 * Нормализация названия для нечувствительного к регистру/пунктуации сопоставления.
 */
export function normalizeTitleForMatch(value: string): string {
  return value
    .toLowerCase()
    .replaceAll('ё', 'е')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function titleMatches(needle: string, haystack: string): boolean {
  const a = normalizeTitleForMatch(needle);
  const b = normalizeTitleForMatch(haystack);
  if (!a || !b) return false;
  return a === b || (a.length >= 4 && b.includes(a)) || (b.length >= 4 && a.includes(b));
}

function mapAniLibriaHls(
  player: AniLibriaPlayer,
  episodeId: number | string,
): AniLibriaEpisodeQuality[] {
  const host = player.host;
  const episode = player.list?.[String(episodeId)] ?? player.list?.[String(Number(episodeId))];
  if (!host || !episode?.hls) return [];

  const hls = episode.hls;
  const qualityLabels: Array<[string, string | undefined]> = [
    ['1080p', hls.fhd],
    ['720p', hls.hd],
    ['480p', hls.sd],
  ];

  return qualityLabels
    .filter(([, path]) => Boolean(path))
    .map(([label, path]) => ({ label, url: `https://${host}${path}` }));
}

/**
 * Ищет релиз AniLibria по любому из вариантов названия и возвращает
 * HLS-качества и торренты для запрошенной серии. AniLibria — полностью
 * русскоязычный стриминг, поэтому это первый источник в цепочке запасного плеера.
 */
export async function findAniLibriaPlayback(
  titleVariants: string[],
  episode: number,
): Promise<AniLibriaPlayback | null> {
  const variants = titleVariants.filter((value) => value && value.trim().length > 0);
  if (variants.length === 0) return null;

  for (const variant of variants) {
    let list: AniLibriaTitle[];
    try {
      const response = await fetchAniLibria<{ list: AniLibriaTitle[] }>('/title/search', {
        search: variant,
        limit: '8',
        filter: 'id,code,names,player,type',
      });
      list = response.list ?? [];
    } catch {
      continue;
    }

    const match = list.find((release) =>
      titleMatches(variant, release.names?.ru || '') ||
      titleMatches(variant, release.names?.en || '') ||
      (release.names?.alternative ?? []).some((alt) => titleMatches(variant, alt)),
    );

    if (!match) continue;

    try {
      const full = await fetchAniLibria<AniLibriaTitle>('/title', {
        id: String(match.id),
        filter: 'id,code,names,player,torrents',
      });

      const qualities = full.player ? mapAniLibriaHls(full.player, episode) : [];
      if (qualities.length === 0) continue;

      return {
        titleId: full.id,
        code: full.code,
        title: full.names?.ru || full.names?.en || variant,
        qualities,
        torrents: full.torrents?.list ?? [],
      };
    } catch {
      continue;
    }
  }

  return null;
}
