import { upgradeShikimoriUrl, generateArtPoster, normalizeShikimoriUrl } from "./utils";
import { shikimoriFetch, shikimoriJson } from "./client";
import { BASE_URL } from "./config";

// Кэш для постеров и фонов
const posterCache = new Map<string, string>();
const backdropCache = new Map<string, string | null>();
// Очередь для запросов с задержкой
let requestQueue = Promise.resolve();
const REQUEST_DELAY = 50; // 50ms между запросами (ускорено для быстрой загрузки)

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
  
  const upgradedUrl = upgradeShikimoriUrl(shikimoriUrl);
  if (isHighQualityImage(upgradedUrl, true)) {
    posterCache.set(cacheKey, upgradedUrl);
    return upgradedUrl;
  }

  // Если внешние API отключены (для гача), используем только фоллбэк
  if (disableExternalAPIs) {
    console.log(`[resolveBestPoster] Using fallback for ${targetName} (external APIs disabled)`);
    const fallback = generateArtPoster(targetName);
    posterCache.set(cacheKey, fallback);
    return fallback;
  }

  // Попробуем другие источники (Kodik, Anilist, MAL) с задержкой
  const namesToTry = [romajiName, russianName].filter(Boolean);
  
  await delayRequest();
  const kodik = await getKodikPoster(shikimoriId);
  if (kodik) {
    posterCache.set(cacheKey, kodik);
    return kodik;
  }

  for (const name of namesToTry) {
    await delayRequest();
    const anilist = await getAnilistPoster(name);
    if (anilist) {
      posterCache.set(cacheKey, anilist);
      return anilist;
    }
    
    await delayRequest();
    const mal = await getMyAnimeListPoster(name);
    if (mal) {
      posterCache.set(cacheKey, mal);
      return mal;
    }
  }

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
    // 1. Screenshots - use only the first one
    const res = await shikimoriFetch(`${BASE_URL}/animes/${shikimoriId}/screenshots`);
    if (res.ok) {
      const data: any[] = await res.json();
      if (data && data.length > 0) {
        const result = normalizeShikimoriUrl(data[0].original);
        backdropCache.set(cacheKey, result);
        return result;
      }
    }
    
    // 2. Anilist Banner (если не отключен)
    if (!disableExternalAPIs) {
      const animeRes = await shikimoriFetch(`${BASE_URL}/animes/${shikimoriId}`);
      if (animeRes.ok) {
        const data = await animeRes.json();
        const anilistBanner = await getAnilistBackdrop(data.name);
        if (anilistBanner) {
          backdropCache.set(cacheKey, anilistBanner);
          return anilistBanner;
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