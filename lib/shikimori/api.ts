import { BASE_URL, HEADERS, GENRES_MAP } from "./config";
import { shikimoriJson } from "./client";
import { transformAnime, transformTopic } from "./transformers";
import { getAnimeBackdrop } from "./images";
import { generateSearchVariants, isAnimeSafe, normalizeShikimoriUrl, transliterateRuToEn, containsCyrillic } from "./utils";
import { Anime, CatalogFilters, FranchiseItem, NewsItem, RecommendationReason, ShikimoriAnime, WeeklySchedule } from "./types";

// --- Catalog & Search ---

export async function getAnimeCatalog(filters: CatalogFilters): Promise<Anime[]> {
  const { page = 1, limit = 24, order = 'popularity', genre, status, kind, year, score, search, allowNsfw = false, enableGenreFallback = false, disableExternalAPIs = false } = filters;
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
      const transformed = await Promise.all(Array.from(unique.values()).map(item => transformAnime(item, filters.enableGenreFallback, filters.disableExternalAPIs)));
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
  return await Promise.all(safeData.map(item => transformAnime(item, filters.enableGenreFallback, filters.disableExternalAPIs)));
}

export async function searchAnime(query: string, allowNsfw: boolean = false, enableGenreFallback: boolean = false) {
  // Переиспользуем логику каталога для унификации
  return getAnimeCatalog({ search: query, allowNsfw, limit: 20, enableGenreFallback });
}

// --- Specific Lists ---

export async function getPopularNow(limit = 12): Promise<Anime[]> {
  const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=ongoing&score=7`, { next: { revalidate: 1800 } }, { fallback: [] });
  return await Promise.all(data.map(item => transformAnime(item, false)));
}

export async function getPopularAlways(limit = 12): Promise<Anime[]> {
  const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=released&score=8`, { next: { revalidate: 1800 } }, { fallback: [] });
  return await Promise.all(data.map(item => transformAnime(item, false)));
}

export async function getOngoingList(limit = 12): Promise<Anime[]> {
  const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?limit=${limit}&status=ongoing&order=ranked`, { next: { revalidate: 1800 } }, { fallback: [] });
  return await Promise.all(data.map(item => transformAnime(item, false)));
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
  return await Promise.all(data.map(item => transformAnime(item, false)));
}

// --- Details ---

export async function getAnimeById(id: string, enableGenreFallback: boolean = false) {
  const data = await shikimoriJson<ShikimoriAnime | null>(`${BASE_URL}/animes/${id}`, { next: { revalidate: 3600 }, headers: HEADERS }, { fallback: null });
  if (!data) return null;
  return await transformAnime(data, enableGenreFallback);
}

export async function getAnimeScreenshots(id: string): Promise<string[]> {
  try {
    const data = await shikimoriJson<any[]>(`${BASE_URL}/animes/${id}/screenshots`, { next: { revalidate: 3600 } }, { fallback: [] });
    return data.map(screenshot => normalizeShikimoriUrl(screenshot.original)).filter(Boolean);
  } catch (error) {
    console.error('Failed to fetch screenshots:', error);
    return [];
  }
}

export async function getAnimeScreenshotsThumbnails(id: string): Promise<string[]> {
  try {
    const data = await shikimoriJson<any[]>(`${BASE_URL}/animes/${id}/screenshots`, { next: { revalidate: 3600 } }, { fallback: [] });
    return data.map(screenshot => normalizeShikimoriUrl(screenshot.preview)).filter(Boolean);
  } catch (error) {
    console.error('Failed to fetch screenshot thumbnails:', error);
    return [];
  }
}

/**
 * Генерирует fallback аватар для персонажа на основе имени
 */
function generateCharacterFallbackAvatar(name: string): string {
  // Используем сервис аватаров на основе инициалов или имени
  const cleanName = name.trim().toLowerCase();
  const initials = name.split(' ').map(word => word[0]).join('').substring(0, 2).toUpperCase();
  
  // Используем DiceBear или похожий сервис для генерации аватаров
  // В качестве фоллбека используем UI Avatars
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=random&color=fff&size=128&bold=true&format=png`;
}

