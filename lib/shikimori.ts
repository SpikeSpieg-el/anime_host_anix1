// lib/shikimori.ts

const BASE_URL = "https://shikimori.one/api";
const SITE_URL = "https://shikimori.one";

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

export interface Anime {
  id: string;
  shikimoriId: string;
  title: string;
  originalTitle: string;
  poster: string;
  rating: number;
  year: number;
  episodesCurrent: number;
  episodesTotal: number;
  status: string;
  description: string;
  genres: string[];
  quality: string;
}

export interface CatalogFilters {
  page?: number;
  limit?: number;
  order?: string;
  genre?: string;
  status?: string;
  kind?: string;
  year?: string;
  search?: string;
}

// Исправленный словарь жанров (без дубликатов и с правильными ID)
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

// Помощник: Трансформация данных
async function transformAnime(item: ShikimoriAnime): Promise<Anime> {
  let posterUrl = SITE_URL + item.image.original;

  if (posterUrl.includes("missing_original") || posterUrl.includes("missing_preview")) {
    posterUrl = `https://placehold.co/400x600/18181b/orange/png?text=${encodeURIComponent(item.russian || item.name)}`;
  }

  return {
    id: String(item.id),
    shikimoriId: String(item.id),
    title: item.russian || item.name,
    originalTitle: item.name,
    poster: posterUrl,
    rating: parseFloat(item.score) || 0,
    year: item.aired_on ? new Date(item.aired_on).getFullYear() : 2025,
    episodesCurrent: item.episodes_aired,
    episodesTotal: item.episodes || 0,
    status: item.status === 'ongoing' ? 'Ongoing' : 'Completed',
    description: item.description?.replace(/\[.*?\]/g, "") || "Описание отсутствует...",
    genres: item.genres?.map(g => g.russian) || [],
    quality: item.kind?.toUpperCase() || "TV",
  };
}

export async function getAnimeList(limit = 20, order = 'popularity') {
  try {
    const res = await fetch(
      `${BASE_URL}/animes?limit=${limit}&order=${order}&status=ongoing,released&score=7`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error("Failed to fetch");
    const data: ShikimoriAnime[] = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getAnimeById(id: string) {
  try {
    const res = await fetch(`${BASE_URL}/animes/${id}`);
    if (!res.ok) return null;
    const data: ShikimoriAnime = await res.json();
    return await transformAnime(data);
  } catch (error) {
    return null;
  }
}

export async function searchAnime(query: string) {
  try {
    const res = await fetch(`${BASE_URL}/animes?search=${encodeURIComponent(query)}&limit=10`);
    const data = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

export async function getRecentUpdates(limit = 3) {
  try {
    const res = await fetch(
      `${BASE_URL}/animes?limit=${limit}&order=aired_on&status=ongoing`,
      { next: { revalidate: 1800 } }
    );
    const data = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

export async function getAnnouncements(limit = 3) {
  try {
    const res = await fetch(
      `${BASE_URL}/animes?limit=${limit}&order=popularity&status=anons`,
      { next: { revalidate: 86400 } }
    );
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
    const res = await fetch(`${BASE_URL}/animes?ids=${idsString}`);
    if (!res.ok) return [];
    const data: ShikimoriAnime[] = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

// 9. Алгоритм рекомендации (динамический баннер)
export async function getHeroRecommendation(watchedIds: string[], popularAnime?: Anime[]) {
  try {
    // Если истории нет, берем случайное из популярных
    if (!watchedIds || watchedIds.length === 0) {
      const list = popularAnime && popularAnime.length > 0 ? popularAnime : await getAnimeList(10, 'popularity');
      return list[Math.floor(Math.random() * list.length)];
    }

    // 1. Берем последнее просмотренное
    const lastWatchedId = watchedIds[0];
    const response = await fetch(`${BASE_URL}/animes/${lastWatchedId}`);

    if (!response.ok) {
       const list = popularAnime && popularAnime.length > 0 ? popularAnime : await getAnimeList(10, 'popularity');
       return list[0];
    }

    const lastAnime = await response.json();
    const genreIds = lastAnime.genres?.map((g: any) => g.id).slice(0, 3).join(',');

    // 2. Ищем похожие
    const recommendedRes = await fetch(
      `${BASE_URL}/animes?genre=${genreIds}&order=popularity&limit=10&exclude_ids=${watchedIds.join(',')}`
    );

    if (!recommendedRes.ok) {
        return popularAnime ? popularAnime[0] : null;
    }

    const recommended = await recommendedRes.json();

    if (recommended.length > 0) {
      const selected = recommended[Math.floor(Math.random() * Math.min(5, recommended.length))];
      return await getAnimeById(String(selected.id));
    }

    return popularAnime ? popularAnime[0] : null;
  } catch (error) {
    console.error("Recommendation error:", error);
    return popularAnime ? popularAnime[0] : null;
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
    search
  } = filters;

  try {
    const params = new URLSearchParams();
    params.append('page', String(page));
    params.append('limit', String(limit));
    params.append('order', order);

    if (genre) params.append('genre', genre);
    if (status) params.append('status', status);
    if (kind) params.append('kind', kind);
    if (year) params.append('season', `${year}_all`);
    if (search) params.append('search', search);

    const res = await fetch(`${BASE_URL}/animes?${params.toString()}`, {
      next: { revalidate: 3600 }
    });

    if (!res.ok) throw new Error("Failed to fetch catalog");
    const data: ShikimoriAnime[] = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    console.error("Catalog fetch error:", error);
    return [];
  }
}