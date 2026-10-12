import { NextRequest, NextResponse } from "next/server"
import { LRUCache } from "lru-cache"
import { isValidIp } from "@/lib/ip-block"

interface RateLimitOptions {
  interval: number // Time window in ms
  maxRequests: number // Max requests per interval
}

interface RateLimitResult {
  success: boolean
  remaining: number
  reset: number
}

// In-memory store for rate limiting (per IP)
const rateLimitStore = new LRUCache<string, number[]>({
  max: 10000,
  ttl: 60000, // 1 minute default TTL for entries
})

export function createRateLimiter(options: RateLimitOptions) {
  const { interval, maxRequests } = options

  return {
    checkLimit(identifier: string): RateLimitResult {
      const now = Date.now()
      const windowStart = now - interval

      const existingRequests = rateLimitStore.get(identifier) || []
      const requestsInWindow = existingRequests.filter((timestamp) => timestamp > windowStart)

      const reset = now + interval

      if (requestsInWindow.length >= maxRequests) {
        return {
          success: false,
          remaining: 0,
          reset,
        }
      }

      requestsInWindow.push(now)
      rateLimitStore.set(identifier, requestsInWindow, { ttl: interval })

      return {
        success: true,
        remaining: maxRequests - requestsInWindow.length,
        reset,
      }
    },
    resetLimit(identifier: string): void {
      rateLimitStore.delete(identifier)
    },
  }
}

// Default rate limiters for different use cases
export const rateLimiters = {
  // Admin login: strict per-process backstop. Add edge/WAF limiting too for multi-instance deployments.
  adminLogin: createRateLimiter({ interval: 15 * 60_000, maxRequests: 5 }),

  // Strict: 10 requests per minute (for auth endpoints)
  strict: createRateLimiter({ interval: 60000, maxRequests: 10 }),
  
  // Standard: 60 requests per minute (for general API)
  standard: createRateLimiter({ interval: 60000, maxRequests: 60 }),
  
  // Lenient: 100 requests per minute (for data fetching)
  lenient: createRateLimiter({ interval: 60000, maxRequests: 100 }),
  
  // Proxy: 30 requests per minute (for video proxy)
  proxy: createRateLimiter({ interval: 60000, maxRequests: 30 }),
}

/**
 * Реальный адрес клиента для рейт-лимита.
 *
 * ВАЖНО: возвращает `null`, когда адрес определить не удалось, и НЕ
 * подставляет заглушку вида `127.0.0.1`.
 *
 * Раньше здесь был возврат `"127.0.0.1"`, и это была мина замедленного
 * действия: если прокси не передал ни один из заголовков, ВСЕ посетители
 * сайта получали один и тот же ключ. Значит общий лимит делился между
 * всеми — при 20 запросах в минуту на ключ плеер переставал открываться у
 * всех, кто зашёл после, и «не работает» видели бы десятки живых людей
 * вместо сканера.
 *
 * Приоритет заголовков повторяет `getClientIp` из `lib/ip-block`: там же
 * адрес нужен для чёрного списка, и расхождение двух реализаций означало бы
 * «банят по одному адресу, а лимитуем по другому».
 *
 * `null` означает «не знаю, кто пришёл». Вызывающая сторона обязана в этом
 * случае ПРОПУСТИТЬ ограничение, а не блокировать всех подряд: отсутствие
 * лимита для неизвестного адреса — небольшая потеря, отказ обслуживать
 * живых зрителей — нет.
 */
export function getClientIP(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    // За прокси адрес клиента — первым в списке; дальше идут адреса
    // промежуточных хопов, они клиенту не принадлежат.
    const first = forwarded.split(",")[0]?.trim()
    if (first && isValidIp(first)) return first
  }

  // Cloudflare отдаёт исходный адрес здесь и не обязательно дублирует его в
  // x-forwarded-for.
  const cfIp = request.headers.get("cf-connecting-ip")?.trim()
  if (cfIp && isValidIp(cfIp)) return cfIp

  const realIp = request.headers.get("x-real-ip")?.trim()
  if (realIp && isValidIp(realIp)) return realIp

  return null
}

/**
 * Ключ рейт-лимита для запроса.
 *
 * `null`, если адрес неизвестен: вызывающий код обязан трактовать это как
 * «пропустить ограничение», а не подставлять общий ключ для всех.
 */
export function getRateLimitKey(request: NextRequest): string | null {
  return getClientIP(request)
}

export function createRateLimitResponse(resetTime: number): NextResponse {
  const resetDate = new Date(resetTime)
  
  return NextResponse.json(
    {
      error: "Too many requests",
      message: "Rate limit exceeded. Please try again later.",
      retryAfter: Math.ceil((resetTime - Date.now()) / 1000),
    },
    {
      status: 429,
      headers: {
        "X-RateLimit-Limit": "60",
        "X-RateLimit-Remaining": "0",
        "X-RateLimit-Reset": resetDate.toISOString(),
        "Retry-After": String(Math.ceil((resetTime - Date.now()) / 1000)),
      },
    }
  )
}

export function addRateLimitHeaders(response: NextResponse, result: RateLimitResult): NextResponse {
  const resetDate = new Date(result.reset)
  
  response.headers.set("X-RateLimit-Limit", "60")
  response.headers.set("X-RateLimit-Remaining", String(result.remaining))
  response.headers.set("X-RateLimit-Reset", resetDate.toISOString())
  
  return response
}
