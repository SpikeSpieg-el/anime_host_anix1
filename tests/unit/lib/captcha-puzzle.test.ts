import { describe, expect, it } from "vitest"
import crypto from "crypto"

import {
  MATCH_TOLERANCE_FRAC,
  VERIFICATION_TTL_MS,
  analyzeTrajectory,
  buildPuzzleSvg,
  generateVerificationToken,
  readVerificationToken,
  sanitizeContainerSize,
  sealPuzzle,
  unsealPuzzle,
  verifyRegistrationToken,
} from "@/lib/captcha-puzzle"
import type { TrajectoryPoint } from "@/lib/captcha-puzzle"
import {
  PUZZLE_EXTENT,
  TARGET_X_MAX,
  TARGET_X_MIN,
  TARGET_Y_MAX,
  TARGET_Y_MIN,
  containerToImage,
  coverMapping,
} from "@/lib/captcha-geometry"

const SECRET = "test-secret-key-1234567890"

/**
 * Траектория живого человека: много точек, разброс по времени, микро-дрожание
 * по Y, скорость гуляет (человек разгоняется и тормозит).
 */
function makeHumanPoints(n: number, baseX: number, durationMs: number): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = []
  for (let i = 0; i < n; i++) {
    const yJitter = Math.sin(i * 1.7) * 2 + (Math.random() - 0.5)
    const timeJitter = Math.random() * 20 - 10
    points.push({ x: baseX + i, y: 50 + yJitter, t: i * durationMs + timeJitter })
  }
  return points
}

