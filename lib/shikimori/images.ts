import { upgradeShikimoriUrl, generateArtPoster, normalizeShikimoriUrl } from "./utils";
import { shikimoriFetch, shikimoriJson } from "./client";
import { BASE_URL } from "./config";
import { isExternalImageUrl } from "../image-loader";
import {
  isImageUrlFresh,
  SIGNED_IMAGE_URL_REFRESH_BUFFER_MS,
} from "../signed-image-url";

export { getSignedImageUrlExpiresAt } from "../signed-image-url";

// Кэш для постеров и фонов
const posterCache = new Map<string, string>();
const backdropCache = new Map<string, string | null>();
// Очередь для запросов с задержкой
let requestQueue = Promise.resolve();
const REQUEST_DELAY = 50; // 50ms между запросами (ускорено для быстрой загрузки)
// Обложки «в полёте» — по ключу кэша. Одна и та же карточка встречается в
// hero, каталоге и «продолжить просмотр», и без этой карты каждый экземпляр
// запускал полный поиск постера заново.
const posterInflight = new Map<string, Promise<string>>();

function getCachedPoster(cacheKey: string): string | null {
  const cachedPoster = posterCache.get(cacheKey);
  if (!cachedPoster) return null;

  if (!isImageUrlFresh(cachedPoster, Date.now(), SIGNED_IMAGE_URL_REFRESH_BUFFER_MS)) {
    posterCache.delete(cacheKey);
    return null;
  }

  return cachedPoster;
}

function cachePoster(cacheKey: string, poster: string): void {
  if (!isImageUrlFresh(poster, Date.now(), SIGNED_IMAGE_URL_REFRESH_BUFFER_MS)) {
    posterCache.delete(cacheKey);
    return;
  }

  posterCache.set(cacheKey, poster);
}

/**
 * Вспомогательная функция для проксирования картинок через Weserv.nl
 * Обходит 403 ошибки от Shikimori, MyAnimeList и других источников
 * Для SEO схем используем локальный прокси для thumbnails
 */
export function proxyImage(url: string | null | undefined, forSchema: boolean = false): string | null {
  if (!url) return null;
  
  // For schema.org markup, use local proxy to avoid external robots.txt blocking
  if (forSchema && isExternalImageUrl(url)) {
    return `/api/thumbnail-proxy?url=${encodeURIComponent(url)}`;
  }
  
  // Временно отключаем проксирование из-за проблем с Next.js
  // Если будут 403 ошибки, можно будет добавить unoptimized prop к Image компонентам
  return url;
}

/**
 * URL постера, пригодный для schema.org-разметки.
 *
 * Зачем прокси
 * ------------
 * Googlebot не ходит на shikimori.one и anilist.co за картинками: у чужих
 * сайтов `robots.txt` закрывает /system, и разметка осталась бы без
 * изображения. Поэтому наружу отдаём свой прокси.
 *
 * Почему обязательно абсолютный URL
 * --------------------------------
 * Google требует в `image` и `thumbnailUrl` полный адрес с протоколом и
 * хостом. Относительный путь (`/api/thumbnail-proxy?url=…`) он не
 * разворачивает: подставлять относительные адреса умеет только Next в
 * тегах `<meta property="og:image">`, а JSON-LD уходит в `<script>` как
 * есть. С относительным адресом картинка в разметке просто не засчитывалась
 * — то есть видео-сниппеты не могли появиться в принципе.
 *
 * `baseUrl` обязателен именно поэтому: без него функция вернула бы
 * относительный путь и проблема осталась бы незаметной в коде.
 */
export function getSchemaPosterUrl(posterUrl: string | null | undefined, baseUrl?: string): string {
  if (!posterUrl) return '';

  // Use local proxy for external images to avoid robots.txt blocking
  const resolved = isExternalImageUrl(posterUrl)
    ? `/api/thumbnail-proxy?url=${encodeURIComponent(posterUrl)}`
    : posterUrl;

  return toAbsoluteUrl(resolved, baseUrl);
}

/**
 * Развернуть относительный адрес в абсолютный.
 *
 * Уже абсолютные (http/https, `data:`) не трогаем: `new URL(dataUri, base)`
 * вернул бы мусор, а `data:` в разметке всё равно бесполезен, но ломать его
 * незачем.
 */
