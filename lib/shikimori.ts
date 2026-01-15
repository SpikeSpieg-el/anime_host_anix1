// lib/shikimori.ts

const BASE_URL = "https://shikimori.one/api";
const SITE_URL = "https://shikimori.one";

// Общий заголовок для всех запросов (Обязателен для Shikimori API)
const HEADERS = {
  "User-Agent": "AnimePlatform/1.0 (Client-ID: AnixStream)",
  "Accept": "application/json"
};

async function shikimoriFetch(input: string, init?: RequestInit & { next?: any }) {
  const controller = new AbortController();
  const timeoutMs = 12_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      headers: {
        ...HEADERS,
        ...(init?.headers ?? {})
      },
      signal: controller.signal
    });
  } catch (error) {
    const cause = (error as any)?.cause;
    const details = {
      url: input,
      name: (error as any)?.name,
      message: (error as any)?.message,
      causeName: cause?.name,
      causeCode: cause?.code,
      causeMessage: cause?.message
    };
    throw Object.assign(new Error("Shikimori fetch failed"), { details, originalError: error });
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeShikimoriUrl(value: string): string {
  const raw = (value ?? "").trim();
  if (!raw) return raw;

  if (raw.startsWith("https//")) return `https://${raw.slice("https//".length)}`;
  if (raw.startsWith("http//")) return `http://${raw.slice("http//".length)}`;

  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;
  if (raw.startsWith("/")) return `${SITE_URL}${raw}`;

  return `${SITE_URL}/${raw}`;
}

// --- Interfaces ---

export interface ShikimoriAnime {
  id: number;
  name: string;
  russian: string;
  image: {
    original: string;
    preview: string;
  };
  score: string;
  episodes: number;
  episodes_aired: number;
  status: string;
  aired_on: string;
  kind: string;
  description?: string;
  genres?: { name: string; russian: string }[];
}

export interface ShikimoriFranchiseNode {
  id: number;
  date?: number;
  name: string;
  image_url: string;
  url: string;
  year: number | null;
  kind: string;
  weight: number;
}

export interface ShikimoriFranchise {
  links: {
    id: number;
    source_id: number;
    target_id: number;
    source: number;
    target: number;
    weight: number;
    relation: string;
  }[];
  nodes: ShikimoriFranchiseNode[];
  current_id: number;
}

export interface FranchiseItem {
  id: string;
  title: string;
  poster: string;
  year?: number;
  kind?: string;
  weight: number;
  isCurrent: boolean;
}

export interface Anime {
  id: string;
  shikimoriId: string;
  title: string;
  originalTitle: string;
  poster: string;
  backdrop?: string;
  rating: number;
  year: number;
  airedOn?: string;
  episodesCurrent: number;
  episodesTotal: number;
  status: string;
  description: string;
  genres: string[];
  quality: string;
}

interface ShikimoriScreenshot {
  original: string;
  preview: string;
}

export interface ShikimoriTopic {
  id: number;
  topic_title: string;
  body: string;
  html_body: string;
  html_footer: string;
  created_at: string;
  comments_count: number;
  forum: {
    id: number;
    position: number;
    name: string;
    permalink: string;
    url: string;
  };
  user: {
    id: number;
    nickname: string;
    avatar: string;
  };
}

export interface NewsItem {
  id: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  date: string;
  author: string;
  comments: number;
  url: string;
}

export interface CatalogFilters {
  page?: number;
  limit?: number;
  order?: string;
  genre?: string;
  status?: string;
  kind?: string;
  year?: string;
  score?: string;
  search?: string;
}

// Словарь жанров
export const GENRES_MAP: Record<string, string> = {
  "Экшен": "1",
  "Приключения": "2",
  "Комедия": "4",
  "Драма": "8",
  "Фэнтези": "10",
  "Магия": "16",
  "Ужасы": "14",
  "Детектив": "7",
  "Романтика": "22",
  "Фантастика": "24",
  "Повседневность": "13",
  "Спорт": "30",
  "Триллер": "41",
  "Исекай": "543",
  "Сёнэн": "27",
  "Сэйнэн": "42",
  "Сёдзё": "25",
  "Дзёсэй": "43",
  "Музыка": "19",
  "Психология": "40",
  "Сверхъестественное": "37",
  "Мистика": "11",
  "Пародия": "12",
  "Эротика": "9",
};

// --- Helpers ---

/**
 * Вспомогательная функция для выбора лучшего доступного постера.
 * Если Shikimori отдает заглушку, идем на Anilist.
 */
async function resolveBestPoster(shikimoriUrl: string, romajiName: string, russianName: string): Promise<string> {
  const url = normalizeShikimoriUrl(shikimoriUrl);
  
  // Признаки того, что обложка на Shikimori отсутствует или слишком маленькая
  const isMissing = 
    !url || 
    url.includes("missing") || 
    url.includes("stub") || 
    url.includes("x96") || 
    url.includes("x48");

  if (isMissing) {
    // Пробуем найти на Anilist
    const fallback = await getAnilistPoster(romajiName);
    if (fallback) return fallback;

    // Если и там нет, генерируем красивый плейсхолдер
    return `https://placehold.co/400x600/18181b/orange/png?text=${encodeURIComponent(russianName || romajiName)}`;
  }

  return url;
}

/**
 * Пытается найти постер через Anilist API.
 */
async function getAnilistPoster(searchTitle: string): Promise<string | null> {
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query ($search: String) {
            Media (search: $search, type: ANIME, sort: SEARCH_MATCH) {
              coverImage {
                extraLarge
                large
              }
            }
          }
        `,
        variables: { search: searchTitle }
      }),
      next: { revalidate: 86400 } 
    });

    if (!response.ok) return null;
    const json = await response.json();
    const media = json?.data?.Media;
    return media?.coverImage?.extraLarge || media?.coverImage?.large || null;
  } catch (e) {
    return null;
  }
}

async function transformAnime(item: ShikimoriAnime): Promise<Anime> {
  // Используем новую функцию для постера
  const posterUrl = await resolveBestPoster(item.image.original, item.name, item.russian);

  return {
    id: String(item.id),
    shikimoriId: String(item.id),
    title: item.russian || item.name,
    originalTitle: item.name,
    poster: posterUrl,
    rating: parseFloat(item.score) || 0,
    year: item.aired_on ? new Date(item.aired_on).getFullYear() : new Date().getFullYear(),
    airedOn: item.aired_on || undefined,
    episodesCurrent: item.episodes_aired,
    episodesTotal: item.episodes || 0,
    status: item.status === 'anons' ? 'Announcement' : item.status === 'ongoing' ? 'Ongoing' : 'Completed',
    description: item.description?.replace(/\[.*?\]/g, "") || "Описание отсутствует...",
    genres: item.genres?.map(g => g.russian) || [],
    quality: item.kind?.toUpperCase() || "TV",
  };
}

function transformTopic(topic: ShikimoriTopic): NewsItem {
  const rawText = topic.body || "";
  const excerpt = rawText.length > 150 ? rawText.slice(0, 150) + "..." : rawText;

  let imageUrl: string | undefined;
  if (topic.html_body) {
    const match = topic.html_body.match(/<img[^>]+src="([^"]+)"/);
    if (match && match[1]) {
      imageUrl = match[1];
      if (!imageUrl.startsWith("http")) {
        imageUrl = normalizeShikimoriUrl(imageUrl);
      }
    }
  }

  return {
    id: String(topic.id),
    title: topic.topic_title,
    excerpt: excerpt,
    imageUrl: imageUrl,
    date: new Date(topic.created_at).toLocaleDateString('ru-RU'),
    author: topic.user.nickname,
    comments: topic.comments_count,
    url: `${SITE_URL}${topic.forum.url}/${topic.id}`,
  };
}

async function getAnimeBackdrop(shikimoriId: string): Promise<string | null> {
  try {
    const res = await shikimoriFetch(`${BASE_URL}/animes/${shikimoriId}/screenshots`);
    if (!res.ok) return null;
    const data: ShikimoriScreenshot[] = await res.json();

    const first = data?.[0]?.original;
    if (!first) return null;

    const url = normalizeShikimoriUrl(first);
    if (!url) return null;
    if (url.includes("missing")) return null;

    return url;
  } catch {
    return null;
  }
}

// --- Fetch Functions ---

export async function getAnimeList(limit = 20, order = 'popularity') {
  try {
    const res = await shikimoriFetch(`${BASE_URL}/animes?limit=${limit}&order=${order}&status=ongoing,released&score=6`);
    if (!res.ok) throw new Error("Failed to fetch");
    const data: ShikimoriAnime[] = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getPopularNow(limit = 12): Promise<Anime[]> {
  try {
    const res = await shikimoriFetch(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=ongoing&score=7`);
    if (!res.ok) return [];

    const data: ShikimoriAnime[] = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

export async function getPopularAlways(limit = 12): Promise<Anime[]> {
  try {
    const res = await shikimoriFetch(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=released&score=8`);
    if (!res.ok) return [];
    const data: ShikimoriAnime[] = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

export async function getOngoingList(limit = 12): Promise<Anime[]> {
  try {
    const res = await shikimoriFetch(`${BASE_URL}/animes?limit=${limit}&status=ongoing&order=ranked`);
    if (!res.ok) return [];
    const data: ShikimoriAnime[] = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

export async function getForumNews(limit = 4): Promise<NewsItem[]> {
  try {
    const res = await shikimoriFetch(`${BASE_URL}/topics?forum=news&limit=${limit}`);
    if (!res.ok) return [];
    const data: ShikimoriTopic[] = await res.json();
    return data.map(transformTopic);
  } catch (error) {
    return [];
  }
}

export async function getAnimeById(id: string) {
  try {
    const res = await shikimoriFetch(`${BASE_URL}/animes/${id}`, {
      next: { revalidate: 300 },
      headers: HEADERS
    });
    if (!res.ok) return null;
    const data: ShikimoriAnime = await res.json();
    return await transformAnime(data);
  } catch (error) {
    return null;
  }
}

export async function getAnimeFranchise(id: string): Promise<FranchiseItem[]> {
  try {
    const res = await shikimoriFetch(`${BASE_URL}/animes/${id}/franchise`);
    if (!res.ok) return [];

    const data: ShikimoriFranchise = await res.json();
    const nodes = data.nodes.filter((node) => node.url?.startsWith('/animes/'));

    const items: FranchiseItem[] = await Promise.all(nodes.map(async (node) => {
      let posterUrl = normalizeShikimoriUrl(node.image_url);
      let title = node.name;
      
      // Проверяем на "битую" картинку Shikimori
      if (posterUrl.includes("missing") || posterUrl.includes("x96") || posterUrl.includes("x48")) {
        // Получаем полную информацию об аниме, чтобы взять romaji название
        try {
          const animeRes = await shikimoriFetch(`${BASE_URL}/animes/${node.id}`);
          if (animeRes.ok) {
            const animeData: ShikimoriAnime = await animeRes.json();
            // Используем romaji (animeData.name) для поиска в Anilist
            const fallback = await getAnilistPoster(animeData.name);
            if (fallback) {
              posterUrl = fallback;
            } else {
              posterUrl = `https://placehold.co/400x600/18181b/orange/png?text=${encodeURIComponent(title)}`;
            }
          } else {
            posterUrl = `https://placehold.co/400x600/18181b/orange/png?text=${encodeURIComponent(title)}`;
          }
        } catch {
          posterUrl = `https://placehold.co/400x600/18181b/orange/png?text=${encodeURIComponent(title)}`;
        }
      }

      return {
        id: String(node.id),
        title: title,
        poster: posterUrl,
        year: node.year ?? undefined,
        kind: node.kind,
        weight: node.weight,
        isCurrent: node.id === data.current_id
      };
    }));

    return items.sort((a, b) => {
      if ((a.year ?? 0) !== (b.year ?? 0)) return (a.year ?? 0) - (b.year ?? 0);
      return a.weight - b.weight;
    });
  } catch (error) {
    console.error(error);
    return [];
  }
}

