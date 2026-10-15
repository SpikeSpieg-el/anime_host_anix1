/**
 * Определение ПОДТВЕРЖДЁННЫХ поисковых краулеров (Googlebot, YandexBot).
 *
 * Зачем это нужно именно здесь
 * ----------------------------
 * Google прямо требует отдать краулеру стабильный адрес файла видео, но
 * открывать его всем опасно: сайт уже получал антипиратские страйки из-за
 * массового обхода плеера. Google предлагает ровно этот выход в своей
 * документации:
 *
 *   "If you're concerned about bad actors accessing your content, you can
 *    verify Googlebot before displaying a stable version of your media URLs.
 *    You can choose to serve the contentUrl property only to trusted clients
 *    like Googlebot, whereas other clients accessing your page wouldn't see
 *    that field."
 *    — developers.google.com/search/docs/appearance/video
 *
 * То есть доступ к медиа даётся не «по User-Agent», а после проверки, что за
 * запросом действительно стоит краулер поисковика. Сканеры, подставившие
 * строку "Googlebot" в User-Agent, проверку не проходят: подделывать заголовок
 * легко, а PTR-запись адреса — нет.
 *
 * Порядок проверки (обе рекомендации — из официальных инструкций Google
 * «Verifying Googlebot» и Яндекса «Как проверить робота Яндекса»):
 *   1. Отсечь всё, что не похоже на краулера, по User-Agent — дешёвый фильтр,
 *      чтобы не дёргать DNS на каждый запрос.
 *   2. Обратный DNS (PTR) адреса клиента: должен указывать на домен
 *      поисковика.
 *   3. Прямой DNS (A/AAAA) найденного имени: должен вернуть тот же адрес.
 *      Без этого шага любой может поднять PTR-запись на сторонний домен и
 *      выдать себя за Googlebot.
 *
 * ВАЖНО: модуль использует `node:dns`, поэтому работает только в Node
 * runtime (server components, route handlers). В Edge его импортировать
 * нельзя.
 */

import { promises as dns } from "node:dns"
import { getClientIp } from "@/lib/ip-block"

/** Домены, PTR-запись которых Google считает своим. */
const GOOGLE_BOT_DOMAINS = ["googlebot.com", "bot.google.com", "google.com"]

/** Домены Яндекса: PTR Яндекса заканчивается на .yandex.ru или .yandex.net. */
const YANDEX_BOT_DOMAINS = ["yandex.ru", "yandex.net"]

/**
 * Строки User-Agent, которые считаем кандидатами в краулер.
 *
 * Это лишь ПЕРВЫЙ фильтр — окончательное решение принимает reverse DNS.
 * Важно: `Googlebot-Image` и `Googlebot-Video` наследуют `googlebot`,
 * поэтому проверка идёт по вхождению подстроки, а не по точному равенству.
 */
const CRAWLER_UA_PATTERNS = [
  /googlebot/i,
  /google-inspectiontool/i,
  /storebot-google/i,
  /yandexbot/i,
  /yandeximages/i,
  /yandexvideo/i,
  /yandexmobilebot/i,
  /yandexmetrika/i,
]

/** Сколько живёт результат проверки. Положительный — дольше, отрицательный — меньше. */
const POSITIVE_TTL_MS = 30 * 60 * 1000
const NEGATIVE_TTL_MS = 10 * 60 * 1000

/** Таймаут на DNS-запрос: медленный резолвер не должен висеть на запросе. */
const DNS_LOOKUP_TIMEOUT_MS = 1500

export type VerifiedCrawler = "googlebot" | "yandexbot"

/* ------------------------------------------------------------------ */
/* Кэш                                                                 */
/* ------------------------------------------------------------------ */

type CacheEntry = { verdict: VerifiedCrawler | null; expires: number }

const verdictCache = new Map<string, CacheEntry>()

/** Не даём кэшу расти без границ при сканировании с множества адресов. */
const MAX_CACHE_ENTRIES = 5000

function readCache(ip: string): CacheEntry | null {
  const hit = verdictCache.get(ip)
  if (!hit) return null
  if (hit.expires <= Date.now()) {
    verdictCache.delete(ip)
    return null
  }
  return hit
}

