import { BASE_URL, HEADERS, GENRES_MAP } from "./config";
import { shikimoriJson } from "./client";
import { transformAnime, transformTopic, transformAnimeCalendar } from "./transformers";
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

export async function getForumNewsPaginated(page = 1, limit = 12): Promise<NewsItem[]> {
  const data = await shikimoriJson<any[]>(`${BASE_URL}/topics?forum=news&limit=${limit}&page=${page}`, { next: { revalidate: 1800 } }, { fallback: [] });
  return data.map(transformTopic);
}

export async function getNewsById(id: string): Promise<NewsItem | null> {
  try {
    const data = await shikimoriJson<any>(`${BASE_URL}/topics/${id}`, { next: { revalidate: 3600 } }, { fallback: null });
    if (!data) return null;
    return transformTopic(data);
  } catch {
    return null;
  }
}

export async function getAnimeCalendar(): Promise<WeeklySchedule> {
  console.log('[getAnimeCalendar] Starting fetch from Shikimori calendar API');
  const startTime = Date.now();
  const data = await shikimoriJson<any[]>(`${BASE_URL}/calendar`, { next: { revalidate: 3600 } }, { fallback: [] });
  console.log('[getAnimeCalendar] Received data:', data.length, 'items');
  
  const schedule: WeeklySchedule = { 0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: [] };

  // Use lightweight synchronous transform - no external API calls
  data.forEach((item) => {
    const day = (new Date(item.next_episode_at).getDay() + 6) % 7; // Сдвиг Вс(0)->6, Пн(1)->0
    const anime = transformAnimeCalendar(item.anime);
    anime.episodesCurrent = item.anime.episodes_aired;
    schedule[day].push(anime);
  });
  
  const duration = Date.now() - startTime;
  console.log(`[getAnimeCalendar] Final schedule: ${Object.entries(schedule).map(([k, v]) => `${k}:${v.length}`).join(', ')} (loaded in ${duration}ms)`);
  return schedule;
}

/**
 * Проверяет, является ли аниме сиквелом без просмотренных предыдущих частей
 * Использует франшизу для определения порядка частей
 */
