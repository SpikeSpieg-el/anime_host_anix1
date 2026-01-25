import { HEADERS } from "./config";

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

export async function shikimoriFetch(input: string, init?: RequestInit & { next?: any }, retries = 1) {
  const controller = new AbortController();
  const timeoutMs = 8_000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(input, {
      ...init,
      headers: { ...HEADERS, ...(init?.headers ?? {}) },
      signal: controller.signal
    });

    if (res.status === 429) return res; // Rate limit
    return res;
  } catch (error) {
    if (retries > 0) return shikimoriFetch(input, init, retries - 1);
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
  if (cached && Date.now() <= cached.freshUntil) return cached.value as T;

  try {
    const res = await shikimoriFetch(input, init);

    if (res.status === 429 || !res.ok) {
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
  } catch {
    if (cached && Date.now() <= cached.staleUntil) return cached.value as T;
    return options!.fallback;
  }
}