function writeCache(ip: string, verdict: VerifiedCrawler | null): void {
  if (verdictCache.size >= MAX_CACHE_ENTRIES) {
    // Дешёвая стратегия: сбрасываем целиком. Точность стратегии не важна —
    // важно лишь не расти без границ и не держать память.
    verdictCache.clear()
  }
  verdictCache.set(ip, {
    verdict,
    expires: Date.now() + (verdict ? POSITIVE_TTL_MS : NEGATIVE_TTL_MS),
  })
}

/** Сброс кэша (используется в тестах и при ручной проверке). */
export function resetVerifiedCrawlerCache(): void {
  verdictCache.clear()
}

/* ------------------------------------------------------------------ */
/* Проверка                                                             */
/* ------------------------------------------------------------------ */

function isIpv4(value: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(value)
}

function isIpv6(value: string): boolean {
  return value.includes(":")
}

function stripZone(value: string): string {
  const zoneIndex = value.indexOf("%")
  return zoneIndex === -1 ? value : value.slice(0, zoneIndex)
}

function matchesDomain(hostname: string, domains: string[]): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "")
  return domains.some((domain) => host === domain || host.endsWith(`.${domain}`))
}

/** PTR-запись адреса. Возвращает нормализованный hostname или null. */
async function reverseLookup(ip: string): Promise<string | null> {
  try {
    const names = await withTimeout(dns.reverse(ip), DNS_LOOKUP_TIMEOUT_MS)
    if (!Array.isArray(names) || names.length === 0) return null
    return names[0].toLowerCase().replace(/\.$/, "")
  } catch {
    return null
  }
}

/** Прямой DNS: hostname → тот же адрес? Это второй шаг защиты от подделки PTR. */
async function resolvesBackTo(hostname: string, ip: string): Promise<boolean> {
  try {
    const resolved = await withTimeout(dns.lookup(hostname, { all: true }), DNS_LOOKUP_TIMEOUT_MS)
    return resolved.some((entry) => entry.address === ip)
  } catch {
    return false
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("dns-timeout")), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

/**
 * Определяет, кто стоит за запросом.
 *
 * Возвращает "googlebot" / "yandexbot", либо null. **Fail-closed**: при любой
 * ошибке DNS доступ НЕ выдаётся. Это осознанно — цена ложного «нет» в том,
 * что краулер не увидит плеер, а цена ложного «да» — возврат защиты, за
 * которую уже прилетали страйки.
 */
async function verifyIp(ipRaw: string): Promise<VerifiedCrawler | null> {
  const ip = stripZone(ipRaw.trim())
  if (!isIpv4(ip) && !isIpv6(ip)) return null

  const cached = readCache(ip)
  if (cached) return cached.verdict

  const hostname = await reverseLookup(ip)
  let verdict: VerifiedCrawler | null = null

  if (hostname) {
    const isGoogle = matchesDomain(hostname, GOOGLE_BOT_DOMAINS)
    const isYandex = matchesDomain(hostname, YANDEX_BOT_DOMAINS)

    if (isGoogle || isYandex) {
      // PTR сам по себе подделывается (достаточно своего домена с PTR).
      // Поэтому дополнительно требуем, чтобы имя обратно резолвилось в IP.
      const confirmed = await resolvesBackTo(hostname, ip)
      if (confirmed) verdict = isYandex ? "yandexbot" : "googlebot"
    }
  }

  writeCache(ip, verdict)
  return verdict
}

/**
 * Публичная проверка запроса.
 *
 * Шаг 1 (User-Agent) синхронный и дешёвый: если по нему запрос точно не
 * краулер, DNS не трогаем вообще.
 */
export async function getVerifiedCrawler(
  headers: Headers
): Promise<VerifiedCrawler | null> {
  const ua = headers.get("user-agent") || ""
  if (!CRAWLER_UA_PATTERNS.some((pattern) => pattern.test(ua))) return null

  const ip = getClientIp(headers)
  if (!ip) return null

  return verifyIp(ip)
}

/** Синхронная часть проверки: подходит ли User-Agent кандидатом в краулер. */
export function hasCrawlerUserAgent(headers: Headers): boolean {
  const ua = headers.get("user-agent") || ""
  return CRAWLER_UA_PATTERNS.some((pattern) => pattern.test(ua))
}

/** Это подтверждённый Googlebot (в т.ч. Googlebot-Image / -Video)? */
export function isGooglebot(crawler: VerifiedCrawler | null): boolean {
  return crawler === "googlebot"
}