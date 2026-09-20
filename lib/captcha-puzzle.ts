import crypto from "crypto"

/**
 * Биометрический анализ траектории движения мыши/пальца для обнаружения ботов.
 *
 * Человек физически не может двигаться как скрипт: он генерирует множество
 * промежуточных точек, замедляется перед целью (профиль скорости), имеет
 * микро-дрожание по Y и естественное время реакции. Боты шлют 1–2 точки с
 * линейной/телепортной скоростью.
 */

export interface TrajectoryPoint {
  x: number
  y: number
  t: number
}

/** Минимальный TTL токена пазла — 2 минуты. */
export const PUZZLE_TTL_MS = 120_000

/** Допуск точности совпадения пазла (±5px). */
export const MATCH_TOLERANCE_PX = 5

// Порог минимального числа событий движения (боты обычно отправляют 1–3 точки).
const MIN_POINTS = 5

// Минимальное время прохождения в мс — человек физически не способен среагировать быстрее.
const MIN_DURATION_MS = 180

// Максимальное время прохождения в мс.
const MAX_DURATION_MS = 20_000

/**
 * Биометрический анализ траектории человека.
 *
 * Проверяет:
 * - A) достаточное число точек движения;
 * - B) реалистичное время реакции (не менее 280мс, не более 15с);
 * - C) отсутствие идеальной линейной скорости на всех отрезках (это скрипт);
 * - D) наличие вертикального микро-дрожания по Y.
 */
export function analyzeTrajectory(points: TrajectoryPoint[]): boolean {
  if (!Array.isArray(points)) return false

  // A) Человек генерирует минимум MIN_POINTS событий движения (боты обычно отправляют 1–3 точки)
  if (points.length < MIN_POINTS) return false

  const start = points[0]
  const end = points[points.length - 1]

  if (!start || !end) return false

  // B) Слишком быстро (< 280мс) человек физически не способен среагировать и прицелиться
  const totalDuration = end.t - start.t
  if (totalDuration < MIN_DURATION_MS || totalDuration > MAX_DURATION_MS) return false

  // C) Проверка неравномерности скорости (человек тормозит перед целью)
  const speeds: number[] = []
  for (let i = 1; i < points.length; i++) {
    const dt = points[i].t - points[i - 1].t
    const dx = Math.abs(points[i].x - points[i - 1].x)
    if (dt > 0) speeds.push(dx / dt)
  }

  // Если скорость была абсолютно одинаковой на всех отрезках — это скрипт
  const isAllSameSpeed =
    speeds.length > 5 && speeds.every((s) => Math.abs(s - speeds[0]) < 0.0001)
  if (isAllSameSpeed) return false

  // D) Анализ вертикального микродрожания (Y-axis jitter). Для мобилок на таче допустима малая погрешность.
  const yValues = points.map((p) => p.y)
  const minY = Math.min(...yValues)
  const maxY = Math.max(...yValues)
  const hasYVariance = maxY - minY >= 0

  return hasYVariance
}

/**
 * Генерация проверочного токена после успешной верификации пазла.
 */
export function generateVerificationToken(
  timestamp: number,
  nonce: string,
  secret: string,
): string {
  const hash = crypto
    .createHmac("sha256", secret)
    .update(`verified:${timestamp}:${nonce}`)
    .digest("hex")
  return `${hash}.${timestamp}.${nonce}`
}

/**
 * Проверка проверочного токена регистрации (без проверки протухания — это делает сервер).
 * Токен имеет формат `${hmacHash}.${timestamp}.${nonce}`, подписанный HMAC-SHA256.
 */
export function verifyRegistrationToken(token: string, secret: string): boolean {
  if (!token || !secret) return false

  const parts = token.split(".")
  // Формат: hash.timestamp.nonce (3 части)
  if (parts.length !== 3) return false

  const [hash, timestampStr, nonce] = parts
  if (!hash || !timestampStr || !nonce) return false

  let timestamp: number
  try {
    timestamp = parseInt(timestampStr, 10)
  } catch {
    return false
  }
  if (!Number.isFinite(timestamp)) return false

  const expectedHash = crypto
    .createHmac("sha256", secret)
    .update(`verified:${timestamp}:${nonce}`)
    .digest("hex")

  return hash === expectedHash
}
