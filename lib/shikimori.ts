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

export const GENRES_MAP: Record<string, string> = {
  "Экшен": "1", "Приключения": "2", "Комедия": "4", "Драма": "8",
  "Фэнтези": "10", "Магия": "16", "Ужасы": "14", "Детектив": "7",
  "Романтика": "22", "Фантастика": "24", "Повседневность": "36",
  "Спорт": "30", "Тримеллер": "41", "Исекай": "543",
};

// --- ГЛАВНАЯ ФИШКА: Запасной поиск картинки ---
async function getBackupPoster(title: string): Promise<string | null> {
  try {
    // Ищем на MyAnimeList через Jikan API
    const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(title)}&limit=1`);
    const data = await res.json();
    // Возвращаем большую картинку
    return data?.data?.[0]?.images?.jpg?.large_image_url || null;
  } catch (e) {
    console.error("Backup image fetch failed:", e);
    return null;
  }
}

// Помощник: Трансформация данных + Проверка картинки
async function transformAnime(item: ShikimoriAnime) {
  let posterUrl = SITE_URL + item.image.original;

  // Если Shikimori вернул заглушку "missing", ищем в другом месте
  if (posterUrl.includes("missing_original") || posterUrl.includes("missing_preview")) {
    const backup = await getBackupPoster(item.name); // Ищем по оригинальному названию
    if (backup) {
      posterUrl = backup;
    } else {
      // ЕСЛИ НИЧЕГО НЕ НАШЛИ - ставим красивую заглушку с названием
      // Используем внешний сервис, чтобы не создавать лишний код
      posterUrl = `https://placehold.co/400x600/18181b/orange/png?text=${encodeURIComponent(item.russian || item.name)}`;
    }
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
    quality: item.kind.toUpperCase(),
  };
}

// 1. Получить список (Обновили Promise.all)
export async function getAnimeList(limit = 20, order = 'popularity') {
  try {
    const res = await fetch(
      `${BASE_URL}/animes?limit=${limit}&order=${order}&status=ongoing,released&score=7`,
      { next: { revalidate: 3600 } }
    );
    if (!res.ok) throw new Error("Failed to fetch");
    const data: ShikimoriAnime[] = await res.json();
    
    // Ждем, пока проверятся все картинки
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    console.error(error);
    return [];
  }
}

// 2. Получить одно аниме
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

// 3. Поиск
export async function searchAnime(query: string) {
  try {
    const res = await fetch(`${BASE_URL}/animes?search=${encodeURIComponent(query)}&limit=10`);
    const data = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

// 4. По жанру
export async function getAnimeByGenre(genreId: string, page = 1) {
  try {
    const res = await fetch(
      `${BASE_URL}/animes?genre=${genreId}&limit=24&page=${page}&order=popularity`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

// Интерфейс для фильтров
export interface CatalogFilters {
  page?: number;
  limit?: number;
  order?: string;      // popularity, aired_on, ranked
  genre?: string;      // ID жанра
  status?: string;     // ongoing, released, anons
  kind?: string;       // tv, movie
  year?: string;       // 2024, 2023, 2020-2025
  search?: string;
}

// 5. УНИВЕРСАЛЬНАЯ ФУНКЦИЯ КАТАЛОГА
export async function getAnimeCatalog(filters: CatalogFilters) {
  const params = new URLSearchParams({
    limit: String(filters.limit || 24),
    page: String(filters.page || 1),
    order: filters.order || 'popularity',
    censored: 'true', // Скрываем хентай
  });

  if (filters.genre) params.append('genre', filters.genre);
  if (filters.status) params.append('status', filters.status);
  if (filters.kind) params.append('kind', filters.kind);
  if (filters.year) params.append('season', filters.year); // season=2024
  if (filters.search) params.append('search', filters.search);

  try {
    const res = await fetch(`${BASE_URL}/animes?${params.toString()}`, {
      // Кэшируем на 1 час, но для поиска лучше revalidate: 0, 
      // здесь ставим 60 сек для баланса
      next: { revalidate: 60 } 
    });
    
    if (!res.ok) return [];
    
    const data = await res.json();
    // Обрабатываем картинки (наш transformAnime из прошлых шагов)
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    console.error(error);
    return [];
  }
}

// 6. Получить свежие обновления (сортировка по дате обновления)
export async function getRecentUpdates(limit = 3) {
  try {
    const res = await fetch(
      `${BASE_URL}/animes?limit=${limit}&order=aired_on&status=ongoing`,
      { next: { revalidate: 1800 } } // Обновляем раз в 30 мин
    );
    const data = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

// 7. Получить анонсы (сортировка по популярности)
export async function getAnnouncements(limit = 3) {
  try {
    const res = await fetch(
      `${BASE_URL}/animes?limit=${limit}&order=popularity&status=anons`,
      { next: { revalidate: 86400 } } // Обновляем раз в сутки
    );
    const data = await res.json();
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}