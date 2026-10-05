/**
 * Защита плеера от автоматических антипиратских сканеров (F6 и подобных).
 *
 * Идея: ссылки на внешний видеохостинг НЕ ДОЛЖНЫ появляться ни в HTML
 * страниц, ни в ответах API, ни в атрибутах iframe. Вместо прямой ссылки
 * клиент получает непрозрачный зашифрованный токен вида
 *
 *   /embed/<токен>
 *
 * который расшифровывается ТОЛЬКО на сервере в момент отдачи страницы
 * плеера. Сканер, выкачивающий сайт, видит лишь наш собственный адрес.
 *
 * Слои защиты:
 *  1. Шифрованный токен (AES-256-GCM) с временем жизни — прямую ссылку
 *     нельзя ни прочитать, ни подделать, ни сконструировать.
 *  2. Отдача страницы плеера отдельным адресом /embed/..., закрытым
 *     в robots.txt и помеченным noindex.
 *  3. Фильтр известных ботов/краулеров по User-Agent и служебным
 *     заголовкам превью-режимов.
 *  4. Проверка Referer на странице плеера (защита от хотлинка).
 *
 * Модуль используется ТОЛЬКО на сервере (route handlers).
 */

import crypto from "node:crypto"

/* ------------------------------------------------------------------ */
/* Домены внешнего плеера                                              */
/* ------------------------------------------------------------------ */

// Без полного списка половина ссылок отдаст 403 на стороне видеохостинга.
export const PLAYER_DOMAINS = [
  "aniqit.com",
  "anivod.com",
  "kodikplayer.com",
  "kodik.cc",
  "kodik.info",
  "kodik.biz",
  "kodik-add.com",
]

export function isValidPlayerUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const domain = parsed.hostname.replace(/^www\./, "")
    return PLAYER_DOMAINS.some((d) => domain === d || domain.endsWith(`.${d}`))
  } catch {
    return false
  }
}

/** Приводит protocol-relative ссылки (`//host/...`) к абсолютным https. */
export function normalizePlayerUrl(url: string): string {
  const trimmed = url.trim()
  if (trimmed.startsWith("//")) return `https:${trimmed}`
  return trimmed
}

/* ------------------------------------------------------------------ */
/* Шифрованные токены ссылок                                           */
/* ------------------------------------------------------------------ */

/**
 * Секрет шифрования токенов.
 *
 * Задаётся переменной окружения PLAYER_LINK_SECRET. Если её нет —
 * используется встроенный ключ: он не «секретен» в строгом смысле,
 * но сканеры читают сайт как обычный посетитель и не имеют доступа
 * к исходникам, поэтому для защиты от автоматических страйков этого
 * достаточно. При ротации секрета старые токены перестают работать —
 * клиент просто перезапросит список озвучек при следующей ошибке.
 */
const FALLBACK_SECRET =
  "weebx-player-shield-v1:9f2c4e7a8b1d4f6e9a3c5b7d8e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f"

function getSecret(): string {
  const env = process.env.PLAYER_LINK_SECRET
  return env && env.trim() ? env.trim() : FALLBACK_SECRET
}

let cachedKey: Buffer | null = null
function getKey(): Buffer {
  if (!cachedKey) {
    cachedKey = crypto.createHash("sha256").update(getSecret()).digest()
  }
  return cachedKey
}

/** Время жизни токена: заметно больше любого кэша ответа со списком озвучек. */
export const PLAYER_TOKEN_TTL_SEC = 48 * 60 * 60 // 48 часов

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64url")
}

/**
 * Создаёт непрозрачный токен для ссылки на плеер.
 * Формат: base64url(iv[12] | authTag[16] | AES-256-GCM(JSON{u,e})).
 */
export function createPlayerToken(
  playerUrl: string,
  ttlSec: number = PLAYER_TOKEN_TTL_SEC
): string | null {
  const url = normalizePlayerUrl(playerUrl)
  if (!isValidPlayerUrl(url)) return null

  try {
    const iv = crypto.randomBytes(12)
    const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv)
    const payload = JSON.stringify({
      u: url,
      e: Math.floor(Date.now() / 1000) + Math.max(60, Math.floor(ttlSec)),
    })
    const encrypted = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()])
    const tag = cipher.getAuthTag()
    return toBase64Url(Buffer.concat([iv, tag, encrypted]))
  } catch {
    return null
  }
}

/**
 * Расшифровывает токен обратно в ссылку на плеер.
 * Возвращает `null`, если токен битый, подделан, протух или указывает
 * на посторонний домен.
 */
export function resolvePlayerToken(token: string): string | null {
  try {
    const raw = Buffer.from(token, "base64url")
    if (raw.length < 12 + 16 + 2) return null

    const iv = raw.subarray(0, 12)
    const tag = raw.subarray(12, 28)
    const data = raw.subarray(28)

    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv)
    decipher.setAuthTag(tag)
    const decrypted = Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8")

    const parsed = JSON.parse(decrypted) as { u?: unknown; e?: unknown }
    if (typeof parsed.u !== "string" || typeof parsed.e !== "number") return null
    if (parsed.e < Math.floor(Date.now() / 1000)) return null
    if (!isValidPlayerUrl(parsed.u)) return null

    return parsed.u
  } catch {
    return null
  }
}

/* ------------------------------------------------------------------ */
/* Очистка публичных ответов от прямых ссылок                          */
/* ------------------------------------------------------------------ */

type SeasonLite = { link?: string; episodes?: Record<string, string> | null } | null | undefined