export async function getAnimeCharacters(id: string): Promise<Array<{name: string, avatar: string, role?: string}>> {
  try {
    const data = await shikimoriJson<any[]>(`${BASE_URL}/animes/${id}/roles`, { next: { revalidate: 3600 } }, { fallback: [] });
    
    const characters = data
      .filter(role => role.character)
      .map(role => {
        const name = role.character.russian || role.character.name;
        let avatar = '';
        
        // Пытаемся получить изображение из разных источников
        if (role.character.image) {
          // Основной источник: image.original
          avatar = normalizeShikimoriUrl(role.character.image.original);
          
          // Проверяем, не является ли это missing image
          if (avatar.includes('missing_original.jpg')) {
            // Пробуем другие размеры изображения
            if (role.character.image.preview) {
              const previewUrl = normalizeShikimoriUrl(role.character.image.preview);
              if (!previewUrl.includes('missing_original.jpg')) {
                avatar = previewUrl;
              } else {
                avatar = ''; // Сбрасываем, если тоже missing
              }
            } else {
              avatar = ''; // Сбрасываем, если нет preview
            }
          }
        }
        
        // Если все еще нет изображения или это missing image, генерируем fallback
        if (!avatar || avatar.includes('missing_original.jpg')) {
          avatar = generateCharacterFallbackAvatar(name);
        }
        
        return {
          name,
          avatar,
          role: role.roles_russian?.[0] || role.roles?.[0]
        };
      })
      .filter(Boolean);
      
    return characters;
  } catch (error) {
    console.error('Failed to fetch characters:', error);
    return [];
  }
}

export async function getAnimeVideos(id: string): Promise<{url: string, type: string, name: string}[]> {
  try {
    const data = await shikimoriJson<any[]>(`${BASE_URL}/animes/${id}/videos`, { next: { revalidate: 3600 } }, { fallback: [] });
    return data
      .filter(video => video.url && (video.type === 'pv' || video.type === 'op' || video.type === 'ed'))
      .map(video => ({
        url: video.url,
        type: video.type,
        name: video.name_russian || video.name
      }));
  } catch (error) {
    console.error('Failed to fetch videos:', error);
    return [];
  }
}