/**
 * Поиск (Live Search)
 * Включает фильтрацию по оценке >= 6, чтобы убрать мусор.
 */
export async function searchAnime(query: string) {
  try {
    const res = await shikimoriFetch(`${BASE_URL}/animes?search=${encodeURIComponent(query)}&limit=10&score=6`);
    const data = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

export async function getAnnouncements(limit = 3) {
  try {
    const res = await shikimoriFetch(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=anons`);
    const data = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

export async function getAnimeByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const idsString = ids.join(',');
  try {
    const res = await shikimoriFetch(`${BASE_URL}/animes?ids=${idsString}`);
    if (!res.ok) return [];
    const data: ShikimoriAnime[] = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

export async function getTopOfWeek(limit = 30): Promise<Anime[]> {
  try {
    const res = await shikimoriFetch(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=ongoing&score=7`);
    if (!res.ok) return [];

    const data: ShikimoriAnime[] = await res.json();
    const animeList = await Promise.all(data.map(transformAnime));

    const animeWithBackdrop = await Promise.all(
      animeList.map(async (anime) => {
        const backdrop = await getAnimeBackdrop(anime.shikimoriId);
        return backdrop ? { ...anime, backdrop } : anime;
      })
    );

    return animeWithBackdrop;
  } catch (error) {
    return [];
  }
}

async function isSameFranchise(animeId: string, watchedAnimeId: string): Promise<boolean> {
  try {
    const res = await shikimoriFetch(`${BASE_URL}/animes/${watchedAnimeId}/franchise`);
    if (!res.ok) return false;

    const data: ShikimoriFranchise = await res.json();
    return data.nodes.some((node) => node.id === parseInt(animeId));
  } catch {
    return false;
  }
}

async function canRecommendFranchise(animeId: string, watchedIds: string[]): Promise<boolean> {
  try {
    const res = await shikimoriFetch(`${BASE_URL}/animes/${animeId}/franchise`);
    if (!res.ok) return true;

    const data: ShikimoriFranchise = await res.json();
    const currentNode = data.nodes.find((node) => node.id === parseInt(animeId));
    
    if (!currentNode) return true;

    const earlierParts = data.nodes.filter((node) => {
      if (node.id === parseInt(animeId)) return false;
      return node.weight < currentNode.weight || 
             (node.weight === currentNode.weight && node.year && currentNode.year && node.year < currentNode.year);
    });

    if (earlierParts.length > 0) {
      const watchedSet = new Set(watchedIds.map(id => parseInt(id)));
      const hasWatchedEarlier = earlierParts.some(part => watchedSet.has(part.id));
      
      if (!hasWatchedEarlier) {
        return false;
      }
    }

    return true;
  } catch {
    return true;
  }
}

export async function getHeroRecommendation(watchedIds: string[], bookmarkIds: string[] = [], popularAnime?: Anime[]) {
  try {
    // Объединяем watchedIds и bookmarkIds для исключения
    const excludedIds = [...new Set([...watchedIds, ...bookmarkIds])];
    
    // 1. Случай, если истории нет или она пустая
    if (!watchedIds || watchedIds.length === 0 || !watchedIds[0]) {
      const list = popularAnime && popularAnime.length > 0 ? popularAnime : await getPopularNow(10);
      if (!list || list.length === 0) return null;
      
      const filteredList = list.filter(a => !excludedIds.includes(a.id));
      const selected = filteredList[Math.floor(Math.random() * filteredList.length)] || list[0];
      const backdrop = await getAnimeBackdrop(selected.shikimoriId);
      return backdrop ? { ...selected, backdrop } : selected;
    }

    // 2. Получаем последнее просмотренное аниме
    const lastWatchedId = watchedIds[0];
    const response = await shikimoriFetch(`${BASE_URL}/animes/${lastWatchedId}`);

    if (!response.ok) {
      if (!popularAnime || popularAnime.length === 0) return null;
      const filteredList = popularAnime.filter(a => !excludedIds.includes(a.id));
      const selected = filteredList[0] || popularAnime[0];
      const backdrop = await getAnimeBackdrop(selected.shikimoriId);
      return backdrop ? { ...selected, backdrop } : selected;
    }

    const lastAnime = await response.json();
    const genreIds = lastAnime.genres?.map((g: any) => g.id).slice(0, 3).join(',');

    // 3. Ищем похожие, исключая просмотренные и закладки
    const recommendedRes = await shikimoriFetch(
      `${BASE_URL}/animes?genre=${genreIds}&order=popularity&limit=20&exclude_ids=${excludedIds.join(',')}`,
      undefined
    );

    if (!recommendedRes.ok) {
      if (!popularAnime || popularAnime.length === 0) return null;
      const filteredList = popularAnime.filter(a => !excludedIds.includes(a.id));
      const selected = filteredList[0] || popularAnime[0];
      const backdrop = await getAnimeBackdrop(selected.shikimoriId);
      return backdrop ? { ...selected, backdrop } : selected;
    }

    const recommended = await recommendedRes.json();

    if (recommended.length > 0) {
      // Фильтруем рекомендации, исключая сиквелы без просмотра предыдущих частей
      const validRecommendations: any[] = [];
      
      for (const item of recommended) {
        const canRecommend = await canRecommendFranchise(String(item.id), watchedIds);
        if (canRecommend) {
          validRecommendations.push(item);
        }
        if (validRecommendations.length >= 5) break;
      }

      if (validRecommendations.length > 0) {
        const selected = validRecommendations[Math.floor(Math.random() * validRecommendations.length)];
        const anime = await getAnimeById(String(selected.id));
        if (!anime) return null;

        const backdrop = await getAnimeBackdrop(anime.shikimoriId);
        return backdrop ? { ...anime, backdrop } : anime;
      }
    }

    if (!popularAnime || popularAnime.length === 0) return null;
    const filteredList = popularAnime.filter(a => !excludedIds.includes(a.id));
    const selected = filteredList[0] || popularAnime[0];
    const backdrop = await getAnimeBackdrop(selected.shikimoriId);
    return backdrop ? { ...selected, backdrop } : selected;

  } catch (error) {
    const details = (error as any)?.details;
    console.error("Recommendation error:", details ?? error);
    if (!popularAnime || popularAnime.length === 0) return null;
    const selected = popularAnime[0];
    const backdrop = await getAnimeBackdrop(selected.shikimoriId);
    return backdrop ? { ...selected, backdrop } : selected;
  }
}

export async function getAnimeCatalog(filters: CatalogFilters): Promise<Anime[]> {

  const {
    page = 1,
    limit = 24,
    order = 'popularity',
    genre,
    status,
    kind,
    year,
    score,
    search
  } = filters;

  try {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', String(limit));

    // 1. Сортировка
    let apiOrder = order;
    if (order === 'popularity') apiOrder = 'popularity';
    if (order === 'aired_on') apiOrder = 'aired_on';
    if (order === 'ranked') apiOrder = 'ranked';
    params.append('order', apiOrder);

    // 2. Фильтры (добавляем только если это не "all" и значение есть)
    if (genre && genre !== 'all') params.append('genre', genre);
    if (status && status !== 'all') params.append('status', status);
    if (kind && kind !== 'all') params.append('kind', kind);
    if (score && score !== 'all') params.append('score', score);

    // 3. Обработка года (Shikimori параметр 'season')
    if (year && year !== 'all') {
      let seasonValue = year;
      if (year === '2000s') seasonValue = '2000_2010';
      if (year === '1990s') seasonValue = '1990_2000';
      if (year === 'older') seasonValue = '1917_1990';
      params.append('season', seasonValue);
    }

    // 4. Поиск
    if (search && search.trim() !== '') {
      params.append('search', search.trim());
    }

    const url = `${BASE_URL}/animes?${params.toString()}`;
    
    const res = await shikimoriFetch(url, {
      next: { revalidate: 60 }, // Уменьшил кэш для каталога для актуальности
      headers: HEADERS
    });

    if (!res.ok) {
      console.error(`API Error: ${res.status}`, await res.text());
      return [];
    }
    
    const data: ShikimoriAnime[] = await res.json();
    
    // Если ничего не пришло, возвращаем пустой массив
    if (!Array.isArray(data)) return [];

    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    console.error("Catalog fetch error:", error);
    return [];
  }
}