describe("analyzeTrajectory", () => {
  it("принимает естественную траекторию человека", () => {
    expect(analyzeTrajectory(makeHumanPoints(15, 0, 90))).toBe(true)
  })

  it("принимает длинный по времени, но живой по скорости drag", () => {
    const points: TrajectoryPoint[] = []
    let x = 0
    for (let i = 0; i < 40; i++) {
      // Человек разгоняется, к цели притормаживает; точки строго по времени.
      const speed = i < 25 ? 9 : 3
      x += speed
      points.push({ x, y: 50 + Math.sin(i * 0.9) * 1.6, t: i * 40 })
    }
    expect(analyzeTrajectory(points)).toBe(true)
  })

  it("отклоняет слишком короткую траекторию (бот)", () => {
    const points = [
      { x: 0, y: 50, t: 100 },
      { x: 10, y: 51, t: 300 },
    ]
    expect(analyzeTrajectory(points)).toBe(false)
  })

  it("отклоняет слишком мало точек", () => {
    // 8 богато расставленных точек — прошла бы старый порог в 5.
    const points: TrajectoryPoint[] = []
    for (let i = 0; i < 8; i++) {
      points.push({ x: i * 20, y: 50 + Math.sin(i) * 2, t: i * 150 })
    }
    expect(analyzeTrajectory(points)).toBe(false)
  })

  it("отклоняет мгновенный телепорт (< 320мс)", () => {
    const points = makeHumanPoints(15, 0, 90).map((p, i) => ({ x: p.x, y: p.y, t: i * 10 }))
    expect(analyzeTrajectory(points)).toBe(false)
  })

  it("отклоняет прыжок между соседними точками", () => {
    const points: TrajectoryPoint[] = []
    for (let i = 0; i < 15; i++) {
      // На третьей точке курсор телепортируется на 400px — так не двигается мышь.
      points.push({
        x: i === 3 ? 400 : i * 4,
        y: 50 + Math.sin(i * 1.3) * 2,
        t: i * 90,
      })
    }
    expect(analyzeTrajectory(points)).toBe(false)
  })

  it("отклоняет идеально ровную скорость (скрипт)", () => {
    const points: TrajectoryPoint[] = []
    for (let i = 0; i < 15; i++) {
      points.push({ x: i * 5, y: 50 + Math.sin(i) * 1.4, t: i * 100 })
    }
    expect(analyzeTrajectory(points)).toBe(false)
  })

  it("принимает drag строго по горизонтали, без единого пикселя по Y", () => {
    // Мышь, которую ведут ровно по горизонтали, даёт нулевой разброс по Y.
    // Требование к нему заблокировало бы живого пользователя.
    const points: TrajectoryPoint[] = []
    let x = 0
    for (let i = 0; i < 20; i++) {
      x += i < 14 ? 9 : 4
      points.push({ x, y: 500, t: 1_700_000_000_000 + i * 55 })
    }
    expect(analyzeTrajectory(points)).toBe(true)
  })

  it("принимает короткий уверенный рывок мышью", () => {
    // Регресс: пороги 320мс/12 точек отсекали нормального человека, который
    // не стал тянуть медленно, а просто быстро ткнул. Трекпад на 60 Гц или
    // резкое движение даёт ровно такой профиль.
    const points: TrajectoryPoint[] = []
    for (let i = 0; i < 8; i++) {
      points.push({
        x: i * 26 + (i % 2),
        y: 500,
        t: 1_700_000_000_000 + i * 28,
      })
    }
    expect(analyzeTrajectory(points)).toBe(true)
  })

  it("принимает флик длиной около 150мс", () => {
    // Реальная жалоба: траектория в 178мс отбивалась порогом в 180мс.
    // Флик на 250px — это обычное человеческое движение.
    const T0 = 1_700_000_000_000
    const steps = [
      [40, 22],
      [36, 24],
      [42, 26],
      [38, 23],
      [44, 27],
      [40, 25],
      [36, 24],
    ]
    const points: TrajectoryPoint[] = []
    let x = 0
    let t = T0
    for (const [dx, dt] of steps) {
      x += dx
      t += dt
      points.push({ x, y: 500, t })
    }

    expect(t - T0).toBeLessThan(200)
    expect(analyzeTrajectory(points)).toBe(true)
  })

  it("отклоняет мгновенную подстановку (нулевая длительность)", () => {
    // Единственное, ради чего порог длительности вообще существует.
    const points: TrajectoryPoint[] = []
    for (let i = 0; i < 12; i++) {
      points.push({ x: i * 25, y: 500, t: 1_700_000_000_000 })
    }
    expect(analyzeTrajectory(points)).toBe(false)
  })

  it("принимает пакет событий с одинаковыми отметками времени", () => {
    // Регресс: браузер отдаёт склеенные события пачкой, и если всем точкам
    // пакета проставить одну метку времени (так было сделано с Date.now()),
    // то проверка «строгий рост времени» отбивала нормального человека.
    // Чем быстрее шёл drag — тем длиннее пакет и тем вернее отказ.
    const T0 = 1_700_000_000_000
    const points: TrajectoryPoint[] = [
      { x: 30, y: 500, t: T0 },
      { x: 32, y: 500, t: T0 },
      { x: 34, y: 500, t: T0 },
      { x: 36, y: 500, t: T0 },
    ]

    // Дальше — живая раскладка шагов: человек не идёт равномерно.
    const steps = [
      [8, 21],
      [11, 24],
      [9, 20],
      [12, 26],
      [8, 22],
      [10, 19],
      [9, 25],
      [11, 21],
    ]
    let x = 36
    let t = T0
    for (const [dx, dt] of steps) {
      x += dx
      t += dt
      points.push({ x, y: 500, t })
    }

    // Без защиты от dt === 0 среднее скоростей уходило в Infinity/NaN.
    expect(analyzeTrajectory(points)).toBe(true)
  })

  it("отклоняет траекторию, собранную из непрямых отрезков", () => {
    const points = makeHumanPoints(15, 0, 90).map((p, i) => ({ ...p, t: 15 - i }))
    expect(analyzeTrajectory(points)).toBe(false)
  })
  it("отклоняет траекторию без фактического движения", () => {
    // 15 точек, всё время растёт, но X на месте — кусочек не двигали.
    const points: TrajectoryPoint[] = []
    for (let i = 0; i < 15; i++) {
      points.push({ x: 100, y: 50 + Math.sin(i) * 2, t: i * 100 })
    }
    expect(analyzeTrajectory(points)).toBe(false)
  })

  it("отклоняет непереданную и испорченную траекторию", () => {
    expect(analyzeTrajectory(undefined as never)).toBe(false)
    expect(analyzeTrajectory(null as never)).toBe(false)
    expect(analyzeTrajectory([])).toBe(false)
    expect(
      analyzeTrajectory(makeHumanPoints(15, 0, 90).map((p) => ({ ...p, x: NaN })))
    ).toBe(false)
  })
})

