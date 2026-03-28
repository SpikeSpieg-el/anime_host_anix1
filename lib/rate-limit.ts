import { NextRequest, NextResponse } from "next/server"
import { LRUCache } from "lru-cache"

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
      rateLimitStore.set(identifier, requestsInWindow)

      return {
        success: true,
        remaining: maxRequests - requestsInWindow.length,
        reset,
      }
    },
  }
}

// Default rate limiters for different use cases
export const rateLimiters = {
  // Strict: 10 requests per minute (for auth endpoints)
  strict: createRateLimiter({ interval: 60000, maxRequests: 10 }),
  
  // Standard: 60 requests per minute (for general API)
  standard: createRateLimiter({ interval: 60000, maxRequests: 60 }),
  
  // Lenient: 100 requests per minute (for data fetching)
  lenient: createRateLimiter({ interval: 60000, maxRequests: 100 }),
  
  // Proxy: 30 requests per minute (for video proxy)
  proxy: createRateLimiter({ interval: 60000, maxRequests: 30 }),
}

export function getClientIP(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for")
  const realIP = request.headers.get("x-real-ip")
  
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }
  
  if (realIP) {
    return realIP
  }
  
  return "127.0.0.1" // Fallback for local development
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
