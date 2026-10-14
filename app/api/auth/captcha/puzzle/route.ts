import { NextRequest, NextResponse } from "next/server"
import crypto from "crypto"

import {
  BACKGROUNDS,
  MATCH_TOLERANCE_FRAC,
  PUZZLE_TTL_MS,
  analyzeTrajectory,
  generateVerificationToken,
  sanitizeContainerSize,
  sealPuzzle,
  unsealPuzzle,
} from "@/lib/captcha-puzzle"
import type { TrajectoryPoint } from "@/lib/captcha-puzzle"
import {
  TARGET_X_MAX,
  TARGET_X_MIN,
  TARGET_Y_MAX,
  TARGET_Y_MIN,
} from "@/lib/captcha-geometry"
import { loggers } from "@/lib/logger"
import {
  createRateLimiter,
  createRateLimitResponse,
  getRateLimitKey,
} from "@/lib/rate-limit"

const SECRET = process.env.CAPTCHA_SECRET || "anime-gacha-slider-secret-key-2026"

/** Отдельный лимит на выдачу пазла: его можно крутить, пока не найдёшь дырку. */
const puzzleGetLimiter = createRateLimiter({ interval: 60_000, maxRequests: 20 })

/** И на попытки решения — тут важнее частота, чем абсолютное число. */
const puzzlePostLimiter = createRateLimiter({ interval: 60_000, maxRequests: 15 })

/** Случайное целое в диапазоне [min, max] через CSPRNG, а не `Math.random()`. */
function randomIntInclusive(min: number, max: number): number {
  return crypto.randomInt(min, max + 1)
}

/**
 * Случайная доля с шагом 0.01.
 *
 * Раньше позиция бралась из `Math.random()` — это не криптостойкий ГПСЧ, и по
 * нескольким пазлам подряд восстанавливалось состояние генератора.
 */
function randomFraction(min: number, max: number): number {
  const steps = Math.round((max - min) * 100)
  const step = randomIntInclusive(0, steps)
  return Number((min + step / 100).toFixed(2))
}

/** 1. GET: пазл с дыркой, уже выжженной в картинку. */
export async function GET(request: NextRequest) {
  const rateKey = getRateLimitKey(request)
  if (rateKey) {
    const limit = puzzleGetLimiter.checkLimit(rateKey)
    if (!limit.success) return createRateLimitResponse(limit.reset)
  }

  try {
    const backgroundIndex = randomIntInclusive(0, BACKGROUNDS.length - 1)

    // Доли контейнера. Границы берутся из captcha-geometry и завязаны на то,
    // чтобы кусочек целиком помещался в окно.
    const targetXFrac = randomFraction(TARGET_X_MIN, TARGET_X_MAX)
    const targetYFrac = randomFraction(TARGET_Y_MIN, TARGET_Y_MAX)

    const size = sanitizeContainerSize(
      request.nextUrl.searchParams.get("w"),
      request.nextUrl.searchParams.get("h")
    )

    const token = sealPuzzle(
      {
        tX: Math.round(targetXFrac * 1000),
        tY: Math.round(targetYFrac * 1000),
        ts: Date.now(),
        nonce: crypto.randomBytes(12).toString("hex"),
        bg: backgroundIndex,
        w: size.width,
        h: size.height,
      },
      SECRET
    )

    loggers?.api?.debug?.("captcha puzzle generated", {
      targetXFrac,
      targetYFrac,
      backgroundIndex,
      container: size,
    })

    // В ответе нет ни targetX, ни ссылки на чистую картинку: только адреса двух
    // готовых картинок (фон с дыркой и сам кусочек), вертикальная координата
    // (по ней клиент ведёт кусочек) и запечатанный токен.
    //
    // Адреса относительные, чтобы всегда совпадать с origin страницы: origin,
    // собранный из request.url, за прокси и при обращении через 127.0.0.1
    // расходился с тем, откуда реально открыта страница.
    const imageUrl = `/api/auth/captcha/puzzle/image?token=${encodeURIComponent(token)}`

    return NextResponse.json(
      {
        puzzle: imageUrl,
        piece: `${imageUrl}&part=piece`,
        targetY: targetYFrac,
        token,
      },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    loggers?.api?.error?.("captcha puzzle GET error", err)
    return NextResponse.json(
      { error: "Не удалось загрузить пазл. Обновите страницу и попробуйте снова." },
      { status: 500 }
    )
  }
}

/**
 * Ответ с ошибкой.
 *
 * `reason` нужен клиенту, чтобы решить, подменять ли пазл. Раньше любой отказ
 * приводил к новому пазлу через 1.2 секунды, и промах стоил пользователю всей
 * работы: он видел «не совпало» и через мгновение получал другую картинку и
 * другую дырку. Теперь `reason: 'position'` и `'trajectory'` оставляют пазл на
 * месте — человек просто чуть сдвигает кусочек и пробует снова.
 */
function fail(
  error: string,
  reason: "position" | "trajectory" | "token" | "expired" | "invalid",
  status = 200
) {
  return NextResponse.json({ success: false, error, reason }, { status })
}

/** 2. POST: проверка решения. */
export async function POST(request: NextRequest) {
  const rateKey = getRateLimitKey(request)
  if (rateKey) {
    const limit = puzzlePostLimiter.checkLimit(rateKey)
    if (!limit.success) return createRateLimitResponse(limit.reset)
  }

  try {
    const body = (await request.json()) as {
      token?: string
      userFraction?: number
      trajectory?: TrajectoryPoint[]
    }

    if (
      !body.token ||
      typeof body.userFraction !== "number" ||
      !Array.isArray(body.trajectory)
    ) {
      return fail("Проверка не пройдена. Попробуйте ещё раз.", "invalid", 400)
    }

    const payload = unsealPuzzle(body.token, SECRET)
    if (!payload) {
      return fail(
        "Проверка не пройдена. Обновите пазл и попробуйте снова.",
        "token",
        403
      )
    }

    if (payload.tX < 0 || payload.tX > 1000 || payload.tY < 0 || payload.tY > 1000) {
      return fail(
        "Проверка не пройдена. Обновите пазл и попробуйте снова.",
        "token",
        400
      )
    }

    // 1. Срок жизни пазла.
    if (Date.now() - payload.ts > PUZZLE_TTL_MS) {
      return fail("Пазл устарел. Обновите его и попробуйте ещё раз.", "expired")
    }

    // 2. Точность попадания.
    const targetXFrac = payload.tX / 1000
    if (Math.abs(body.userFraction - targetXFrac) > MATCH_TOLERANCE_FRAC) {
      return fail("Кусочек не совпал с дыркой. Попробуйте ещё раз.", "position")
    }

    // 3. Биометрия движения.
    //
    // Про «неестественное движение» пользователю говорить незачем: он не
    // обвиняется, он просто не смог перетащить кусочек так, как это сделала бы
    // рука. Формулировка намеренно нейтральная.
    if (!analyzeTrajectory(body.trajectory)) {
      return fail(
        "Проверка не пройдена. Попробуйте перетащить кусочек ещё раз.",
        "trajectory"
      )
    }

    const verificationToken = generateVerificationToken(
      Date.now(),
      payload.nonce,
      SECRET
    )

    return NextResponse.json(
      { success: true, verificationToken },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    loggers?.api?.error?.("captcha puzzle verify error", err)
    console.error("Captcha error:", err)
    return fail("Что-то пошло не так. Попробуйте ещё раз.", "invalid", 500)
  }
}