describe("sealPuzzle / unsealPuzzle", () => {
  const payload = {
    tX: 640,
    tY: 380,
    ts: 1700000000000,
    nonce: "abcdef0123456789",
    bg: 2,
    w: 360,
    h: 160,
  }

  it("запечатывает и распечатывает payload", () => {
    const token = sealPuzzle(payload, SECRET)
    expect(unsealPuzzle(token, SECRET)).toEqual(payload)
  })

  it("не кладёт координату в открытом виде", () => {
    const token = sealPuzzle(payload, SECRET)

    // Прежний формат начинался с `640.380.<ts>` — targetX читался из ответа
    // без единой строки кода про картинку.
    expect(token).not.toMatch(/^\d+\.\d+\./)
    expect(token.split(".")).toHaveLength(3)

    const [iv, data, tag] = token.split(".")
    const payloadUtf8 = Buffer.from(data, "base64url").toString("utf8")
    expect(payloadUtf8).not.toContain("640")
    expect(Buffer.from(iv, "base64url")).toHaveLength(12)
    expect(Buffer.from(tag, "base64url")).toHaveLength(16)
  })

  it("каждый вызов даёт другой шифротекст", () => {
    expect(sealPuzzle(payload, SECRET)).not.toBe(sealPuzzle(payload, SECRET))
  })

  it("отклоняет токен, запечатанный другим секретом", () => {
    const token = sealPuzzle(payload, "another-secret")
    expect(unsealPuzzle(token, SECRET)).toBeNull()
  })

  it("отклоняет подделанный токен", () => {
    const token = sealPuzzle(payload, SECRET)
    const [iv, data, tag] = token.split(".")

    // Ломаем тег GCM — расшифровка обязана провалиться целиком.
    const brokenTag = Buffer.from(tag, "base64url")
    brokenTag[0] ^= 0xff

    const tampered = [
      iv,
      Buffer.from(
        JSON.stringify({ ...payload, tX: 300 }),
        "utf8"
      ).toString("base64url"),
      brokenTag.toString("base64url"),
    ].join(".")

    expect(unsealPuzzle(tampered, SECRET)).toBeNull()
  })

  it("отклоняет мусор вместо токена", () => {
    expect(unsealPuzzle("", SECRET)).toBeNull()
    expect(unsealPuzzle("one-part", SECRET)).toBeNull()
    expect(unsealPuzzle("a.b.c.d", SECRET)).toBeNull()
    expect(unsealPuzzle("640.380.1700000000000.nonce.sig", SECRET)).toBeNull()
    expect(unsealPuzzle(crypto.randomBytes(32).toString("hex"), SECRET)).toBeNull()
  })
})

describe("generateVerificationToken / readVerificationToken", () => {
  it("принимает свежий токен", () => {
    const now = 1_700_000_000_000
    const token = generateVerificationToken(now, "nonce-abc", SECRET)
    expect(readVerificationToken(token, SECRET, { now })).not.toBeNull()
    expect(verifyRegistrationToken(token, SECRET, { now })).toBe(true)
  })

  it("отклоняет токен с другим секретом", () => {
    const now = 1_700_000_000_000
    const token = generateVerificationToken(now, "nonce-abc", SECRET)
    expect(verifyRegistrationToken(token, "wrong-secret", { now })).toBe(false)
  })

  it("отклоняет протухший токен", () => {
    // Раньше токен был вечным: собранный один раз пазл кормил регистрации годами.
    const issuedAt = 1_700_000_000_000
    const token = generateVerificationToken(issuedAt, "nonce-abc", SECRET)
    expect(verifyRegistrationToken(token, SECRET, { now: issuedAt })).toBe(true)
    expect(
      verifyRegistrationToken(token, SECRET, { now: issuedAt + VERIFICATION_TTL_MS + 1 })
    ).toBe(false)
  })

  it("отклоняет токен из будущего", () => {
    const issuedAt = 1_700_000_000_000
    const token = generateVerificationToken(issuedAt, "nonce-abc", SECRET)
    expect(verifyRegistrationToken(token, SECRET, { now: issuedAt - 1000 })).toBe(false)
  })

  it("отдаёт nonce пазла для счётчика одноразовости", () => {
    const now = 1_700_000_000_000
    const token = generateVerificationToken(now, "puzzle-nonce-42", SECRET)
    expect(readVerificationToken(token, SECRET, { now })?.nonce).toBe("puzzle-nonce-42")
  })

  it("отклоняет некорректный формат токена", () => {
    expect(verifyRegistrationToken("", SECRET)).toBe(false)
    expect(verifyRegistrationToken("only-one-part", SECRET)).toBe(false)
    expect(
      verifyRegistrationToken(`${crypto.randomBytes(8).toString("hex")}.xy`, SECRET)
    ).toBe(false)
  })

  it("отклоняет токен с некорректным хэшем", () => {
    const timestamp = 1_700_000_000_000
    const token = `not-the-real-hash.${timestamp}.nonce-123`
    expect(verifyRegistrationToken(token, SECRET, { now: timestamp })).toBe(false)
  })

  it("генерирует детерминированный токен для одних и тех же параметров", () => {
    expect(generateVerificationToken(1_700_000_000_000, "nonce-abc", SECRET)).toBe(
      generateVerificationToken(1_700_000_000_000, "nonce-abc", SECRET)
    )
  })
})