async function isSequelWithoutPreviousParts(anime: Anime, watchedIds: Set<string>): Promise<boolean> {
  try {
    console.log(`[SequelCheck] Checking ${anime.title} (ID: ${anime.shikimoriId})`);
    const franchise = await getAnimeFranchise(anime.shikimoriId);
    console.log(`[SequelCheck] Franchise for ${anime.title}:`, franchise.map(f => `${f.title} (${f.kind}, weight: ${f.weight})`));
    
    if (franchise.length === 0) {
      console.log(`[SequelCheck] No franchise data found for ${anime.title}`);
      return false;
    }

    // Находим текущее аниме во франшизе
    const currentInFranchise = franchise.find(item => item.id === anime.shikimoriId);
    if (!currentInFranchise) {
      console.log(`[SequelCheck] Current anime not found in franchise`);
      return false;
    }

    // Сортируем франшизу по весу (порядку) и году
    const sortedFranchise = franchise
      .filter(item => {
        // Case-insensitive check for TV/Movie kinds (handles 'tv', 'TV', 'TV Сериал', 'movie', etc.)
        const kind = item.kind?.toLowerCase() || '';
        return kind.includes('tv') || kind.includes('movie');
      }) // Только основные части
      .sort((a, b) => {
        // Сначала по весу, если есть
        if (a.weight !== b.weight) return (a.weight || 0) - (b.weight || 0);
        // Затем по году
        return (a.year || 0) - (b.year || 0);
      });

    console.log(`[SequelCheck] Sorted franchise (TV/Movie only):`, sortedFranchise.map(f => `${f.title} (weight: ${f.weight}, year: ${f.year})`));

    // Находим индекс текущего аниме
    const currentIndex = sortedFranchise.findIndex(item => item.id === anime.shikimoriId);
    console.log(`[SequelCheck] Current index: ${currentIndex}`);
    
    if (currentIndex <= 0) {
      console.log(`[SequelCheck] Not a sequel (index <= 0)`);
      return false; // Это первая часть или не найдена
    }

    // Проверяем, просмотрены ли все предыдущие части
    const previousParts = sortedFranchise.slice(0, currentIndex);
    console.log(`[SequelCheck] Previous parts:`, previousParts.map(p => `${p.title} (ID: ${p.id}, watched: ${watchedIds.has(p.id) || watchedIds.has(String(p.id))})`));
    
    const allPreviousWatched = previousParts.every(part =>
      watchedIds.has(part.id) || watchedIds.has(String(part.id))
    );

    console.log(`[SequelCheck] All previous watched: ${allPreviousWatched}`);

    // Если не все предыдущие части просмотрены - это сиквел без предыдущих
    return !allPreviousWatched;
  } catch (error) {
    console.error('[SequelCheck] Error checking sequel status:', error);
    // При ошибке блокируем рекомендацию для безопасности - лучше не рекомендовать, чем предложить сиквел без предыдущих частей
    return true;
  }
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
  
  // Объединяем историю — последние взаимодействия наиболее релевантны
  const historyPool = [...bookmarkIds, ...watchedIds].filter(Boolean);
  
  let candidates: Anime[] = [];
  let usedStrategy: 'similar' | 'trending' = 'trending';
  let sourceAnimeTitle: string | undefined;

  // 2. СТРАТЕГИЯ A: "Похожее на несколько аниме" (если есть история)
  if (historyPool.length > 0) {
    try {
      // Берём до 3 случайных ID из истории (shuffle + slice)
      const shuffled = [...historyPool].sort(() => Math.random() - 0.5);
      const selectedIds = shuffled.slice(0, Math.min(3, shuffled.length));

      // Параллельно запрашиваем similar для каждого выбранного ID
      const results = await Promise.allSettled(
        selectedIds.map(id =>
          shikimoriJson<ShikimoriAnime[]>(
            `${BASE_URL}/animes/${id}/similar`,
            { next: { revalidate: 3600 } },
            { fallback: [] }
          )
        )
      );

      // Объединяем все результаты, дедуплицируем по ID
      const merged = new Map<number, ShikimoriAnime>();
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          result.value.filter(isAnimeSafe).forEach(item => {
            if (!merged.has(item.id)) merged.set(item.id, item);
          });
        }
      });

      if (merged.size > 0) {
        candidates = await Promise.all(Array.from(merged.values()).map(item => transformAnime(item, false)));
        usedStrategy = 'similar';
        // Получаем название источника синхронно чтобы оно попало в reason
        const firstSuccessId = selectedIds[0];
        const sourceAnime = await getAnimeById(firstSuccessId).catch(() => null);
        sourceAnimeTitle = sourceAnime?.title;
      }
    } catch (e) {
      console.error("Error fetching similar anime for recommendation:", e);
    }
  }

  // 3. СТРАТЕГИЯ B: "Тренды" (фоллбек)
  if (candidates.length === 0) {
    candidates = popularAnime && popularAnime.length > 0 ? [...popularAnime] : await getPopularNow(20);
    usedStrategy = 'trending';
  }

  // 4. Фильтрация
  const validCandidates = candidates.filter(anime => {
    if (excludeSet.has(anime.shikimoriId) || excludeSet.has(anime.id)) return false;
    if (anime.rating < 6.5) return false;
    return true;
  });

  // Сортируем по Hero Score
  validCandidates.sort((a, b) => calculateHeroScore(b) - calculateHeroScore(a));

  // 5. Выбираем случайно из топ-5 чтобы каждый заход давал разный результат
  let bestCandidate: Anime | undefined;
  if (validCandidates.length > 0) {
    const topN = validCandidates.slice(0, Math.min(5, validCandidates.length));
    bestCandidate = topN[Math.floor(Math.random() * topN.length)];
  }

  if (!bestCandidate && candidates.length > 0) {
    bestCandidate = candidates[Math.floor(Math.random() * Math.min(5, candidates.length))];
  }
  
  if (bestCandidate) {
    // /similar не возвращает жанры — дозагружаем детали для выбранного кандидата
    if (!bestCandidate.genres || bestCandidate.genres.length === 0) {
      const full = await getAnimeById(bestCandidate.id, false).catch(() => null);
      if (full && full.genres && full.genres.length > 0) {
        bestCandidate = { ...bestCandidate, genres: full.genres };
      }
    }
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

  // Рейтинг — человекочитаемо
  if (anime.rating >= 9.0) {
    factors.push(`Шедевр с рейтингом ${anime.rating}`);
  } else if (anime.rating >= 8.5) {
    factors.push(`Одно из лучших — рейтинг ${anime.rating}`);
  } else if (anime.rating >= 8.0) {
    factors.push(`Высоко оценено зрителями: ${anime.rating}`);
  } else if (anime.rating >= 7.0) {
    factors.push(`Рейтинг ${anime.rating} — стоит посмотреть`);
  }

  // Проверяем по названию — сиквел ли это (Season 2, Part 2, 2nd, II, цифра в конце)
  const title = (anime.title || '') + ' ' + (anime.originalTitle || '');
  const isLikelySequel = /(\b(season|part|cour)\s*[2-9]|\b[2-9](nd|rd|th)\s*(season|cour|part)|\bii+\b|[：:]\s*[2-9](?:nd|rd|th)?\b|\s[2-9]$|\s[2-9]\s)/i.test(title);

  // Свежесть
  if (anime.status === 'Ongoing' && isLikelySequel) {
    factors.push('Сейчас выходит продолжение — советуем начать с 1 части');
  } else if (anime.status === 'Ongoing') {
    factors.push('Выходит прямо сейчас — следи за новыми сериями');
  } else if (isLikelySequel) {
    factors.push('Это продолжение — начни знакомство с 1 части');
  } else if (anime.year === currentYear) {
    factors.push(`Новинка ${currentYear} года`);
  } else if (anime.year === currentYear - 1) {
    factors.push('Вышло в прошлом году');
  }

  // Жанры всегда добавляем — это самое полезное
  if (anime.genres && anime.genres.length > 0) {
    factors.push(anime.genres.slice(0, 3).join(' · '));
  }

  return {
    strategy,
    sourceAnime: sourceAnimeTitle,
    score: calculateHeroScore(anime),
    factors
  };
}