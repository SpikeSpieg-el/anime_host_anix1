import { NextResponse } from "next/server"
import crypto from "crypto"
import { loggers } from "@/lib/logger"

// Секретный ключ для подписи капчи.
// Рекомендуется задать в .env (NEXTAUTH_SECRET-подобное значение), здесь fallback.
const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || "anime-gacha-ultra-secret-key-2026"

/**
 * TTL жизни токена капчи — 5 минут.
 */
const MAX_CAPTCHA_TTL_MS = 5 * 60 * 1000

// Символы без неоднозначных (исключены 0, O, I, l, 1)
const CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"

/**
 * Генерация капчи.
 *
 * Ответ подписывается HMAC-SHA256 вместе с временной меткой (TTL 5 минут).
 * Клиенту передаётся только зашифрованный токен и код для отрисовки на Canvas,
 * чтобы боты с простым OCR не могли его спарсить.
 */
export async function GET() {
  let code = ""
  for (let i = 0; i < 5; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length))
  }

  const timestamp = Date.now()
  // Создаем HMAC-подпись ответа вместе с таймстемпом
  const hash = crypto
    .createHmac("sha256", CAPTCHA_SECRET)
    .update(`${code.toUpperCase()}:${timestamp}`)
    .digest("hex")

  const token = `${hash}:${timestamp}`

  loggers.api.debug("captcha generated", { length: code.length, ttlMs: MAX_CAPTCHA_TTL_MS })

  return NextResponse.json({
    token,
    text: code, // Передаем текст для отрисовки холста с эффектами шума
  })
}