describe("coverMapping / containerToImage", () => {
  it("повторяет object-cover для квадратной картинки в широком контейнере", () => {
    const mapping = coverMapping(360, 160, 480, 480)

    // Масштабируем по ширине, по высоте уходим в обрезку: 480*0.75 = 360,
    // значит сверху и снизу срезано по 100px.
    expect(mapping.scale).toBeCloseTo(360 / 480, 6)
    expect(mapping.offsetX).toBeCloseTo(0, 6)
    expect(mapping.offsetY).toBeCloseTo(-100, 6)

    // Левый верхний угол контейнера попадает в середину картинки по Y.
    const topLeft = containerToImage(0, 0, mapping)
    expect(topLeft.x).toBeCloseTo(0, 6)
    expect(topLeft.y).toBeCloseTo(100 / 0.75, 6)
  })

  it("переводит координаты контейнера в пиксели картинки", () => {
    const mapping = coverMapping(360, 160, 480, 480)
    const point = containerToImage(180, 80, mapping)
    expect(point.x).toBeCloseTo(240, 6)
    expect(point.y).toBeCloseTo(240, 6)
  })

  it("держит дырку внутри картинки для всех фонов и размеров контейнера", () => {
    // Регресс против «дырка уехала за кадр»: если кусочек нельзя увидеть,
    // капча нерешаема руками. Проверяем весь допустимый диапазон.
    const backgrounds = [
      { width: 480, height: 480 },
      { width: 1024, height: 651 },
    ]
    const containers = [
      { width: 260, height: 160 },
      { width: 360, height: 160 },
      { width: 600, height: 220 },
    ]

    for (const image of backgrounds) {
      for (const container of containers) {
        const mapping = coverMapping(container.width, container.height, image.width, image.height)

        for (const xFrac of [TARGET_X_MIN, TARGET_X_MAX]) {
          for (const yFrac of [TARGET_Y_MIN, TARGET_Y_MAX]) {
            const hole = containerToImage(
              xFrac * container.width,
              yFrac * container.height,
              mapping
            )
            // Плюс габарит кусочка — вырез целиком должен помещаться.
            const extent = PUZZLE_EXTENT * mapping.scale

            expect(hole.x).toBeGreaterThanOrEqual(-0.001)
            expect(hole.y).toBeGreaterThanOrEqual(-0.001)
            expect(hole.x + extent).toBeLessThanOrEqual(image.width + 0.001)
            expect(hole.y + extent).toBeLessThanOrEqual(image.height + 0.001)
          }
        }
      }
    }
  })
})

describe("sanitizeContainerSize", () => {
  it("принимает размеры в допустимых границах", () => {
    expect(sanitizeContainerSize("362", "160")).toEqual({ width: 362, height: 160 })
  })

  it("подставляет дефолт для мусора и вылетающих значений", () => {
    expect(sanitizeContainerSize(null, null)).toEqual({ width: 360, height: 160 })
    expect(sanitizeContainerSize("abc", "-10")).toEqual({ width: 360, height: 160 })
    expect(sanitizeContainerSize("10", "100000")).toEqual({ width: 360, height: 160 })
  })
})

describe("buildPuzzleSvg", () => {
  const background = { url: "/captcha/bg (1).webp", width: 480, height: 480 }

  it("рисует дырку поверх фото, а не отдаёт чистую картинку", () => {
    const svg = buildPuzzleSvg({
      background,
      containerWidth: 360,
      containerHeight: 160,
      targetXFrac: 0.64,
      targetYFrac: 0.38,
    })

    // Фон встраивается как data-URI: Chrome не рисует внешние растры внутри
    // SVG, подставленного в <img>, и картинка приходила чёрной.
    expect(svg).toContain('<image href="data:image/webp;base64,')
    expect(svg).toContain("<path")
    expect(svg).toContain('width="480"')
    expect(svg.startsWith("<svg")).toBe(true)
  })

  it("переводит долю контейнера в пиксели исходника через object-cover", () => {
    const svg = buildPuzzleSvg({
      background,
      containerWidth: 360,
      containerHeight: 160,
      targetXFrac: 0.64,
      targetYFrac: 0.38,
    })

    const mapping = coverMapping(360, 160, 480, 480)
    const hole = containerToImage(0.64 * 360, 0.38 * 160, mapping)

    expect(svg).toContain(`translate(${hole.x.toFixed(2)}, ${hole.y.toFixed(2)})`)
  })
})

describe("MATCH_TOLERANCE_FRAC", () => {
  it("оставлен на уровне, посильном живому человеку", () => {
    // Допуск — не антибот: координата клиенту неизвестна, и узкое окно
    // покупалось ценой ложных отказов. При 5% кусочек перекрывает дырку
    // больше чем наполовину — это однозначно «поставлен», а не «угадал».
    expect(MATCH_TOLERANCE_FRAC).toBe(0.05)
  })
})