function toAbsoluteUrl(value: string, baseUrl?: string | null): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (!baseUrl) return trimmed
  if (/^(https?:)?\/\//i.test(trimmed) || /^data:/i.test(trimmed)) return trimmed

  const origin = baseUrl.replace(/\/+$/, '')
  return trimmed.startsWith('/') ? `${origin}${trimmed}` : `${origin}/${trimmed}`
}

function delayRequest(): Promise<void> {
  requestQueue = requestQueue.then(() => new Promise(resolve => setTimeout(resolve, REQUEST_DELAY)));
  return requestQueue;
}

function isHighQualityImage(url: string, isPoster: boolean = true): boolean {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  // Reject non-image URLs (HTML pages, etc.)
  if (!/\.(jpg|jpeg|png|webp|avif|gif|svg)(\?|$)/.test(lowerUrl)) return false;
  if (['missing', 'stub', 'placeholder', 'default'].some(s => lowerUrl.includes(s))) return false;
  if (['x96', 'x48', 'x160'].some(s => lowerUrl.includes(s))) return false;
  if (isPoster) return true;
  if (['preview', 'thumb', 'thumbnail', 'small'].some(s => lowerUrl.includes(s))) return false;
  const sizeMatch = url.match(/(\d+)x(\d+)/);
  if (sizeMatch && parseInt(sizeMatch[1]) < 800) return false;
  return true;
}

/**
 * Подобрать обложку тайтла.
 *
 * `excludeShikimori` нужен для восстановления после 404. Ссылка на обложку с
 * Shikimori может отдавать 404, и `isHighQualityImage` этого не замечает: он
 * смотрит только на вид URL и никогда не запрашивает картинку. Поэтому
 * «фоллбэк на другой провайдер» возвращал ровно ту же сломанную ссылку —
 * обложка с шики и обложка с прокси совпадали, а второй круг восстановления
 * был невозможен. С `true` шаги 1 и 6 пропускаются, и поиск идёт сразу
 * к AniList / Kitsu / Kodik / MAL.
 */
export async function resolveBestPoster(shikimoriUrl: string, romajiName: string, russianName: string, shikimoriId: string, disableExternalAPIs: boolean = false, excludeShikimori: boolean = false): Promise<string> {
  const cacheKey = `${shikimoriId}-${romajiName}-${russianName}-${disableExternalAPIs}-${excludeShikimori}`;
  
  // Проверяем кэш, но не возвращаем сохранённые URL страниц вместо изображений
  const cachedPoster = getCachedPoster(cacheKey);
  if (cachedPoster && (cachedPoster.startsWith('data:') || isHighQualityImage(cachedPoster, true))) {
    return cachedPoster;
  }
  if (cachedPoster) {
    posterCache.delete(cacheKey);
  }

  // Дедупликация: пока идёт поиск обложки для этого тайтла, второй вызов
  // ждёт тот же промис. Иначе холодный рендер главной запускал до 12
  // параллельных поисков (AniList → Kitsu → Kodik → MAL на каждый промах).
  const pending = posterInflight.get(cacheKey);
  if (pending) return pending;

  const request = resolveBestPosterUncached(
    shikimoriUrl,
    romajiName,
    russianName,
    shikimoriId,
    disableExternalAPIs,
    excludeShikimori,
    cacheKey,
  ).finally(() => {
    posterInflight.delete(cacheKey);
  });
  posterInflight.set(cacheKey, request);
  return request;
}

