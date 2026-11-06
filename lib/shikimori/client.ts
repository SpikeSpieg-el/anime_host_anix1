import { HEADERS } from "./config";
import {
  toActiveShikimoriOrigin,
  noteShikimoriFailure,
  maybeRefreshShikimoriMirror,
} from "./mirror";

type ShikimoriCacheEntry = {
  freshUntil: number;
  staleUntil: number;
  value: unknown;
};

const SHIKIMORI_JSON_CACHE = new Map<string, ShikimoriCacheEntry>();
// Запросы «в полёте» — по ключу кэша.
//
// Зачем это нужно. Главная страница делает шесть параллельных выборок, а
// `/watch` — аниме, франшизу и обзор редакции. `React.cache` в Next
// дедуплицирует запросы ТОЛЬКО внутри одного рендера (и только для
// `fetch`), поэтому два одновременных запроса страницы запускали штуку
// одинаковых обращений к Shikimori: второй ждал шимимори, стоял в
// 200-миллисекундном rate-limit'е и всё равно получал тот же ответ. На
// холодном старте это и давало секунды TTFB.
//
// Теперь второй запрос просто ждёт первый.
const SHIKIMORI_INFLIGHT = new Map<string, Promise<unknown>>();

// Простой rate limiting для индивидуальных запросов
let lastRequestTime = 0;

// Сколько живёт запись в кэше, если вызывающий не передал ttlMs.
// 30 секунд было мало: любая пауза между посетителями выбрасывала запись, и
// следующий посетитель снова ждал полный сетевой круг. Ограничитель — то, что
// каждая выборка и так помечена своим `next.revalidate` в lib/shikimori/api.ts.
const DEFAULT_TTL_MS = 5 * 60_000;
const DEFAULT_STALE_TTL_MS = 60 * 60_000;

function shikimoriCacheKey(input: string, init?: RequestInit): string {
  const method = (init?.method ?? "GET").toUpperCase();
  const body = typeof init?.body === "string" ? init?.body : "";
  return `${method}:${input}:${body}`;
}

export async function shikimoriFetch(input: string, init?: RequestInit & { next?: any }, retries = 1) {
  const controller = new AbortController();
  const timeoutMs = 15_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const targetUrl = toActiveShikimoriOrigin(input);
    console.log(`[Shikimori] Fetching: ${targetUrl}${targetUrl !== input ? ` (зеркало для ${input})` : ""}`);
    const res = await fetch(targetUrl, {
      ...init,
      headers: { ...HEADERS, ...(init?.headers ?? {}) },
      signal: controller.signal
    });

    console.log(`[Shikimori] Response status: ${res.status} for ${input}`);
    if (res.status >= 500) {
      // 5xx (например, Cloudflare 522 при лежащем бэкенде) — сигнал проверить
      // остальные зеркала; фоново, без задержки ответа
      noteShikimoriFailure();
    }
    if (res.status === 429) {
      console.warn(`[Shikimori] Rate limited for ${input}`);
      return res; // Rate limit
    }
    return res;
  } catch (error) {
    console.error(`[Shikimori] Fetch error for ${input}:`, error);
    noteShikimoriFailure();
    if (retries > 0) {
      // Exponential backoff: wait 2^retries * 100ms before retry
      const backoffMs = Math.pow(2, retries) * 100;
      await new Promise(resolve => setTimeout(resolve, backoffMs));
      return shikimoriFetch(input, init, retries - 1);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function loadFromNetwork<T>(
  input: string,
  init: (RequestInit & { next?: any }) | undefined,
  options: { ttlMs: number; staleTtlMs: number; fallback: T },
  cached: ShikimoriCacheEntry | undefined,
): Promise<T> {
  const { ttlMs, staleTtlMs, fallback } = options;

  // Add rate limiting delay for non-cached requests
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  const MIN_REQUEST_INTERVAL = 200; // 200ms between requests

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  try {
    const res = await shikimoriFetch(input, init);
    lastRequestTime = Date.now();

    if (res.status === 429) {
      console.warn(`[Shikimori] Rate limit hit for ${input}, using stale cache if available`);
      if (cached && Date.now() <= cached.staleUntil) {
        console.log(`[Shikimori] Using stale cache for ${input}`);
        return cached.value as T;
      }
      console.log(`[Shikimori] No cache available, returning fallback for ${input}`);
      return fallback;
    }

    if (!res.ok) {
      console.error(`[Shikimori] Non-OK response ${res.status} for ${input}`);
      if (cached && Date.now() <= cached.staleUntil) return cached.value as T;
      return fallback;
    }

    const data = (await res.json()) as T;
    if ((init?.method ?? "GET").toUpperCase() === "GET") {
      SHIKIMORI_JSON_CACHE.set(shikimoriCacheKey(input, init), {
        freshUntil: Date.now() + ttlMs,
        staleUntil: Date.now() + Math.max(staleTtlMs, ttlMs),
        value: data
      });
    }
    return data;
  } catch (error) {
    console.error(`[Shikimori] JSON parse or fetch error for ${input}:`, error);
    if (cached && Date.now() <= cached.staleUntil) {
      console.log(`[Shikimori] Using stale cache for ${input} after error`);
      return cached.value as T;
    }
    console.log(`[Shikimori] No cache available after error, returning fallback for ${input}`);
    return fallback;
  }
}

export async function shikimoriJson<T>(
  input: string,
  init?: RequestInit & { next?: any },
  options?: { ttlMs?: number; staleTtlMs?: number; fallback: T; }
): Promise<T> {
  // Фоновая перепроверка зеркал, если долго не проверяли
  maybeRefreshShikimoriMirror();

  const ttlMs = options?.ttlMs ?? DEFAULT_TTL_MS;
  const staleTtlMs = options?.staleTtlMs ?? DEFAULT_STALE_TTL_MS;
  const key = shikimoriCacheKey(input, init);
  const method = (init?.method ?? "GET").toUpperCase();

  const cached = SHIKIMORI_JSON_CACHE.get(key);
  if (cached) {
    if (Date.now() <= cached.freshUntil) {
      return cached.value as T;
    }

    // Запись протухла, но ещё в stale-окне: отдаём её СРАЗУ и обновляем в
    // фоне (stale-while-revalidate). Именно этого не хватало watch-страницам:
    // вместо ожидания Shikimori посетитель получает готовый HTML, а свежесть
    // догоняется следующим запросом.
    if (Date.now() <= cached.staleUntil && method === "GET" && !SHIKIMORI_INFLIGHT.has(key)) {
      const revalidation = loadFromNetwork(
        input,
        init,
        { ttlMs, staleTtlMs, fallback: cached.value as T },
        cached,
      ).finally(() => {
        SHIKIMORI_INFLIGHT.delete(key);
      });
      SHIKIMORI_INFLIGHT.set(key, revalidation);
      return cached.value as T;
    }
  }

  // Дедупликация параллельных запросов одного и того же URL.
  const inflight = SHIKIMORI_INFLIGHT.get(key);
  if (inflight) {
    return inflight as Promise<T>;
  }

  const request = loadFromNetwork(input, init, { ttlMs, staleTtlMs, fallback: options!.fallback }, cached)
    .finally(() => {
      SHIKIMORI_INFLIGHT.delete(key);
    });
  SHIKIMORI_INFLIGHT.set(key, request);
  return request;
}