/**
 * Kodik присылает карту сезонов вместе с прямыми ссылками на каждую серию.
 * Клиенту нужны ТОЛЬКО номера серий (ключи) — значения вычищаем, чтобы
 * в ответе API не оставалось ни одного внешнего адреса.
 */
export function scrubSeasons(
  seasons: Record<string, SeasonLite> | null | undefined
): Record<string, { episodes: Record<string, string> }> | undefined {
  if (!seasons || typeof seasons !== "object") return undefined

  const cleaned: Record<string, { episodes: Record<string, string> }> = {}
  for (const [seasonKey, season] of Object.entries(seasons)) {
    const episodes = season?.episodes
    if (!episodes || typeof episodes !== "object") {
      cleaned[seasonKey] = { episodes: {} }
      continue
    }
    cleaned[seasonKey] = {
      episodes: Object.fromEntries(Object.keys(episodes).map((ep) => [ep, ""])),
    }
  }
  return cleaned
}

/* ------------------------------------------------------------------ */
/* Фильтр ботов                                                        */
/* ------------------------------------------------------------------ */

/**
 * Известные краулеры, SEO-аудиторы, ИИ-парсеры, антипиратские сканеры
 * и «голые» HTTP-клиенты. Обычные браузеры пользователей под шаблон
 * не попадают.
 */
const BOT_UA_PATTERNS = [
  // Поисковики и их инфраструктура
  "googlebot", "adsbot-google", "mediapartners-google", "apis-google",
  "bingbot", "bingpreview", "msnbot", "slurp", "yahoo",
  "duckduckbot", "baiduspider", "sogou", "exabot", "ia_archiver",
  "applebot", "facebookexternalhit", "facebot", "twitterbot", "linkedinbot",
  "pinterest", "slackbot", "telegrambot", "discordbot", "whatsapp",
  "redditbot", "vkshare", "odnoklassniki", "embedly", "iframely",
  "yandex", "seznambot", "petalbot", "bytespider", "gptbot", "ccbot",
  "amazonbot", "anthropic-ai", "claudebot", "claude-web", "perplexitybot",
  "cohere-ai", "bytedance",
  // SEO / аудит / мониторинг — то, чем часто сканируют сайты целиком
  "semrush", "ahrefs", "mj12bot", "mj12", "dotbot", "rogerbot", "screaming frog",
  "dataforseo", "serpstat", "lighthouse", "chrome-lighthouse", "gtmetrix",
  "pingdom", "uptimerobot", "statuscake", "sitebulb", "netpeak",
  // Антипиратские и «безопасные» сканеры
  "group-ib", "f6", "qrator", "ddos-guard", "zgrab", "masscan", "nmap",
  "censys", "shodan", "urlscan",
  // Headless-браузеры и автоматизация
  "headless", "phantomjs", "selenium", "webdriver", "puppeteer", "playwright",
  "nightmare", "cypress",
  // HTTP-библиотеки и утилиты (у реального браузера такого UA не бывает)
  "curl", "wget", "python-", "python ", "go-http-client", "okhttp", "java/",
  "libwww", "httpclient", "node-fetch", "axios/", "fetch/", "php/", "ruby",
  "perl", "powershell", "insomnia", "postmanruntime", "apache-httpclient",
  "httpie", "scrapy", "aiohttp", "undici",
  // Обобщённые маркеры
  "bot/", "/bot", "bot;", "spider", "crawler", "crawl ", "archive.org",
  "wayback", "preview", "scanner",
]

const BOT_UA_REGEX = new RegExp(BOT_UA_PATTERNS.map((p) => escapeRegExp(p)).join("|"), "i")

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

/** Заголовки, которые ставят браузеры/сервисы в режиме предпросмотра. */
const PREVIEW_HEADERS = ["x-purpose", "purpose", "x-moz", "sec-purpose", "x-research"]

/**
 * Запрос похож на автоматический сканер.
 *
 * Важно: проверка консервативная — блокируем только явные сигнатуры,
 * чтобы случайно не отрезать реального зрителя. Основную защиту дают
 * шифрованные токены и отсутствие ссылок в разметке, а этот фильтр —
 * дополнительная сетка от «глупых» ботов.
 */
export function isCrawlerRequest(headers: Headers): boolean {
  const ua = headers.get("user-agent")
  if (!ua) {
    // Браузер всегда присылает User-Agent. Пустой UA + запрос страницы
    // плеера/озвучек — почти наверняка скрипт.
    return true
  }
  if (BOT_UA_REGEX.test(ua)) return true

  for (const name of PREVIEW_HEADERS) {
    const value = headers.get(name)
    if (value && /preview|research/i.test(value)) return true
  }

  return false
}

/**
 * Наш собственный хост глазами запроса. Берём из заголовка Host
 * (его браузер всегда ставит правильно), а не из request.url —
 * тот может содержать bind-адрес сервера (например 0.0.0.0).
 */
export function getRequestHost(headers: Headers, fallbackUrl: string): string {
  const host = headers.get("x-forwarded-host") || headers.get("host")
  if (host) return host.split(":")[0]
  try {
    return new URL(fallbackUrl).hostname
  } catch {
    return ""
  }
}

/**
 * Referer указывает на чужой сайт — страницу плеера хотят встроить
 * или выкачать напрямую. Пустой Referer пропускаем: некоторые
 * приватные режимы/расширения вырезают его у реальных пользователей.
 */
export function isCrossOriginReferer(
  referer: string | null,
  headers: Headers,
  fallbackUrl: string
): boolean {
  if (!referer) return false
  try {
    const refHost = new URL(referer).hostname
    const selfHost = getRequestHost(headers, fallbackUrl)
    if (!selfHost) return false
    return refHost !== selfHost
  } catch {
    return false
  }
}