export async function getAnimeByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?ids=${ids.join(',')}&limit=${ids.length}`, { next: { revalidate: 3600 } }, { fallback: [] });
  return await Promise.all(data.map(item => transformAnime(item, false)));
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
  console.log('[getAnimeCalendar] Starting fetch from Shikimori calendar API');
  const data = await shikimoriJson<any[]>(`${BASE_URL}/calendar`, { next: { revalidate: 1800 } }, { fallback: [] });
  console.log('[getAnimeCalendar] Received data:', data.length, 'items');
  
  const schedule: WeeklySchedule = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

  await Promise.all(data.map(async (item) => {
    const day = (new Date(item.next_episode_at).getDay() + 6) % 7; // Сдвиг Вс(0)->6, Пн(1)->0
    const anime = await transformAnime(item.anime);
    anime.episodesCurrent = item.next_episode;
    schedule[day].push(anime);
  }));
  
  console.log('[getAnimeCalendar] Final schedule:', Object.entries(schedule).map(([k, v]) => `${k}:${v.length}`).join(', '));
  return schedule;
}

/**
 * Рассчитывает "вес" аниме для Hero-баннера.
 * Приоритет: Новые (текущий год/прошлый), Высокий рейтинг, Онгоинги.
 */
function calculateHeroScore(anime: Anime): number {
  let score = anime.rating || 0;
  const currentYear = new Date().getFullYear();

  // Бонус за свежесть
  if (anime.year === currentYear) score += 2.5;
  else if (anime.year === currentYear - 1) score += 1.5;
  else if (anime.year >= currentYear - 5) score += 0.5;

  // Бонус за статус
  if (anime.status === 'Ongoing') score += 1.0;

  // Штраф за слишком специфичные типы для баннера
  if (anime.quality === 'Special' || anime.quality === 'OVA') score -= 2.0;

  return score;
}

export async function getHeroRecommendation(
  watchedIds: string[], 
  bookmarkIds: string[] = [], 
  popularAnime?: Anime[]
): Promise<{ anime: Anime | null; reason?: RecommendationReason }> {
// 1. Создаем Set исключений (то, что юзер уже видел/отложил)
const excludeSet = new Set([...watchedIds, ...bookmarkIds]);
  
// Объединяем историю для анализа (берем последние 5, чтобы рекомендовать на основе свежих интересов)
const sourceIds = [...bookmarkIds, ...watchedIds].slice(0, 5);
  
let candidates: Anime[] = [];
let usedStrategy: 'similar' | 'trending' = 'trending';
let sourceAnimeTitle: string | undefined;

// 2. СТРАТЕГИЯ A: "Похожее на любимое" (Если есть история)
if (sourceIds.length > 0) {
try {
// Берем случайный ID из последних взаимодействий для разнообразия при каждом рефреше
const randomSourceId = sourceIds[Math.floor(Math.random() * sourceIds.length)];
      
// Запрашиваем похожие (это быстро, 1 запрос)
const similarRaw = await shikimoriJson<ShikimoriAnime[]>(
`${BASE_URL}/animes/${randomSourceId}/similar`, 
{ next: { revalidate: 3600 } }, // Кешируем на час
{ fallback: [] }
);

// Трансформируем и фильтруем
if (similarRaw.length > 0) {
const safeSimilar = similarRaw.filter(isAnimeSafe);
candidates = await Promise.all(safeSimilar.map(item => transformAnime(item, false)));
usedStrategy = 'similar';
        
// Получаем название исходного аниме для причины
try {
const sourceAnime = await getAnimeById(randomSourceId);
sourceAnimeTitle = sourceAnime?.title;
} catch (e) {
// Игнорируем ошибку, если не удалось получить название
}
}
} catch (e) {
console.error("Error fetching similar anime for recommendation:", e);
}
}

// 3. СТРАТЕГИЯ B: "Тренды" (Фоллбек, если Стратегия А не дала результатов или нет истории)
if (candidates.length === 0) {
// Если popularAnime не переданы, грузим их
if (!popularAnime || popularAnime.length === 0) {
candidates = await getPopularNow(20);
} else {
candidates = [...popularAnime];
}
usedStrategy = 'trending';
}

// 4. Фильтрация и Сортировка
const validCandidates = candidates.filter(anime => {
// Исключаем просмотренное (проверяем оба ID на всякий случай)
if (excludeSet.has(anime.shikimoriId) || excludeSet.has(anime.id)) return false;
// Исключаем низкий рейтинг для баннера
if (anime.rating < 6.5) return false;
return true;
});

// Сортируем по нашей формуле "Hero Score"
validCandidates.sort((a, b) => calculateHeroScore(b) - calculateHeroScore(a));

// 5. Поиск Backdrop (Самая дорогая операция)
// Мы берем топ-3 кандидата и ищем фон для них.
// Возвращаем первого, у кого есть качественный фон.
const topCandidates = validCandidates.slice(0, 3);
  
for (const candidate of topCandidates) {
// Сначала проверяем, может backdrop уже есть в объекте
if (candidate.backdrop) {
return {
anime: candidate,
reason: generateRecommendationReason(candidate, usedStrategy, sourceAnimeTitle)
};
}

// Если нет, пробуем найти
const backdrop = await getAnimeBackdrop(candidate.shikimoriId);
if (backdrop) {
return {
anime: { ...candidate, backdrop },
reason: generateRecommendationReason(candidate, usedStrategy, sourceAnimeTitle)
};
}
}

// 6. Крайний случай: если ни у кого из топ-3 нет фона,
// возвращаем просто лучший вариант (баннер будет использовать постер как фоллбек)
const bestCandidate = validCandidates[0];
if (bestCandidate) {
return {
anime: bestCandidate,
reason: generateRecommendationReason(bestCandidate, usedStrategy, sourceAnimeTitle)
};
}

return { anime: null };
}

/**
* Генерирует причину рекомендации на основе данных аниме и стратегии
*/
function generateRecommendationReason(
anime: Anime, 
strategy: 'similar' | 'trending', 
sourceAnimeTitle?: string
): RecommendationReason {
const factors: string[] = [];
const currentYear = new Date().getFullYear();
  
// Анализируем факторы
if (anime.rating >= 8.5) {
factors.push(`Высокий рейтинг ${anime.rating}`);
} else if (anime.rating >= 7.5) {
factors.push(`Хороший рейтинг ${anime.rating}`);
}
  
if (anime.year === currentYear) {
factors.push('Новинка 2025');
} else if (anime.year === currentYear - 1) {
factors.push('Свежий релиз');
} else if (anime.year >= currentYear - 3) {
factors.push('Современное аниме');
}
  
if (anime.status === 'Ongoing') {
factors.push('Выходит сейчас');
}
  
if (anime.quality === 'TV') {
factors.push('Полнометражный сериал');
} else if (anime.quality === 'Movie') {
factors.push('Полнометражный фильм');
}
  
// Если мало факторов, добавляем жанры
if (factors.length < 2 && anime.genres.length > 0) {
factors.push(`Жанры: ${anime.genres.slice(0, 2).join(', ')}`);
}
  
return {
strategy,
sourceAnime: sourceAnimeTitle,
score: calculateHeroScore(anime),
factors
};
}