async function resolveBestPosterUncached(
  shikimoriUrl: string,
  romajiName: string,
  russianName: string,
  shikimoriId: string,
  disableExternalAPIs: boolean,
  excludeShikimori: boolean,
  cacheKey: string,
): Promise<string> {
  const targetName = russianName || romajiName || "Anime";
  
  // Шаг 1: Пробуем Shikimori через прокси (всегда, даже если внешние API
  // отключены) — если только он не исключён заведомо сломанной ссылкой.
  if (!excludeShikimori) {
    const upgradedUrl = upgradeShikimoriUrl(shikimoriUrl);
    if (isHighQualityImage(upgradedUrl, true)) {
      const proxiedUrl = proxyImage(upgradedUrl, false);
      if (proxiedUrl) {
        cachePoster(cacheKey, proxiedUrl);
        return proxiedUrl;
      }
    }
  }

  // Если внешние API отключены (для гача), используем только фоллбэк
  if (disableExternalAPIs) {
    console.log(`[resolveBestPoster] Using fallback for ${targetName} (external APIs disabled)`);
    const fallback = generateArtPoster(targetName);
    cachePoster(cacheKey, fallback);
    return fallback;
  }

  const namesToTry = [romajiName, russianName].filter(Boolean);

  // Шаги 2–5: источники обложек проверяются ЗАПРОСОМ НАПРЯМУЮ, а не цепочкой.
  //
  // Раньше это была последовательная лестница: AniList → Kitsu → Kodik → MAL,
  // и на каждый промах платилось по кругу сети (+50 мс искусственной задержки).
  // Для тайтла без обложки на Shikimori это до 5 кругов ≈ восемь секунд
  // SSR-времени на ОДНУ карточку — ровно тот «холодный старт главной» из
  // аудита. Источники независимы, поэтому запускаем их одновременно и берём
  // первый успешный ответ по приоритету.
  //
  // Kodik грузим лениво: модуль не должен попадать в клиентские бандлы.
  const sources: Array<{ name: string; run: () => Promise<string | null> }> = [
    { name: "anilist", run: () => getAnilistPoster(namesToTry[0] || targetName) },
    { name: "kitsu", run: () => getKitsuPoster(namesToTry[0] || targetName) },
    {
      name: "kodik",
      run: async () => {
        const { getKodikPoster } = await import("../kodik");
        return getKodikPoster(shikimoriId);
      },
    },
    { name: "mal", run: () => getMyAnimeListPoster(namesToTry[0] || targetName) },
  ];

  const results = await Promise.allSettled(
    sources.map(async (source) => {
      await delayRequest();
      return { url: await source.run(), name: source.name };
    }),
  );

  for (const result of results) {
    if (result.status !== "fulfilled" || !result.value.url) continue;
    const proxied = proxyImage(result.value.url, false);
    if (proxied) {
      cachePoster(cacheKey, proxied);
      return proxied;
    }
  }

  // Второй круг по второму названию — только если первый не дал ничего.
  // Обычно сюда не доходит: обычно хватает первого имени.
  const secondName = namesToTry[1];
  if (secondName && secondName !== namesToTry[0]) {
    for (const lookup of [getAnilistPoster, getMyAnimeListPoster]) {
      await delayRequest();
      const found = await lookup(secondName);
      const proxied = found && proxyImage(found, false);
      if (proxied) {
        cachePoster(cacheKey, proxied);
        return proxied;
      }
    }
  }

  // Шаг 6: Резервный вариант - оригинальный Shikimori через прокси.
  // Пропускаем при excludeShikimori: повторно отдавать ссылку, которая уже
  // показала 404, бессмысленно — это тот самый круг, из-за которого обложка
  // и не восстанавливалась.
  if (!excludeShikimori && shikimoriUrl) {
    const fullShikimoriUrl = shikimoriUrl.startsWith('http') 
      ? shikimoriUrl 
      : `https://shikimori.one${shikimoriUrl}`;
    if (isHighQualityImage(fullShikimoriUrl, true)) {
      const proxied = proxyImage(fullShikimoriUrl, false);
      if (proxied) {
        cachePoster(cacheKey, proxied);
        return proxied;
      }
    }
  }

  // Шаг 7: Фоллбэк - генерируем заглушку
  const fallback = generateArtPoster(targetName);
  cachePoster(cacheKey, fallback);
  return fallback;
}

// getKodikPoster импортируется из lib/kodik.ts (бесплатный токен + kodik-api.com).
// Локальная реализация на нерабочем kodikapi.com/v2/animes удалена.

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
      // Poster URLs from Kitsu are presigned and may expire in as little as 15m.
      // Do not persist the API response in Next's Data Cache past that expiry.
      cache: "no-store",
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