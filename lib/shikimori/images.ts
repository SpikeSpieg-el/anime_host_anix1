import { upgradeShikimoriUrl, generateArtPoster, normalizeShikimoriUrl } from "./utils";
import { shikimoriFetch, shikimoriJson } from "./client";
import { BASE_URL } from "./config";

// Кэш для постеров и фонов
const posterCache = new Map<string, string>();
const backdropCache = new Map<string, string | null>();
// Очередь для запросов с задержкой
let requestQueue = Promise.resolve();
const REQUEST_DELAY = 50; // 50ms между запросами (ускорено для быстрой загрузки)

/**
 * Вспомогательная функция для проксирования картинок через Weserv.nl
 * Обходит 403 ошибки от Shikimori, MyAnimeList и других источников
 * Временно отключена - возвращает оригинальный URL
 */
export function proxyImage(url: string | null | undefined): string | null {
  // Временно отключаем проксирование из-за проблем с Next.js
  // Если будут 403 ошибки, можно будет добавить unoptimized prop к Image компонентам
  return url || null;
}

function delayRequest(): Promise<void> {
  requestQueue = requestQueue.then(() => new Promise(resolve => setTimeout(resolve, REQUEST_DELAY)));
  return requestQueue;
}

function isHighQualityImage(url: string, isPoster: boolean = true): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  if (['missing', 'stub', 'placeholder', 'default'].some(s => lowerUrl.includes(s))) return false;
  if (['x96', 'x48', 'x160'].some(s => lowerUrl.includes(s))) return false;
  if (isPoster) return true;
  if (['preview', 'thumb', 'thumbnail', 'small'].some(s => lowerUrl.includes(s))) return false;
  const sizeMatch = url.match(/(\d+)x(\d+)/);
  if (sizeMatch && parseInt(sizeMatch[1]) < 800) return false;
  return true;
}

export async function resolveBestPoster(shikimoriUrl: string, romajiName: string, russianName: string, shikimoriId: string, disableExternalAPIs: boolean = false): Promise<string> {
  const cacheKey = `${shikimoriId}-${romajiName}-${russianName}-${disableExternalAPIs}`;
  
  // Проверяем кэш
  if (posterCache.has(cacheKey)) {
    return posterCache.get(cacheKey)!;
  }
  
  const targetName = russianName || romajiName || "Anime";
  
  // Шаг 1: Пробуем Shikimori через прокси (всегда, даже если внешние API отключены)
  const upgradedUrl = upgradeShikimoriUrl(shikimoriUrl);
  if (isHighQualityImage(upgradedUrl, true)) {
    const proxiedUrl = proxyImage(upgradedUrl);
    if (proxiedUrl) {
      posterCache.set(cacheKey, proxiedUrl);
      return proxiedUrl;
    }
  }

  // Если внешние API отключены (для гача), используем только фоллбэк
  if (disableExternalAPIs) {
    console.log(`[resolveBestPoster] Using fallback for ${targetName} (external APIs disabled)`);
    const fallback = generateArtPoster(targetName);
    posterCache.set(cacheKey, fallback);
    return fallback;
  }

  // Шаг 2: Пробуем AniList (GraphQL) - самый надежный источник
  const namesToTry = [romajiName, russianName].filter(Boolean);
  for (const name of namesToTry) {
    await delayRequest();
    const anilist = await getAnilistPoster(name);
    if (anilist) {
      const proxied = proxyImage(anilist);
      if (proxied) {
        posterCache.set(cacheKey, proxied);
        return proxied;
      }
    }
  }

  // Шаг 3: Пробуем Kitsu (REST API)
  for (const name of namesToTry) {
    await delayRequest();
    const kitsu = await getKitsuPoster(name);
    if (kitsu) {
      const proxied = proxyImage(kitsu);
      if (proxied) {
        posterCache.set(cacheKey, proxied);
        return proxied;
      }
    }
  }

  // Шаг 4: Пробуем Kodik
  await delayRequest();
  const kodik = await getKodikPoster(shikimoriId);
  if (kodik) {
    const proxied = proxyImage(kodik);
    if (proxied) {
      posterCache.set(cacheKey, proxied);
      return proxied;
    }
  }

  // Шаг 5: Пробуем MyAnimeList (Jikan API)
  for (const name of namesToTry) {
    await delayRequest();
    const mal = await getMyAnimeListPoster(name);
    if (mal) {
      const proxied = proxyImage(mal);
      if (proxied) {
        posterCache.set(cacheKey, proxied);
        return proxied;
      }
    }
  }

  // Шаг 6: Резервный вариант - оригинальный Shikimori через прокси
  if (shikimoriUrl) {
    const fullShikimoriUrl = shikimoriUrl.startsWith('http') 
      ? shikimoriUrl 
      : `https://shikimori.one${shikimoriUrl}`;
    const proxied = proxyImage(fullShikimoriUrl);
    if (proxied) {
      posterCache.set(cacheKey, proxied);
      return proxied;
    }
  }

  // Шаг 7: Фоллбэк - генерируем заглушку
  const fallback = generateArtPoster(targetName);
  posterCache.set(cacheKey, fallback);
  return fallback;
}

