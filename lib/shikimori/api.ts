import { BASE_URL, HEADERS, GENRES_MAP } from "./config";
import { shikimoriJson } from "./client";
import { transformAnime, transformTopic } from "./transformers";
import { getAnimeBackdrop } from "./images";
import { generateSearchVariants, isAnimeSafe, normalizeShikimoriUrl, transliterateRuToEn, containsCyrillic } from "./utils";
import { Anime, CatalogFilters, FranchiseItem, NewsItem, ShikimoriAnime, WeeklySchedule } from "./types";

// --- Catalog & Search ---

export async function getAnimeCatalog(filters: CatalogFilters): Promise<Anime[]> {
  const { page = 1, limit = 24, order = 'popularity', genre, status, kind, year, score, search, allowNsfw = false } = filters;
  const params = new URLSearchParams();
  
  params.append('page', String(page));
  params.append('limit', String(limit));
  
  const orderMap: Record<string, string> = { 'popular': 'popularity', 'popularity': 'popularity', 'new': 'aired_on', 'top': 'ranked' };
  params.append('order', orderMap[order] || order || 'popularity');

  if (genre && genre !== 'all') {
    // Функция нормализации жанра (русское название -> ID)
    const normalizeGenre = (g: string) => GENRES_MAP[g] || g;
    
    if (Array.isArray(genre)) {
      // Множественный выбор жанров
      const genreIds = genre.map(normalizeGenre).filter(Boolean);
      if (genreIds.length > 0) {
        params.append('genre', genreIds.join(','));
      }
    } else {
      // Один жанр
      const genreId = normalizeGenre(genre);
      params.append('genre', genreId);
    }
  }
  if (status && status !== 'all') params.append('status', status);
  if (kind && kind !== 'all') params.append('kind', kind);
  if (score && score !== 'all') params.append('score', score);
  if (year && year !== 'all') {
    if (Array.isArray(year)) {
      // Множественный выбор годов
      const yearValues = year.map(y => {
        if (y === '2000s') return '2000_2010';
        if (y === '1990s') return '1990_2000';
        if (y === 'older') return '1917_1990';
        return y;
      }).filter(Boolean);
      if (yearValues.length > 0) {
        params.append('season', yearValues.join(','));
      }
    } else {
      // Один год
      let seasonValue = year;
      if (year === '2000s') seasonValue = '2000_2010';
      if (year === '1990s') seasonValue = '1990_2000';
      if (year === 'older') seasonValue = '1917_1990';
      params.append('season', seasonValue);
    }
  }

  // FORCE CENSOR
  if (!allowNsfw) params.append('censored', 'true');

  // Логика поиска с транслитерацией
  if (search && search.trim() !== '') {
    const trimmedSearch = search.trim();
    const searchVariants = generateSearchVariants(trimmedSearch);
    
    if (searchVariants.length > 1) {
      // Мульти-поиск (оригинал + транслит)
      const promises = searchVariants.map(variant => {
        const p = new URLSearchParams(params);
        p.set('search', variant);
        return shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?${p.toString()}`, { next: { revalidate: 60 } }, { fallback: [] });
      });
      
      const results = (await Promise.all(promises)).flat();
      const unique = new Map<number, ShikimoriAnime>();
      
      results.forEach(item => {
        if (!allowNsfw && !isAnimeSafe(item)) return; // Strict Filter
        if (!unique.has(item.id)) unique.set(item.id, item);
      });

      // Сортировка по релевантности
      const normalize = (s: string) => s.toLowerCase().trim();
      const transformed = await Promise.all(Array.from(unique.values()).map(transformAnime));
      const queries = searchVariants.map(normalize);

      return transformed.sort((a, b) => {
        const getScore = (anime: Anime) => {
          const titles = [anime.title, anime.originalTitle].map(normalize);
          let s = 0;
          queries.forEach(q => {
             if (titles.some(t => t === q)) s += 100;
             else if (titles.some(t => t.includes(q))) s += 50;
          });
          return s + anime.rating;
        };
        return getScore(b) - getScore(a);
      }).slice(0, limit);
    } else {
      params.append('search', trimmedSearch);
    }
  }

  const url = `${BASE_URL}/animes?${params.toString()}`;
  const data = await shikimoriJson<ShikimoriAnime[]>(url, { next: { revalidate: 60 } }, { fallback: [] });
  
  if (!Array.isArray(data)) return [];

  const safeData = allowNsfw ? data : data.filter(isAnimeSafe);
  return await Promise.all(safeData.map(transformAnime));
}

export async function searchAnime(query: string, allowNsfw: boolean = false) {
  // Переиспользуем логику каталога для унификации
  return getAnimeCatalog({ search: query, allowNsfw, limit: 20 });
}

// --- Specific Lists ---

export async function getPopularNow(limit = 12): Promise<Anime[]> {
  const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=ongoing&score=7`, { next: { revalidate: 1800 } }, { fallback: [] });
  return await Promise.all(data.map(transformAnime));
}

export async function getPopularAlways(limit = 12): Promise<Anime[]> {
  const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=released&score=8`, { next: { revalidate: 1800 } }, { fallback: [] });
  return await Promise.all(data.map(transformAnime));
}

export async function getOngoingList(limit = 12): Promise<Anime[]> {
  const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?limit=${limit}&status=ongoing&order=ranked`, { next: { revalidate: 1800 } }, { fallback: [] });
  return await Promise.all(data.map(transformAnime));
}

export async function getTopOfWeek(limit = 30): Promise<Anime[]> {
  const list = await getPopularNow(limit);
  // Подгружаем фоны для первых 5
  for (let i = 0; i < Math.min(list.length, 5); i++) {
    const backdrop = await getAnimeBackdrop(list[i].shikimoriId);
    if (backdrop) list[i].backdrop = backdrop;
  }
  return list;
}

export async function getAnnouncements(limit = 3) {
  const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=anons`, { next: { revalidate: 21600 } }, { fallback: [] });
  return await Promise.all(data.map(transformAnime));
}

// --- Details ---

export async function getAnimeById(id: string) {
  const data = await shikimoriJson<ShikimoriAnime | null>(`${BASE_URL}/animes/${id}`, { next: { revalidate: 3600 }, headers: HEADERS }, { fallback: null });
  if (!data) return null;
  return await transformAnime(data);
}

export async function getAnimeByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?ids=${ids.join(',')}&limit=${ids.length}`, { next: { revalidate: 3600 } }, { fallback: [] });
  return await Promise.all(data.map(transformAnime));
}

export async function getAnimeFranchise(id: string): Promise<FranchiseItem[]> {
  const data = await shikimoriJson<any | null>(`${BASE_URL}/animes/${id}/franchise`, { next: { revalidate: 21600 } }, { fallback: null });
  if (!data) return [];

  const nodes = data.nodes.filter((node: any) => node.url?.startsWith('/animes/'));
  const items = await Promise.all(nodes.map(async (node: any) => {
    // Временная заглушка, так как для франшизы нужен отдельный резолв картинок, но можно использовать дефолтный
    // Для простоты здесь не используем тяжелый resolveBestPoster, чтобы не спамить запросами
    return {
      id: String(node.id),
      title: node.name,
      poster: normalizeShikimoriUrl(node.image_url),
      year: node.year,
      kind: node.kind,
      weight: node.weight,
      isCurrent: node.id === data.current_id
    };
  }));
  return items.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
}

// --- Misc ---

export async function getForumNews(limit = 4): Promise<NewsItem[]> {
  const data = await shikimoriJson<any[]>(`${BASE_URL}/topics?forum=news&limit=${limit}`, { next: { revalidate: 1800 } }, { fallback: [] });
  return data.map(transformTopic);
}

export async function getAnimeCalendar(): Promise<WeeklySchedule> {
  const data = await shikimoriJson<any[]>(`${BASE_URL}/calendar`, { next: { revalidate: 1800 } }, { fallback: [] });
  const schedule: WeeklySchedule = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

  await Promise.all(data.map(async (item) => {
    const day = (new Date(item.next_episode_at).getDay() + 6) % 7; // Сдвиг Вс(0)->6, Пн(1)->0
    const anime = await transformAnime(item.anime);
    anime.episodesCurrent = item.next_episode;
    schedule[day].push(anime);
  }));
  
  return schedule;
}

export async function getHeroRecommendation(watchedIds: string[], bookmarkIds: string[] = [], popularAnime?: Anime[]) {
    // ... (логика рекомендаций, можно оставить упрощенную)
    if (!popularAnime || popularAnime.length === 0) return null;
    const selected = popularAnime[0];
    const full = await getAnimeById(selected.id);
    if (!full) return selected;
    const backdrop = await getAnimeBackdrop(full.shikimoriId);
    return backdrop ? { ...full, backdrop } : full;
}