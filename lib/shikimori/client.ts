import { HEADERS } from "./config";

type ShikimoriCacheEntry = {
  freshUntil: number;
  staleUntil: number;
  value: unknown;
};

const SHIKIMORI_JSON_CACHE = new Map<string, ShikimoriCacheEntry>();

// Simple rate limiting for individual requests
let lastRequestTime = 0;

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
    console.log(`[Shikimori] Fetching: ${input}`);
    const res = await fetch(input, {
      ...init,
      headers: { ...HEADERS, ...(init?.headers ?? {}) },
      signal: controller.signal
    });

    console.log(`[Shikimori] Response status: ${res.status} for ${input}`);
    if (res.status === 429) {
      console.warn(`[Shikimori] Rate limited for ${input}`);
      return res; // Rate limit
    }
    return res;
  } catch (error) {
    console.error(`[Shikimori] Fetch error for ${input}:`, error);
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

export async function shikimoriJson<T>(
  input: string,
  init?: RequestInit & { next?: any },
  options?: { ttlMs?: number; staleTtlMs?: number; fallback: T; }
): Promise<T> {
  const ttlMs = options?.ttlMs ?? 30_000;
  const staleTtlMs = options?.staleTtlMs ?? 10 * 60_000;
  const key = shikimoriCacheKey(input, init);

  const cached = SHIKIMORI_JSON_CACHE.get(key);
  if (cached && Date.now() <= cached.freshUntil) {
    console.log(`[Shikimori] Cache hit for ${input}`);
    return cached.value as T;
  }

  // Add rate limiting delay for non-cached requests
  const timeSinceLastRequest = Date.now() - lastRequestTime;
  const MIN_REQUEST_INTERVAL = 200; // 200ms between requests

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const delay = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    console.log(`[Shikimori] Rate limiting: waiting ${delay}ms before request`);
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
      return options!.fallback;
    }

    if (!res.ok) {
      console.error(`[Shikimori] Non-OK response ${res.status} for ${input}`);
      if (cached && Date.now() <= cached.staleUntil) return cached.value as T;
      return options!.fallback;
    }

    const data = (await res.json()) as T;
    if ((init?.method ?? "GET").toUpperCase() === "GET") {
      SHIKIMORI_JSON_CACHE.set(key, {
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
    return options!.fallback;
  }
}