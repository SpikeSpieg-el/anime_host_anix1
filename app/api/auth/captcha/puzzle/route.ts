import { NextResponse } from "next/server"
import crypto from "crypto"
import { loggers } from "@/lib/logger"
import { analyzeTrajectory, generateVerificationToken, PUZZLE_TTL_MS } from "@/lib/captcha-puzzle"

const SECRET = process.env.CAPTCHA_SECRET || "anime-gacha-slider-secret-key-2026"

const BACKGROUNDS = [
  "/captcha/bg (1).webp",
  "/captcha/bg (2).webp",
  "/captcha/bg (3).webp",
  "/captcha/bg (4).webp",
]

interface Point {
  x: number
  y: number
  t: number
}

// 1. GET: Генерация пазла с безопасными границами
export async function GET() {
  const bgUrl = BACKGROUNDS[Math.floor(Math.random() * BACKGROUNDS.length)]

  // Доли контейнера:
  // X от 0.30 до 0.75 (чтобы вырез не был в самом начале и помещался до правого края)
  // Y от 0.15 до 0.60 (чтобы не прилипал к верхней и нижней границе)
  const targetXFrac = Number(((Math.floor(Math.random() * 46) + 30) / 100).toFixed(2))
  const targetYFrac = Number(((Math.floor(Math.random() * 46) + 15) / 100).toFixed(2))

  const timestamp = Date.now()
  const nonce = crypto.randomBytes(8).toString("hex")

  // Храним в токене в промилле (целые числа от 0 до 1000)
  const tX = Math.round(targetXFrac * 1000)
  const tY = Math.round(targetYFrac * 1000)

  const signature = crypto
    .createHmac("sha256", SECRET)
    .update(`${tX}:${tY}:${timestamp}:${nonce}`)
    .digest("hex")

  const token = `${tX}.${tY}.${timestamp}.${nonce}.${signature}`

  loggers?.api?.debug?.("captcha puzzle generated", { targetXFrac, targetYFrac })

  return NextResponse.json({
    bgUrl,
    targetX: targetXFrac,
    targetY: targetYFrac,
    token,
  })
}

// 2. POST: Проверка решения
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string
      userFraction?: number
      trajectory?: Point[]
    }

    if (!body.token || typeof body.userFraction !== "number" || !Array.isArray(body.trajectory)) {
      return NextResponse.json({ success: false, error: "Неверные данные" }, { status: 400 })
    }

    const parts = body.token.split(".")
    if (parts.length !== 5) {
      return NextResponse.json({ success: false, error: "Неверный формат токена" }, { status: 400 })
    }

    const [tXStr, tYStr, timestampStr, nonce, signature] = parts
    const tX = parseInt(tXStr, 10)
    const tY = parseInt(tYStr, 10)
    const timestamp = parseInt(timestampStr, 10)

    if (
      Number.isNaN(tX) ||
      Number.isNaN(tY) ||
      Number.isNaN(timestamp) ||
      tX < 0 ||
      tX > 1000 ||
      tY < 0 ||
      tY > 1000
    ) {
      return NextResponse.json({ success: false, error: "Поврежденный токен" }, { status: 400 })
    }

    // 1. Проверка срока жизни
    if (Date.now() - timestamp > PUZZLE_TTL_MS) {
      return NextResponse.json({ success: false, error: "Время истекло, обновите пазл" })
    }

    // 2. Проверка HMAC подписи (исправлено обращение к переменным)
    const expectedSig = crypto
      .createHmac("sha256", SECRET)
      .update(`${tX}:${tY}:${timestamp}:${nonce}`)
      .digest("hex")

    if (signature !== expectedSig) {
      return NextResponse.json({ success: false, error: "Поддельный токен" }, { status: 403 })
    }

    // 3. Проверка точности попадания (допуск ±5% ширины контейнера)
    const targetXFrac = tX / 1000
    if (Math.abs(body.userFraction - targetXFrac) > 0.05) {
      return NextResponse.json({ success: false, error: "Пазл не встал на место" })
    }

    // 4. Проверка биометрии движения
    if (typeof analyzeTrajectory === "function") {
      const isValidHuman = analyzeTrajectory(body.trajectory)
      if (!isValidHuman) {
        return NextResponse.json({ success: false, error: "Обнаружено неестественное движение" })
      }
    }

    const verificationToken = generateVerificationToken(timestamp, nonce, SECRET)

    return NextResponse.json({ success: true, verificationToken })
  } catch (err) {
    loggers?.api?.error?.("captcha puzzle verify error", err)
    console.error("Captcha error:", err)
    return NextResponse.json({ success: false, error: "Внутренняя ошибка сервера" }, { status: 500 })
  }
}