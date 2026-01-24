// lib/shikimori.ts

const BASE_URL = "https://shikimori.one/api";
const SITE_URL = "https://shikimori.one";

// Заголовки (Shikimori требует User-Agent)
const HEADERS = {
  "User-Agent": "AnimePlatform/2.0 (Client-ID: AnixStream)",
  "Accept": "application/json"
};

// 
// 1. ARTISTIC POSTER GENERATOR (Генерация обложек)
// 

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = words[0];

  for (let i = 1; i < words.length; i++) {
    if (currentLine.length + 1 + words[i].length <= maxCharsPerLine) {
      currentLine += ' ' + words[i];
    } else {
      lines.push(currentLine);
      currentLine = words[i];
    }
  }
  lines.push(currentLine);
  return lines;
}

/**
 * Генерирует стильный SVG-постер, если нет картинки.
 */
function generateArtPoster(title: string): string {
  // Хешируем строку для стабильности (одно название = всегда одна обложка)
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const index = Math.abs(hash) % 4; // 4 стиля
  const letter = title.slice(0, 1).toUpperCase();
  
  // Адаптация размера текста
  const titleLength = title.length;
  let fontSize = 36;
  let maxChars = 14;
  let lineHeight = 40;

  if (titleLength > 50) {
    fontSize = 22;
    maxChars = 24;
    lineHeight = 26;
  } else if (titleLength > 25) {
    fontSize = 28;
    maxChars = 18;
    lineHeight = 32;
  }

  const lines = wrapText(title, maxChars);
  
  // Ограничиваем количество строк (максимум 4)
  if (lines.length > 4) {
      lines[3] = lines[3].substring(0, lines[3].length - 3) + "...";
      lines.length = 4;
  }

  const startY = 560 - (lines.length * lineHeight); 
  
  const textSvg = lines.map((line, i) => {
      return `<tspan x="40" dy="${i === 0 ? 0 : lineHeight}" font-weight="bold">${line}</tspan>`;
  }).join('');

  // Стили оформления
  const styles = [
    // Стиль 1: Solar
    {
      bg: `<rect width="100%" height="100%" fill="#1a0505"/><defs><linearGradient id="g1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#7f1d1d" /><stop offset="100%" stop-color="#0f0505" /></linearGradient></defs><rect width="100%" height="100%" fill="url(#g1)"/><circle cx="80%" cy="20%" r="150" fill="#ea580c" opacity="0.2" filter="url(#blur)"/><path d="M-50 400 L450 300" stroke="#f97316" stroke-width="2" opacity="0.3"/>`,
      textColor: "#fed7aa",
      accentColor: "#ea580c",
      font: "sans-serif"
    },
    // Стиль 2: Cyber
    {
      bg: `<rect width="100%" height="100%" fill="#020617"/><defs><pattern id="grid" width="30" height="30" patternUnits="userSpaceOnUse"><rect width="1" height="1" fill="#3b82f6" opacity="0.3"/></pattern></defs><rect width="100%" height="100%" fill="url(#grid)" /><rect x="10%" y="10%" width="80%" height="80%" fill="none" stroke="#3b82f6" stroke-width="1" opacity="0.3"/><circle cx="0%" cy="100%" r="250" fill="#2563eb" opacity="0.2" filter="url(#blur)"/>`,
      textColor: "#bfdbfe",
      accentColor: "#3b82f6",
      font: "monospace"
    },
    // Стиль 3: Mystic
    {
      bg: `<rect width="100%" height="100%" fill="#1e1b4b"/><circle cx="50%" cy="50%" r="180" fill="#8b5cf6" opacity="0.15" filter="url(#blur)"/><circle cx="20%" cy="80%" r="100" fill="#d8b4fe" opacity="0.1" filter="url(#blur)"/><path d="M0 0 Q 200 600 400 0" stroke="#a78bfa" stroke-width="1" fill="none" opacity="0.1"/>`,
      textColor: "#e9d5ff",
      accentColor: "#a78bfa",
      font: "serif"
    },
    // Стиль 4: Urban
    {
      bg: `<rect width="100%" height="100%" fill="#18181b"/><rect x="200" y="0" width="200" height="600" fill="#27272a"/><rect x="198" y="0" width="4" height="600" fill="#22c55e" opacity="0.5"/><text x="360" y="50" font-family="Arial" font-size="40" font-weight="900" fill="#22c55e" opacity="0.1" transform="rotate(90 360,50)">04</text>`,
      textColor: "#e4e4e7",
      accentColor: "#22c55e",
      font: "sans-serif"
    }
  ];

  const s = styles[index];

  const svg = `
  <svg width="400" height="600" viewBox="0 0 400 600" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="50" />
      </filter>
      <filter id="noise">
        <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.1"/></feComponentTransfer>
      </filter>
    </defs>
    ${s.bg}
    <text x="50%" y="40%" font-family="${s.font}" font-weight="900" font-size="300" fill="${s.accentColor}" text-anchor="middle" dominant-baseline="middle" opacity="0.1">${letter}</text>
    <rect width="100%" height="100%" filter="url(#noise)" opacity="0.5" style="mix-blend-mode: overlay;"/>
    <rect x="25" y="${startY - 10}" width="4" height="${lines.length * lineHeight + 20}" fill="${s.accentColor}"/>
    <text x="40" y="${startY + fontSize}" font-family="${s.font}" font-size="${fontSize}" fill="white" style="text-transform: uppercase; letter-spacing: 1px;">${textSvg}</text>
    <text x="40" y="${startY - 20}" font-family="sans-serif" font-size="12" fill="${s.textColor}" opacity="0.6" letter-spacing="3">ANIME COLLECTION</text>
  </svg>
  `;

  const base64 = Buffer.from(svg).toString('base64');
  return `data:image/svg+xml;base64,${base64}`;
}

