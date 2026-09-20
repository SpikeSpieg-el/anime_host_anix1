import { describe, expect, it } from "vitest"
import crypto from "crypto"
import {
  analyzeTrajectory,
  generateVerificationToken,
  verifyRegistrationToken,
} from "@/lib/captcha-puzzle"

const SECRET = "test-secret-key-1234567890"

function makeHumanPoints(n: number, baseX: number, durationMs: number): ReturnType<typeof analyzeTrajectory> {
  const points: Array<{ x: number; y: number; t: number }> = []
  for (let i = 0; i < n; i++) {
    // Человек имеет микро-дрожание по Y и неравномерное время.
    const yJitter = Math.sin(i * 1.7) * 2 + (Math.random() - 0.5)
    // Добавляем вариацию во времени для реалистичности (человек движется неравномерно)
    const timeJitter = Math.random() * 20 - 10
    points.push({ x: baseX + i, y: 50 + yJitter, t: i * durationMs + timeJitter })
  }
  return points
}

describe("analyzeTrajectory", () => {
  it("принимает естественную траекторию человека", () => {
    const points = makeHumanPoints(15, 0, 90)
    expect(analyzeTrajectory(points)).toBe(true)
  })

  it("отклоняет слишком короткую траекторию (бот)", () => {
    // Бот шлёт всего 2 точки.
    const points = [{ x: 0, y: 50, t: 100 }, { x: 10, y: 50, t: 300 }]
    expect(analyzeTrajectory(points)).toBe(false)
  })

  it("отклоняет мгновенный телепорт (< 280мс)", () => {
    // Все промежуточные точки сжатые, чтобы общая длительность была < 280мс.
    const points = makeHumanPoints(15, 0, 90).map((p, i) => ({ x: p.x, y: p.y, t: i * 10 }))
    expect(analyzeTrajectory(points)).toBe(false)
  })

  it("отклоняет телепорт с идеальным равномерным шагом (< 280мс)", () => {
    // 15 точек, но общее время < 280мс и абсолютно одинаковый шаг (dx=3, dt=15).
    const points = []
    for (let i = 0; i < 15; i++) points.push({ x: i * 3, y: 50 + Math.sin(i) * 1.2, t: i * 15 })
    expect(analyzeTrajectory(points)).toBe(false)
  })

  it("отклоняет идеальную линейную скорость (скрипт)", () => {
    // 8 точек с абсолютно одинаковым шагом по времени и X — без джиттера.
    const points = []
    for (let i = 0; i < 8; i++) {
      points.push({ x: i * 5, y: 50, t: i * 100 })
    }
    // Скорость на каждом отрезке одинакова (dx=5, dt=100).
    expect(analyzeTrajectory(points)).toBe(false)
  })

  it("отклоняет непереданную траекторию", () => {
    expect(analyzeTrajectory(undefined as never)).toBe(false)
    expect(analyzeTrajectory(null as never)).toBe(false)
    expect(analyzeTrajectory([])).toBe(false)
  })
})

describe("generateVerificationToken / verifyRegistrationToken", () => {
  it("генерирует токен, который проходит верификацию", () => {
    const timestamp = 1700000000000
    const nonce = "abcdef123456"
    const token = generateVerificationToken(timestamp, nonce, SECRET)
    expect(verifyRegistrationToken(token, SECRET)).toBe(true)
  })

  it("отклоняет токен с другим секретом", () => {
    const timestamp = 1700000000000
    const token = generateVerificationToken(timestamp, "nonce-123", SECRET)
    expect(verifyRegistrationToken(token, "wrong-secret")).toBe(false)
  })

  it("отклоняет некорректный формат токена", () => {
    expect(verifyRegistrationToken("", SECRET)).toBe(false)
    expect(verifyRegistrationToken("only-one-part", SECRET)).toBe(false)
    expect(verifyRegistrationToken(`${crypto.randomBytes(8).toString("hex")}.${"x"}${"y"}`, SECRET)).toBe(false)
  })

  it("отклоняет токен с некорректным хэшем", () => {
    const timestamp = 1700000000000
    const token = `not-the-real-hash.${timestamp}.nonce-123`
    expect(verifyRegistrationToken(token, SECRET)).toBe(false)
  })

  it("генерирует детерминированный токен для одних и тех же параметров", () => {
    const a = generateVerificationToken(1700000000000, "nonce-abc", SECRET)
    const b = generateVerificationToken(1700000000000, "nonce-abc", SECRET)
    expect(a).toBe(b)
  })
})
