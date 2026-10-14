import { NextRequest, NextResponse } from "next/server"

import { friendlyAuthError } from "@/lib/auth-errors"
import { VERIFICATION_TTL_MS, readVerificationToken } from "@/lib/captcha-puzzle"
import { loggers } from "@/lib/logger"
import {
  createRateLimiter,
  createRateLimitResponse,
  getRateLimitKey,
} from "@/lib/rate-limit"

const CAPTCHA_SECRET = process.env.CAPTCHA_SECRET || "anime-gacha-slider-secret-key-2026"

/**
 * Регистраций с одного адреса в час.
 *
 * Это тот барьер, который работает даже если captcha обойдена идеально.
 * Лимит процессный: для нескольких реплик нужен общий стор (Redis/Supabase) —
 * ровно та же оговорка, что и у `adminLogin` в `lib/rate-limit.ts`.
 */
const registerLimiter = createRateLimiter({ interval: 60 * 60_000, maxRequests: 8 })

/**
 * Одноразовость токена проверки.
 *
 * Пазл можно было бы решить один раз и использовать токен много раз, поэтому
 * токен не просто подписан, а ещё и «списывается» здесь: nonce живёт в памяти
 * процесса до истечения собственного TTL.
 */
const usedNonces = new Map<string, number>()

function consumeNonce(nonce: string): boolean {
  const now = Date.now()

  // Подчистка протухших, чтобы карта не росла бесконечно.
  for (const [key, expiresAt] of usedNonces) {
    if (expiresAt <= now) usedNonces.delete(key)
  }

  // Аварийный сброс, если что-то пошло не так с размерами.
  if (usedNonces.size > 5000) usedNonces.clear()

  if (usedNonces.has(nonce)) return false
  usedNonces.set(nonce, now + VERIFICATION_TTL_MS)

  return true
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface RegisterBody {
  email?: string
  password?: string
  captchaToken?: string
  nickname?: string
  referralCode?: string | null
  giftCard?: string | null
  attribution?: Record<string, unknown> | null
}

/**
 * Регистрация через сервер вместо прямого вызова Supabase из браузера.
 *
 * Раньше `auth-modal.tsx` дёргал `supabase.auth.signUp()` сам, а токен captcha
 * оставался в состоянии компонента: сервер его нигде не проверял, а anon-ключ
 * лежит в бандле. То есть «сдать капчу» было необязательным — достаточно было
 * сделать POST на `https://<project>.supabase.co/auth/v1/signup` из скрипта.
 *
 * Теперь путь один: капча → токен → эта ручка → Supabase.
 */
export async function POST(request: NextRequest) {
  const rateKey = getRateLimitKey(request)
  if (rateKey) {
    const limit = registerLimiter.checkLimit(rateKey)
    if (!limit.success) return createRateLimitResponse(limit.reset)
  }

  let body: RegisterBody
  try {
    body = (await request.json()) as RegisterBody
  } catch {
    return NextResponse.json({ error: "Неверные данные" }, { status: 400 })
  }

  const email = (body.email ?? "").trim().toLowerCase()
  const password = body.password ?? ""
  const captchaToken = body.captchaToken ?? ""

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "Введите корректный email адрес" }, { status: 400 })
  }

  if (typeof password !== "string" || password.length < 6) {
    return NextResponse.json(
      { error: "Пароль должен содержать минимум 6 символов" },
      { status: 400 }
    )
  }

  // 1. Токен captcha: подпись, протухание, одноразовость.
  const parsedToken = readVerificationToken(captchaToken, CAPTCHA_SECRET)
  if (!parsedToken) {
    loggers?.auth?.warn?.("register: captcha token rejected")
    return NextResponse.json(
      { error: "Капча не пройдена или устарела. Пройдите проверку заново." },
      { status: 403 }
    )
  }

  if (!consumeNonce(parsedToken.nonce)) {
    loggers?.auth?.warn?.("register: captcha token replay")
    return NextResponse.json(
      { error: "Капча уже использована. Пройдите проверку заново." },
      { status: 403 }
    )
  }

  // 2. Окружение Supabase.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    loggers?.auth?.error?.("register: Supabase env is not configured")
    // Наружу не выдаём, какая именно переменная отсутствует: пользователю
    // достаточно знать, что попробовать стоит позже.
    return NextResponse.json(
      { error: "Регистрация сейчас недоступна. Попробуйте позже." },
      { status: 500 }
    )
  }

  // 3. Регистрация. Используем anon-ключ, а не service role: так сохраняются
  //    настройки проекта (подтверждение email, лимиты пароля), и мы не обходим
  //    их собственным `email_confirm`.
  const userMetadata: Record<string, unknown> = {}
  if (body.referralCode) userMetadata.referral_code = body.referralCode
  if (body.giftCard) userMetadata.gift_card = body.giftCard
  if (body.nickname) userMetadata.nickname = body.nickname
  if (body.attribution && typeof body.attribution === "object") {
    Object.assign(userMetadata, body.attribution)
  }

  try {
    const supabaseResponse = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
      body: JSON.stringify({ email, password, data: userMetadata }),
    })

    const payload = await supabaseResponse.json().catch(() => null)

    if (!supabaseResponse.ok || !payload) {
      // Наружу отдаём только русский текст из lib/auth-errors. Исходное
      // сообщение Supabase («User already registered», «Database error saving
      // new user») пользователю показывать нечего: это детали бэкенда.
      const rawMessage =
        (payload &&
          (payload.msg || payload.message || payload.error_description ||
            payload.error)) ||
        ""
      const code = payload?.error_code as string | undefined

      loggers?.auth?.warn?.("register: supabase rejected", {
        status: supabaseResponse.status,
        code,
        rawMessage,
      })

      return NextResponse.json(
        {
          error: friendlyAuthError(
            { message: rawMessage, status: supabaseResponse.status, code },
            "register"
          ),
          code,
        },
        { status: supabaseResponse.status }
      )
    }

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    loggers?.auth?.error?.("register: supabase request failed", err)
    return NextResponse.json(
      { error: friendlyAuthError({ status: 502 }, "register") },
      { status: 502 }
    )
  }
}
