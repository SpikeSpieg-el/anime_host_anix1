/**
 * Подписанные прокси-ссылки для /api/animdl/hls|file|torrent.
 *
 * Прокси ходит на внешние CDN с нужным Referer, поэтому должен принимать
 * произвольные URL — чтобы его нельзя было использовать как открытый прокси,
 * каждый URL подписывается HMAC-подписью с TTL. Подпись генерируют только
 * наши же API-роуты (`stream`/`download`), браузер лишь воспроизводит её.
 */

import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto"

export type AnimdlProxyKind = "hls" | "file" | "torrent"

const KIND_TO_ROUTE: Record<AnimdlProxyKind, string> = {
  hls: "/api/animdl/hls",
  file: "/api/animdl/file",
  torrent: "/api/animdl/torrent",
}

// Секрет прокси. Приоритет: явный ANIMDL_PROXY_SECRET → стабильная производная
// от существующего серверного секрета (чтобы ссылки не умирали при рестарте
// контейнера и работали между репликами) → случайный (только локальный dev).
let proxySecret: string | null = null

/**
 * Чистая функция резолва секрета из окружения (покрыта юнит-тестом).
 */
export function resolveProxySecret(
  env: Record<string, string | undefined>,
): string {
  if (env.ANIMDL_PROXY_SECRET) return env.ANIMDL_PROXY_SECRET

  const base = env.SUPABASE_SERVICE_ROLE_KEY || env.VK_SERVICE_KEY
  if (base) {
    return createHash("sha256").update(`animdl-proxy:${base}`).digest("hex")
  }

  return randomUUID()
}

function getProxySecret(): string {
  if (!proxySecret) {
    proxySecret = resolveProxySecret(process.env)
  }
  return proxySecret
}

export function encodeProxyParam(value: string): string {
  return Buffer.from(value, "utf-8").toString("base64url")
}

export function decodeProxyParam(value: string): string | null {
  try {
    return Buffer.from(value, "base64url").toString("utf-8")
  } catch {
    return null
  }
}

function signPayload(kind: AnimdlProxyKind, url: string, referer: string, expires: number): string {
  return createHmac("sha256", getProxySecret())
    .update(`${kind}|${url}|${referer}|${expires}`)
    .digest("base64url")
}

export interface ProxyUrlOptions {
  /** Срок жизни ссылки в секундах (по умолчанию 12 часов — длинный просмотр). */
  ttlSeconds?: number
  /** Для file/torrent: отдать с Content-Disposition: attachment. */
  download?: boolean
  /** Имя файла для attachment. */
  filename?: string
}

export function createSignedProxyUrl(
  kind: AnimdlProxyKind,
  url: string,
  referer: string,
  options: ProxyUrlOptions = {},
): string {
  const ttl = Math.min(Math.max(options.ttlSeconds ?? 12 * 3600, 60), 24 * 3600)
  const expires = Math.floor(Date.now() / 1000) + ttl
  const signature = signPayload(kind, url, referer, expires)

  const params = new URLSearchParams({
    u: encodeProxyParam(url),
    r: encodeProxyParam(referer),
    e: String(expires),
    s: signature,
  })
  if (options.download) params.set("dl", "1")
  if (options.filename) params.set("n", encodeProxyParam(options.filename))

  return `${KIND_TO_ROUTE[kind]}?${params}`
}

export interface VerifiedProxyTarget {
  url: string
  referer: string
  download: boolean
  filename: string | null
}

export function verifyProxyRequest(
  kind: AnimdlProxyKind,
  params: URLSearchParams,
): VerifiedProxyTarget | null {
  const url = decodeProxyParam(params.get("u") ?? "")
  const referer = decodeProxyParam(params.get("r") ?? "") ?? ""
  const expires = Number(params.get("e") ?? "0")
  const signature = params.get("s") ?? ""

  if (!url || !/^https?:\/\//.test(url) || !expires || !signature) return null
  if (expires * 1000 < Date.now()) return null

  const expected = signPayload(kind, url, referer, expires)
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  return {
    url,
    referer,
    download: params.get("dl") === "1",
    filename: params.get("n") ? decodeProxyParam(params.get("n") as string) : null,
  }
}