// 
// 2. FETCH HELPERS
// 

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));


async function shikimoriFetch(input: string, init?: RequestInit & { next?: any }, retries = 2) {
  const controller = new AbortController();
  const timeoutMs = 15_000;

type ShikimoriCacheEntry = {
  freshUntil: number;
  staleUntil: number;
  value: unknown;
};

const SHIKIMORI_JSON_CACHE = new Map<string, ShikimoriCacheEntry>();

function shikimoriCacheKey(input: string, init?: RequestInit): string {
  const method = (init?.method ?? "GET").toUpperCase();
  const body = typeof init?.body === "string" ? init?.body : "";
  return `${method}:${input}:${body}`;
}

function getCachedShikimoriJson<T>(key: string): T | null {
  const entry = SHIKIMORI_JSON_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() <= entry.freshUntil) return entry.value as T;
  return null;
}

function getStaleCachedShikimoriJson<T>(key: string): T | null {
  const entry = SHIKIMORI_JSON_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() <= entry.staleUntil) return entry.value as T;
  return null;
}

function setCachedShikimoriJson(key: string, value: unknown, ttlMs: number, staleTtlMs: number) {
  const now = Date.now();
  SHIKIMORI_JSON_CACHE.set(key, {
    freshUntil: now + ttlMs,
    staleUntil: now + Math.max(staleTtlMs, ttlMs),
    value
  });
}