async function getKodikPoster(shikimoriId: string): Promise<string | null> {
  try {
    const response = await fetch(`https://kodikapi.com/v2/animes?shikimori_id=${shikimoriId}&limit=1`);
    if (!response.ok) return null;
    const json = await response.json();
    const poster = json.results?.[0]?.poster || json.results?.[0]?.poster_url;
    return (poster && !poster.includes('missing')) ? poster : null;
  } catch { return null; }
}

async function getAnilistPoster(searchTitle: string): Promise<string | null> {
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        query: `query ($search: String) { Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { coverImage { extraLarge large } } }`,
        variables: { search: searchTitle }
      }),
      next: { revalidate: 86400 }
    });
    if (!response.ok) return null;
    const json = await response.json();
    return json?.data?.Media?.coverImage?.extraLarge || json?.data?.Media?.coverImage?.large || null;
  } catch { return null; }
}

/**
 * Получение обложки из Kitsu API (REST)
 */
async function getKitsuPoster(searchTitle: string): Promise<string | null> {
  try {
    const url = `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(searchTitle)}&page[limit]=1`;
    
    const response = await fetch(url, {
      headers: {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json"
      },
      next: { revalidate: 86400 }
    });

    if (!response.ok) return null;

    const json = await response.json();
    const animeData = json.data?.[0];
    
    if (!animeData) return null;

    const posterImages = animeData.attributes?.posterImage;
    return posterImages?.original || posterImages?.large || posterImages?.medium || null;
  } catch { return null; }
}

async function getMyAnimeListPoster(searchTitle: string): Promise<string | null> {
  try {
    const response = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(searchTitle)}&limit=1`, { next: { revalidate: 86400 } });
    if (!response.ok) return null;
    const json = await response.json();
    return json.data?.[0]?.images?.jpg?.large_url || null;
  } catch { return null; }
}

export async function getAnimeBackdrop(shikimoriId: string, disableExternalAPIs: boolean = false): Promise<string | null> {
  const cacheKey = `backdrop-${shikimoriId}-${disableExternalAPIs}`;
  
  // Проверяем кэш
  if (backdropCache.has(cacheKey)) {
    return backdropCache.get(cacheKey)!;
  }
  
  try {
    // 1. Screenshots - use only the first one через прокси
    const res = await shikimoriFetch(`${BASE_URL}/animes/${shikimoriId}/screenshots`);
    if (res.ok) {
      const data: any[] = await res.json();
      if (data && data.length > 0) {
        const result = normalizeShikimoriUrl(data[0].original);
        const proxied = proxyImage(result);
        if (proxied) {
          backdropCache.set(cacheKey, proxied);
          return proxied;
        }
      }
    }
    
    // 2. Anilist Banner (если не отключен) через прокси
    if (!disableExternalAPIs) {
      const animeRes = await shikimoriFetch(`${BASE_URL}/animes/${shikimoriId}`);
      if (animeRes.ok) {
        const data = await animeRes.json();
        const anilistBanner = await getAnilistBackdrop(data.name);
        if (anilistBanner) {
          const proxied = proxyImage(anilistBanner);
          if (proxied) {
            backdropCache.set(cacheKey, proxied);
            return proxied;
          }
        }
      }
    } else {
      console.log(`[getAnimeBackdrop] AniList disabled for ${shikimoriId}`);
    }
    
    backdropCache.set(cacheKey, null);
    return null;
  } catch { 
    backdropCache.set(cacheKey, null);
    return null; 
  }
}

async function getAnilistBackdrop(searchTitle: string): Promise<string | null> {
  try {
    const response = await fetch('https://graphql.anilist.co', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `query ($search: String) { Media (search: $search, type: ANIME, sort: SEARCH_MATCH) { bannerImage coverImage { extraLarge } } }`,
        variables: { search: searchTitle }
      }),
      next: { revalidate: 86400 }
    });
    const json = await response.json();
    return json?.data?.Media?.bannerImage || json?.data?.Media?.coverImage?.extraLarge || null;
  } catch { return null; }
}