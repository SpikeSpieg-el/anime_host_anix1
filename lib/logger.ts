/**
 * Secure logging utility for production
 * - Strips sensitive data from logs
 * - Disabled in production for console.log
 * - Provides structured logging
 */

type LogLevel = "debug" | "info" | "warn" | "error"

interface LogOptions {
  namespace?: string
  sensitive?: boolean
}

class Logger {
  private namespace: string
  private isProduction: boolean

  constructor(namespace: string = "app") {
    this.namespace = namespace
    this.isProduction = process.env.NODE_ENV === "production"
  }

  private formatMessage(level: LogLevel, message: string, data?: any): string {
    const timestamp = new Date().toISOString()
    const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.namespace}]`
    
    if (data !== undefined) {
      try {
        const serialized = typeof data === "object" ? JSON.stringify(data) : String(data)
        return `${prefix} ${message} ${serialized}`
      } catch {
        return `${prefix} ${message} [Object]`
      }
    }
    
    return `${prefix} ${message}`
  }

  private sanitizeData(data: any): any {
    if (data == null) return data
    if (typeof data !== "object") return data

    const sensitiveKeys = ["password", "secret", "token", "key", "auth", "session", "cookie"]

    // Error / AuthApiError: у большинства движков message/status не в enumerable — Object.entries даёт {}
    if (data instanceof Error) {
      const e = data as Error & { status?: number; code?: string }
      const rec: Record<string, unknown> = {
        name: e.name,
        message: e.message,
      }
      if (typeof e.status === "number") rec.status = e.status
      if (e.code != null && String(e.code).length > 0) rec.code = e.code
      return rec
    }

    // Объекты в стиле Supabase AuthError без прототипа Error
    if (typeof data.message === "string" && ("status" in data || "code" in data || data.__isAuthError)) {
      const rec: Record<string, unknown> = { message: data.message }
      if (typeof data.status === "number") rec.status = data.status
      if (typeof data.code === "string") rec.code = data.code
      if (typeof data.name === "string") rec.name = data.name
      return rec
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeData(item))
    }

    const sanitized: any = {}
    for (const [key, value] of Object.entries(data)) {
      const keyLower = key.toLowerCase()
      if (sensitiveKeys.some(sk => keyLower.includes(sk))) {
        sanitized[key] = "[REDACTED]"
      } else if (typeof value === "object") {
        sanitized[key] = this.sanitizeData(value)
      } else {
        sanitized[key] = value
      }
    }
    
    return sanitized
  }

  debug(message: string, data?: any): void {
    if (this.isProduction) return
    console.debug(this.formatMessage("debug", message, data))
  }

  info(message: string, data?: any): void {
    if (this.isProduction) return
    console.info(this.formatMessage("info", message, data))
  }

  warn(message: string, data?: any): void {
    const sanitizedData = data ? this.sanitizeData(data) : undefined
    console.warn(this.formatMessage("warn", message, sanitizedData))
  }

  error(message: string, error?: Error | any): void {
    const sanitizedError = error ? this.sanitizeData(error) : undefined
    console.error(this.formatMessage("error", message, sanitizedError))
  }

  // For critical errors that should always be logged (even in production)
  critical(message: string, error?: Error): void {
    console.error(this.formatMessage("error", message, error?.stack || error))
  }
}

// Create named loggers for different parts of the app
export const loggers = {
  auth: new Logger("auth"),
  api: new Logger("api"),
  db: new Logger("db"),
  proxy: new Logger("proxy"),
  admin: new Logger("admin"),
  search: new Logger("search"),
  player: new Logger("player"),
  bookmarks: new Logger("bookmarks"),
  history: new Logger("history"),
  critical: new Logger("critical"),
}

// Default logger
export const logger = new Logger()

// Helper to create a logger with custom namespace
export function createLogger(namespace: string): Logger {
  return new Logger(namespace)
}