async function shikimoriFetch(input: string, init?: RequestInit & { next?: any }, retries = 1) {
  const controller = new AbortController();
  const timeoutMs = 8_000;
 test-source/main
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, {
      ...init,
      headers: {
        ...HEADERS,
        ...(init?.headers ?? {})
      },
      signal: controller.signal
    });


    // Если поймали лимит запросов
    if (res.status === 429 && retries > 0) {
      console.warn(`[Shikimori] 429 Rate Limit. Waiting 2s... (${retries} retries left)`);
      await delay(1000); // Ждем 2 секунды перед повтором
      return shikimoriFetch(input, init, retries - 1);
    }

    if (res.status === 429) return res;
 test-source/main

    return res;
  } catch (error) {
    if (retries > 0) {

      await delay(1000);

 test-source/main
      return shikimoriFetch(input, init, retries - 1);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}



async function shikimoriJson<T>(
  input: string,
  init?: RequestInit & { next?: any },
  options?: {
    ttlMs?: number;
    staleTtlMs?: number;
    fallback: T;
  }
): Promise<T> {
  const ttlMs = options?.ttlMs ?? 30_000;
  const staleTtlMs = options?.staleTtlMs ?? 10 * 60_000;
  const key = shikimoriCacheKey(input, init);

  const cached = getCachedShikimoriJson<T>(key);
  if (cached !== null) return cached;

  try {
    const res = await shikimoriFetch(input, init);

    if (res.status === 429) {
      const stale = getStaleCachedShikimoriJson<T>(key);
      if (stale !== null) return stale;
      return options!.fallback;
    }

    if (!res.ok) {
      const stale = getStaleCachedShikimoriJson<T>(key);
      if (stale !== null) return stale;
      return options!.fallback;
    }

    const data = (await res.json()) as T;
    if ((init?.method ?? "GET").toUpperCase() === "GET") {
      setCachedShikimoriJson(key, data, ttlMs, staleTtlMs);
    }
    return data;
  } catch {
    const stale = getStaleCachedShikimoriJson<T>(key);
    if (stale !== null) return stale;
    return options!.fallback;
  }
}

 test-source/main
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

function upgradeShikimoriUrl(url: string): string {
  if (!url) return "";
  const normalized = normalizeShikimoriUrl(url);
  return normalized
    .replace('/x96/', '/original/')
    .replace('/x48/', '/original/')
    .replace('/preview/', '/original/')
    .replace('_x96', '_original')
    .replace('_preview', '_original');
}

// 
// 3. INTERFACES
// 

export interface ShikimoriAnime {
  id: number;
  name: string;
  russian: string;
  image: {
    original: string;
    preview: string;
    x96?: string;
    x48?: string;
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
  // "Эротика": "9", // Закомментировано для исключения хентай-контента из поиска
};



 test-source/main
// 
// Календарь (страница расписания)
// 

export interface CalendarItem {
  next_episode: number;
  next_episode_at: string; // ISO Date
  duration: number;
  anime: ShikimoriAnime;
}

export interface WeeklySchedule {
  [dayIndex: number]: Anime[]; // 0 = Понедельник, 6 = Воскресенье
}

// --- Добавить в секцию API FUNCTIONS ---

export async function getAnimeCalendar(): Promise<WeeklySchedule> {
  try {
    // Получаем календарь релизов

    const res = await shikimoriFetch(`${BASE_URL}/calendar`);
    if (!res.ok) return {};

    const data: CalendarItem[] = await res.json();
    

    const data = await shikimoriJson<CalendarItem[]>(`${BASE_URL}/calendar`, { next: { revalidate: 1800 } }, { ttlMs: 60_000, staleTtlMs: 6 * 60 * 60_000, fallback: [] });
    if (!Array.isArray(data)) return {};

 test-source/main
    // Инициализируем пустую неделю (0 - Пн, 6 - Вс)
    const schedule: WeeklySchedule = {
      0: [], 1: [], 2: [], 3: [], 4: [], 5: [], 6: []
    };

    // Параллельно трансформируем аниме
    await Promise.all(data.map(async (item) => {
      const date = new Date(item.next_episode_at);
      // getDay(): 0 = Вс, 1 = Пн. Нам нужно 0 = Пн, 6 = Вс
      let dayIndex = date.getDay() - 1;
      if (dayIndex === -1) dayIndex = 6;

      const anime = await transformAnime(item.anime);
      
      // Перезаписываем episodesCurrent на номер серии, которая выходит
      anime.episodesCurrent = item.next_episode;
      
      // Добавляем время выхода в описание или отдельное поле (опционально)
      // Для простоты используем поле description для хранения времени, если нужно
      // Но лучше просто сгруппировать
      
      schedule[dayIndex].push(anime);
    }));

    return schedule;
  } catch (error) {
    console.error("Calendar fetch error:", error);
    return {};
  }
}

// 
// 4. IMAGE LOGIC (Resolve Best Poster/Backdrop)
// 

function isHighQualityImage(url: string, isPoster: boolean = true): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  
  // Фильтр заглушек
  if (lowerUrl.includes('missing') || lowerUrl.includes('stub') || lowerUrl.includes('placeholder') || lowerUrl.includes('default')) {
    return false;
  }
  // Фильтр мелких иконок
  if (lowerUrl.includes('x96') || lowerUrl.includes('x48') || lowerUrl.includes('x160')) {
    return false;
  }

  // Для постеров (карточек) требования мягче
  if (isPoster) return true;

  // Для фонов (backdrops) требования жестче
  const lowQualityPatterns = [
    'preview', 'thumb', 'thumbnail', 'small', 'medium'
  ];
  if (lowQualityPatterns.some(pattern => lowerUrl.includes(pattern))) return false;
  
  const sizeMatch = url.match(/(\d+)x(\d+)/);
  if (sizeMatch) {
    const width = parseInt(sizeMatch[1]);
    return width >= 800; // Требуем минимум 800px ширины для фона
  }
  
  return true;
}

/**
 * Логика выбора постера:
 * 1. Shikimori Original (если есть)
 * 2. Kodik API (если на Shikimori заглушка)
 * 3. Anilist (если Kodik тоже не дал результат)
 * 4. MyAnimeList (дополнительный источник)
 * 5. Генеративный SVG Арт (если нигде нет)
 */
async function resolveBestPoster(shikimoriUrl: string, romajiName: string, russianName: string, shikimoriId: string): Promise<string> {
  const targetName = russianName || romajiName || "Anime";
  
  // 1. Пробуем Shikimori
  const upgradedUrl = upgradeShikimoriUrl(shikimoriUrl);
  if (isHighQualityImage(upgradedUrl, true)) {
    return upgradedUrl;
  }

  // 2. Пробуем Kodik API
  const kodikPoster = await getKodikPoster(shikimoriId, targetName);
  if (kodikPoster) return kodikPoster;

  // 3. Пробуем Anilist
  const namesToTry = [romajiName, russianName].filter(Boolean);
  for (const name of namesToTry) {
    const fallback = await getAnilistPoster(name);
    if (fallback) return fallback;
  }

  // 4. Пробуем MyAnimeList
  for (const name of namesToTry) {
    const malPoster = await getMyAnimeListPoster(name);
    if (malPoster) return malPoster;
  }

  // 5. Генерируем арт
  return generateArtPoster(targetName);
}

async function getKodikPoster(shikimoriId: string, targetName: string): Promise<string | null> {
  try {
    // Пробуем поиск по shikimori_id
    const response = await fetch(`https://kodikapi.com/v2/animes?shikimori_id=${shikimoriId}&limit=1`, {
      headers: {
        'User-Agent': 'AnimePlatform/2.0'
      }
    });
    if (!response.ok) return null;
    const json = await response.json();
    const results = json.results || [];
    if (results.length > 0) {
      const posterUrl = results[0].poster || results[0].poster_url;
      if (posterUrl && !posterUrl.includes('missing')) {
        return posterUrl;
      }
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function getMyAnimeListPoster(searchTitle: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchTitle)}&limit=1`, {
      next: { revalidate: 86400 }
    });
    if (!response.ok) return null;
    const json = await response.json();
    const results = json.data || [];
    if (results.length > 0) {
      return results[0].images?.jpg?.large_url || results[0].images?.jpg?.image_url || null;
    }
    return null;
  } catch (e) {
    return null;
  }
}

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
      next: { revalidate: 86400 } // Кэш 24 часа
    });

    if (!response.ok) return null;
    const json = await response.json();
    const media = json?.data?.Media;
    return media?.coverImage?.extraLarge || media?.coverImage?.large || null;
  } catch (e) {
    return null;
  }
}

async function getAnimeBackdrop(shikimoriId: string): Promise<string | null> {
  try {
    // 1. Пробуем найти скриншоты на Shikimori
    const res = await shikimoriFetch(`${BASE_URL}/animes/${shikimoriId}/screenshots`);
    if (res.ok) {
      const data: ShikimoriScreenshot[] = await res.json();
      
      const bestScreenshot = data?.find(screenshot => {
        const url = normalizeShikimoriUrl(screenshot.original);
        return isHighQualityImage(url, false); // false = строгий режим
      });
      
      if (bestScreenshot) {
        return normalizeShikimoriUrl(bestScreenshot.original);
      }
    }

    // 2. Если нет скриншотов, пробуем Anilist Banner
    // Делаем доп. запрос за деталями, чтобы получить английское название для поиска
    const animeRes = await shikimoriFetch(`${BASE_URL}/animes/${shikimoriId}`);
    if (animeRes.ok) {
        const data = await animeRes.json();
        const anilistBanner = await getAnilistBackdrop(data.name);
        if (anilistBanner) return anilistBanner;
    }

    return null;
  } catch {
    return null;
  }
}

async function getAnilistBackdrop(searchTitle: string): Promise<string | null> {
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
              bannerImage
              coverImage {
                extraLarge
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
    return json?.data?.Media?.bannerImage || json?.data?.Media?.coverImage?.extraLarge || null;
  } catch (e) {
    return null;
  }
}

// 
// 5. TRANSFORMERS
// 

async function transformAnime(item: ShikimoriAnime): Promise<Anime> {
  // Используем улучшенную логику с множественными источниками постеров
  const posterUrl = await resolveBestPoster(
    item.image?.original,
    item.name,
    item.russian,
    String(item.id)
  );

  return {
    id: String(item.id),
    shikimoriId: String(item.id),
    title: item.russian || item.name,
    originalTitle: item.name,
    poster: posterUrl,
    rating: parseFloat(item.score) || 0,
    year: item.aired_on ? new Date(item.aired_on).getFullYear() : (new Date().getFullYear()),
    airedOn: item.aired_on || undefined,
    episodesCurrent: item.episodes_aired || 0,
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

// 
// 6. API FUNCTIONS
// 

export async function getAnimeList(limit = 20, order = 'popularity') {
  try {

    const res = await shikimoriFetch(`${BASE_URL}/animes?limit=${limit}&order=${order}&status=ongoing,released&score=6`);
    if (!res.ok) throw new Error("Failed to fetch");
    const data: ShikimoriAnime[] = await res.json();

    const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?limit=${limit}&order=${order}&status=ongoing,released&score=6`, { next: { revalidate: 1800 } }, { ttlMs: 60_000, staleTtlMs: 60 * 60_000, fallback: [] });
 test-source/main
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getPopularNow(limit = 12): Promise<Anime[]> {
  try {

    const res = await shikimoriFetch(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=ongoing&score=7`, {
      next: { revalidate: 1800 }
    });
    if (!res.ok) return [];

    const data: ShikimoriAnime[] = await res.json();

    const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=ongoing&score=7`, { next: { revalidate: 1800 } }, { ttlMs: 60_000, staleTtlMs: 60 * 60_000, fallback: [] });
 test-source/main
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

export async function getPopularAlways(limit = 12): Promise<Anime[]> {
  try {

    const res = await shikimoriFetch(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=released&score=8`, {
      next: { revalidate: 1800 }
    });
    if (!res.ok) return [];
    const data: ShikimoriAnime[] = await res.json();

    const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=released&score=8`, { next: { revalidate: 1800 } }, { ttlMs: 60_000, staleTtlMs: 60 * 60_000, fallback: [] });
 test-source/main
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

export async function getOngoingList(limit = 12): Promise<Anime[]> {
  try {

    const res = await shikimoriFetch(`${BASE_URL}/animes?limit=${limit}&status=ongoing&order=ranked`, {
      next: { revalidate: 1800 }
    });
    if (!res.ok) return [];
    const data: ShikimoriAnime[] = await res.json();

    const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?limit=${limit}&status=ongoing&order=ranked`, { next: { revalidate: 1800 } }, { ttlMs: 60_000, staleTtlMs: 60 * 60_000, fallback: [] });
 test-source/main
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

    const data = await shikimoriJson<ShikimoriTopic[]>(`${BASE_URL}/topics?forum=news&limit=${limit}`, { next: { revalidate: 1800 } }, { ttlMs: 60_000, staleTtlMs: 6 * 60 * 60_000, fallback: [] });
 test-source/main
    return data.map(transformTopic);
  } catch (error) {
    return [];
  }
}

export async function getAnimeById(id: string) {
  try {

    const res = await shikimoriFetch(`${BASE_URL}/animes/${id}`, {
      next: { revalidate: 3600 },
      headers: HEADERS
    });
    if (!res.ok) return null;
    const data: ShikimoriAnime = await res.json();

    const data = await shikimoriJson<ShikimoriAnime | null>(`${BASE_URL}/animes/${id}`, { next: { revalidate: 3600 }, headers: HEADERS }, { ttlMs: 10 * 60_000, staleTtlMs: 24 * 60 * 60_000, fallback: null });
    if (!data) return null;
 test-source/main
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
    

    const data = await shikimoriJson<ShikimoriFranchise | null>(`${BASE_URL}/animes/${id}/franchise`, { next: { revalidate: 21600 } }, { ttlMs: 10 * 60_000, staleTtlMs: 24 * 60 * 60_000, fallback: null });
    if (!data) return [];

 test-source/main
    const nodes = data.nodes.filter((node) => node.url?.startsWith('/animes/'));

    const items: FranchiseItem[] = await Promise.all(nodes.map(async (node) => {
      // Используем ту же логику с множественными источниками для франшизы
      const posterUrl = await resolveBestPoster(
        node.image_url,
        node.name,
        node.name, // Для франшизы обычно только одно название
        String(node.id)
      );

      return {
        id: String(node.id),
        title: node.name,
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
    console.error("Franchise Error:", error);
    return [];
  }
}

export async function searchAnime(query: string) {
  try {

    const res = await shikimoriFetch(`${BASE_URL}/animes?search=${encodeURIComponent(query)}&limit=10&score=6`);
    const data = await res.json();

    const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?search=${encodeURIComponent(query)}&limit=10&score=6`, { next: { revalidate: 60 } }, { ttlMs: 30_000, staleTtlMs: 10 * 60_000, fallback: [] });
 test-source/main
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

export async function getAnnouncements(limit = 3) {
  try {

    const res = await shikimoriFetch(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=anons`);
    const data = await res.json();

    const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=anons`, { next: { revalidate: 21600 } }, { ttlMs: 60_000, staleTtlMs: 24 * 60 * 60_000, fallback: [] });
 test-source/main
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

export async function getAnimeByIds(ids: string[]) {
  if (ids.length === 0) return [];
  const idsString = ids.join(',');
  try {

    const res = await shikimoriFetch(`${BASE_URL}/animes?ids=${idsString}&limit=${ids.length}`);
    if (!res.ok) return [];
    const data: ShikimoriAnime[] = await res.json();

    const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?ids=${idsString}&limit=${ids.length}`, { next: { revalidate: 3600 } }, { ttlMs: 5 * 60_000, staleTtlMs: 24 * 60 * 60_000, fallback: [] });
 test-source/main
    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    return [];
  }
}

// --- OPTIMIZED TOP OF WEEK (Фикс 429 ошибки) ---
export async function getTopOfWeek(limit = 30): Promise<Anime[]> {
  try {

    const res = await shikimoriFetch(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=ongoing&score=7`, {
      next: { revalidate: 3600 } // Кэшируем на час
    });
    if (!res.ok) return [];

    const data: ShikimoriAnime[] = await res.json();

    const data = await shikimoriJson<ShikimoriAnime[]>(`${BASE_URL}/animes?limit=${limit}&order=popularity&status=ongoing&score=7`, { next: { revalidate: 3600 } }, { ttlMs: 60_000, staleTtlMs: 24 * 60 * 60_000, fallback: [] });
 test-source/main
    const animeList = await Promise.all(data.map(transformAnime));

    const animeWithBackdrop = [];
    // Грузим фоны последовательно только для первых 5, с микро-паузой
    for (let i = 0; i < animeList.length; i++) {
      const anime = animeList[i];
      if (i < 5) {
        await delay(200); // Пауза 200мс между запросами фонов
        const backdrop = await getAnimeBackdrop(anime.shikimoriId);
        animeWithBackdrop.push(backdrop ? { ...anime, backdrop } : anime);
      } else {
        animeWithBackdrop.push(anime);
      }
    }

    return animeWithBackdrop;
  } catch (error) {
    return [];
  }
}

// Функции рекомендаций
async function canRecommendFranchise(animeId: string, watchedIds: string[]): Promise<boolean> {
  try {

    const res = await shikimoriFetch(`${BASE_URL}/animes/${animeId}/franchise`);
    if (!res.ok) return true;

    const data: ShikimoriFranchise = await res.json();

    const data = await shikimoriJson<ShikimoriFranchise | null>(`${BASE_URL}/animes/${animeId}/franchise`, { next: { revalidate: 21600 } }, { ttlMs: 10 * 60_000, staleTtlMs: 24 * 60 * 60_000, fallback: null });
    if (!data) return true;

 test-source/main
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
    const excludedIds = [...new Set([...watchedIds, ...bookmarkIds])];
    
    const fetchFullDetails = async (animeShort: Anime) => {
      const fullData = await getAnimeById(animeShort.id);
      if (!fullData) return animeShort;
      const backdrop = await getAnimeBackdrop(fullData.shikimoriId);
      return backdrop ? { ...fullData, backdrop } : fullData;
    };

    if (!watchedIds || watchedIds.length === 0 || !watchedIds[0]) {
      const list = popularAnime && popularAnime.length > 0 ? popularAnime : await getPopularNow(10);
      if (!list || list.length === 0) return null;
      
      const filteredList = list.filter(a => !excludedIds.includes(a.id));
      const selected = filteredList[Math.floor(Math.random() * filteredList.length)] || list[0];
      
      return await fetchFullDetails(selected);
    }

    const lastWatchedId = watchedIds[0];

    const response = await shikimoriFetch(`${BASE_URL}/animes/${lastWatchedId}`);

    if (!response.ok) {
      if (!popularAnime || popularAnime.length === 0) return null;
      return await fetchFullDetails(popularAnime[0]);
    }

    const lastAnime = await response.json();
    const genreIds = lastAnime.genres?.map((g: any) => g.id).slice(0, 3).join(',');

    const recommendedRes = await shikimoriFetch(
      `${BASE_URL}/animes?genre=${genreIds}&order=popularity&limit=20&exclude_ids=${excludedIds.join(',')}`,
      undefined
    );

    if (!recommendedRes.ok) {

    const lastAnime = await shikimoriJson<any | null>(`${BASE_URL}/animes/${lastWatchedId}`, { next: { revalidate: 3600 } }, { ttlMs: 10 * 60_000, staleTtlMs: 24 * 60 * 60_000, fallback: null });

    if (!lastAnime) {
      if (!popularAnime || popularAnime.length === 0) return null;
      return await fetchFullDetails(popularAnime[0]);
    }
    const genreIds = lastAnime.genres?.map((g: any) => g.id).slice(0, 3).join(',');
    

    const recommended = await shikimoriJson<any[]>(
      `${BASE_URL}/animes?genre=${genreIds}&order=popularity&limit=20&exclude_ids=${excludedIds.join(',')}`,
      { next: { revalidate: 1800 } },
      { ttlMs: 60_000, staleTtlMs: 60 * 60_000, fallback: [] }
    );

    if (!Array.isArray(recommended) || recommended.length === 0) {
 test-source/main
      if (!popularAnime || popularAnime.length === 0) return null;
      return await fetchFullDetails(popularAnime[0]);
    }


    const recommended = await recommendedRes.json();


 test-source/main
    if (recommended.length > 0) {
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
    return await fetchFullDetails(popularAnime[0]);

  } catch (error) {
    if (!popularAnime || popularAnime.length === 0) return null;
    const selected = popularAnime[0];
    const fullData = await getAnimeById(selected.id);
    return fullData || selected;
  }
}

// --- FIXED CATALOG FILTERS (Фикс 422 ошибки) ---

export async function getAnimeCatalog(filters: CatalogFilters): Promise<Anime[]> {



 test-source/main
  const {
    page = 1,
    limit = 24,
    order = 'popularity', // C фронта может прилететь 'popular'
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

    // --- Маппинг параметров сортировки ---
    // Это исправляет ошибку, когда фронт шлет "popular", а API ждет "popularity"
    const orderMap: Record<string, string> = {
      'popular': 'popularity',
      'popularity': 'popularity',
      'new': 'aired_on',
      'aired_on': 'aired_on',
      'top': 'ranked',
      'ranked': 'ranked',
      'rating': 'ranked',
      'name': 'name',
      'random': 'random'
    };
    
    // Берем значение из карты или дефолтное
    const apiOrder = orderMap[order] || 'popularity';
    params.append('order', apiOrder);
    // -------------------------------------

    if (genre && genre !== 'all') params.append('genre', genre);
    if (status && status !== 'all') params.append('status', status);
    if (kind && kind !== 'all') params.append('kind', kind);
    if (score && score !== 'all') params.append('score', score);

    if (year && year !== 'all') {
      let seasonValue = year;
      if (year === '2000s') seasonValue = '2000_2010';
      if (year === '1990s') seasonValue = '1990_2000';
      if (year === 'older') seasonValue = '1917_1990';
      params.append('season', seasonValue);
    }

    if (search && search.trim() !== '') {
      params.append('search', search.trim());
    }

    const url = `${BASE_URL}/animes?${params.toString()}`;

    
    const res = await shikimoriFetch(url, {
      next: { revalidate: 60 },
      headers: HEADERS
    });

    if (!res.ok) {
      console.error(`API Error: ${res.status}`, await res.text());
      return [];
    }
    
    const data: ShikimoriAnime[] = await res.json();


    const data = await shikimoriJson<ShikimoriAnime[]>(url, { next: { revalidate: 60 }, headers: HEADERS }, { ttlMs: 30_000, staleTtlMs: 10 * 60_000, fallback: [] });
 test-source/main
    if (!Array.isArray(data)) return [];

    return await Promise.all(data.map(transformAnime));
  } catch (error) {
    console.error("Catalog fetch error:", error);
    return [];
  }
}