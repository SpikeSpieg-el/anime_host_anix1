import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

import {
  analyzeTrajectory,
  generateVerificationToken,
  sealPuzzle,
  unsealPuzzle,
} from "@/lib/captcha-puzzle"
import type { TrajectoryPoint } from "@/lib/captcha-puzzle"

/**
 * Сквозной тест связки «пазл → токен → регистрация».
 *
 * Проверяет ровно то, что раньше не проверялось вообще: что регистрация
 * отказывает без пройденной капчи, принимает токен один раз и не больше.
 * Supabase здесь не вызывается — `fetch` подменён, поэтому тест не создаёт
 * реальных аккаунтов.
 */

const TEST_SECRET = "unit-test-captcha-secret-abcdef0123456789"

const ENV_KEYS = [
  "CAPTCHA_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const

const ORIGINAL_ENV: Record<string, string | undefined> = {}

type PuzzleModule = typeof import("@/app/api/auth/captcha/puzzle/route")
type ImageModule = typeof import("@/app/api/auth/captcha/puzzle/image/route")
type RegisterModule = typeof import("@/app/api/auth/register/route")

let puzzleRoute: PuzzleModule
let imageRoute: ImageModule
let registerRoute: RegisterModule

beforeAll(async () => {
  // Именно присваивание, а не vi.stubEnv: в vitest.config включён
  // restoreMocks, а он восстанавливает шпион process.env перед каждым
  // тестом — и после первого теста подменённое значение исчезало бы.
  for (const key of ENV_KEYS) {
    ORIGINAL_ENV[key] = process.env[key]
    process.env[key] = ""
  }

  process.env.CAPTCHA_SECRET = TEST_SECRET
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co"
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-for-tests"

  puzzleRoute = await import("@/app/api/auth/captcha/puzzle/route")
  imageRoute = await import("@/app/api/auth/captcha/puzzle/image/route")
  registerRoute = await import("@/app/api/auth/register/route")
})

afterAll(() => {
  for (const key of ENV_KEYS) {
    const original = ORIGINAL_ENV[key]
    if (original === undefined) delete process.env[key]
    else process.env[key] = original
  }
})

function request(path: string, body?: unknown): NextRequest {
  return new NextRequest(`https://weeb-x.test${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  })
}

/** Траектория, которую пропустит analyzeTrajectory. */
function humanTrajectory(): TrajectoryPoint[] {
  const points: TrajectoryPoint[] = []
  let x = 0
  for (let i = 0; i < 30; i++) {
    x += i < 20 ? 9 : 4
    points.push({ x, y: 500 + Math.sin(i * 0.8) * 2, t: 1_700_000_000_000 + i * 45 })
  }
  return points
}

async function getPuzzle(): Promise<{ puzzle: string; targetY: number; token: string }> {
  const res = await puzzleRoute.GET(
    new NextRequest("https://weeb-x.test/api/auth/captcha/puzzle?w=360&h=160")
  )
  expect(res.status).toBe(200)
  return res.json()
}

/** Пройти пазл «по-честному»: достаём цель из токена тестовым секретом. */
async function solvePuzzle(): Promise<string> {
  const { token } = await getPuzzle()
  const payload = unsealPuzzle(token, TEST_SECRET)
  if (!payload) throw new Error("токен пазла не расшифровывается тестовым секретом")

  const res = await puzzleRoute.POST(
    request("/api/auth/captcha/puzzle", {
      token,
      userFraction: payload.tX / 1000,
      trajectory: humanTrajectory(),
    })
  )
  const json = await res.json()
  expect(json.success, JSON.stringify(json)).toBe(true)
  return json.verificationToken
}

describe("GET /api/auth/captcha/puzzle", () => {
  it("не отдаёт координату дырки по X", async () => {
    const res = await puzzleRoute.GET(
      new NextRequest("https://weeb-x.test/api/auth/captcha/puzzle?w=360&h=160")
    )
    const raw = await res.text()
    const json = JSON.parse(raw)

    // Раньше в ответе лежало `targetX`, и скрипт мог забрать координату,
    // ничего не открывая.
    expect(json).not.toHaveProperty("targetX")
    expect(json).not.toHaveProperty("bgUrl")
    expect(raw).not.toContain("targetX")

    expect(typeof json.puzzle).toBe("string")
    expect(typeof json.piece).toBe("string")
    // Относительный адрес: так он гарантированно совпадает с origin страницы.
    expect(json.puzzle).toMatch(/^\/api\/auth\/captcha\/puzzle\/image\?token=.+$/)
    expect(json.piece).toMatch(/^\/api\/auth\/captcha\/puzzle\/image\?token=.+&part=piece$/)
    expect(typeof json.targetY).toBe("number")
    expect(typeof json.token).toBe("string")
  })

  it("выдаёт токен, из которого позиция не читается", async () => {
    const { token } = await getPuzzle()
    // Прежний формат начинался с `640.380.<timestamp>`.
    expect(token).not.toMatch(/^\d+\.\d+\./)
  })

  it("подставляет дефолтный размер контейнера для мусорных параметров", async () => {
    const res = await puzzleRoute.GET(
      new NextRequest("https://weeb-x.test/api/auth/captcha/puzzle?w=abc&h=-5")
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toHaveProperty("token")
  })
})

describe("GET /api/auth/captcha/puzzle/image", () => {
  it("рисует картинку с дыркой по токену", async () => {
    const { token } = await getPuzzle()
    const res = await imageRoute.GET(
      new NextRequest(
        `https://weeb-x.test/api/auth/captcha/puzzle/image?token=${encodeURIComponent(token)}`
      )
    )

    expect(res.status).toBe(200)
    expect(res.headers.get("Content-Type")).toContain("image/svg+xml")

    const svg = await res.text()
    expect(svg.startsWith("<svg")).toBe(true)
    // Фон встроен как data-URI (внешний Chrome не рисует), дырка — контур.
    expect(svg).toContain('<image href="data:image/webp;base64,')
    expect(svg).toContain("<path")
  })

  it("отдаёт кусочек с кадром из-под дырки, а не пустышку", async () => {
    const { token } = await getPuzzle()
    const res = await imageRoute.GET(
      new NextRequest(
        `https://weeb-x.test/api/auth/captcha/puzzle/image?token=${encodeURIComponent(token)}&part=piece`
      )
    )

    expect(res.status).toBe(200)
    const svg = await res.text()

    // Кусочек обязан нести картинку: с полупрозрачной «заглушкой» дырка
    // просвечивала даже при правильном положении, и совпадение нельзя было
    // увидеть глазами — на это и жаловались.
    expect(svg).toContain('clip-path="url(#piece)"')
    expect(svg).toContain('<image href="data:image/webp;base64,')
    // Контур: синий в обычном состоянии, зелёный после победы.
    expect(svg).toContain('stroke="#38bdf8"')
    expect(svg).not.toContain("#34d399")
  })

  it("переключает рамку кусочка на зелёную при `solved=1`", async () => {
    const { token } = await getPuzzle()
    const res = await imageRoute.GET(
      new NextRequest(
        `https://weeb-x.test/api/auth/captcha/puzzle/image?token=${encodeURIComponent(token)}&part=piece&solved=1`
      )
    )

    const svg = await res.text()
    expect(svg).toContain('stroke="#34d399"')
  })

  it("не отдаёт картинку по мусорному токену", async () => {
    const res = await imageRoute.GET(
      new NextRequest("https://weeb-x.test/api/auth/captcha/puzzle/image?token=AAAA.BBBB.CCCC")
    )
    expect(res.status).toBe(404)
  })

  it("не отдаёт картинку по протухшему токену", async () => {
    const expired = sealPuzzle(
      {
        tX: 500,
        tY: 300,
        ts: Date.now() - 10 * 60_000,
        nonce: "stale",
        bg: 0,
        w: 360,
        h: 160,
      },
      TEST_SECRET
    )

    const res = await imageRoute.GET(
      new NextRequest(
        `https://weeb-x.test/api/auth/captcha/puzzle/image?token=${encodeURIComponent(expired)}`
      )
    )
    expect(res.status).toBe(410)
  })
})

describe("POST /api/auth/captcha/puzzle", () => {
  it("принимает верное решение и выдаёт токен проверки", async () => {
    const verificationToken = await solvePuzzle()
    expect(typeof verificationToken).toBe("string")
    expect(verificationToken.split(".")).toHaveLength(3)
  })

  it("отклоняет промах мимо дырки понятным текстом", async () => {
    const { token } = await getPuzzle()
    const payload = unsealPuzzle(token, TEST_SECRET)
    if (!payload) throw new Error("токен не расшифровался")

    // 10% — за пределами нового допуска в 2%.
    const res = await puzzleRoute.POST(
      request("/api/auth/captcha/puzzle", {
        token,
        userFraction: payload.tX / 1000 + 0.1,
        trajectory: humanTrajectory(),
      })
    )
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.error).toBe("Кусочек не совпал с дыркой. Попробуйте ещё раз.")
    // Клиент по этому флагу оставляет пазл на месте. Раньше любой отказ
    // подменял его новым через 1.2с, и десять попыток означали десять разных
    // картинок — промах стоил пользователю всей работы.
    expect(json.reason).toBe("position")
  })

  it("помечает отказ по траектории как повторяемый на том же пазле", async () => {
    const { token } = await getPuzzle()
    const payload = unsealPuzzle(token, TEST_SECRET)
    if (!payload) throw new Error("токен не расшифровался")

    const synthetic: TrajectoryPoint[] = []
    for (let i = 0; i < 20; i++) {
      synthetic.push({ x: i * 8, y: 500, t: 1_700_000_000_000 + i * 60 })
    }

    const res = await puzzleRoute.POST(
      request("/api/auth/captcha/puzzle", {
        token,
        userFraction: payload.tX / 1000,
        trajectory: synthetic,
      })
    )
    const json = await res.json()
    expect(json.success).toBe(false)
    expect(json.reason).toBe("trajectory")
  })

  it("помечает протухший токен как требующий нового пазла", async () => {
    const expired = sealPuzzle(
      { tX: 500, tY: 300, ts: Date.now() - 10 * 60_000, nonce: "old", bg: 0, w: 360, h: 160 },
      TEST_SECRET
    )

    const res = await puzzleRoute.POST(
      request("/api/auth/captcha/puzzle", {
        token: expired,
        userFraction: 0.5,
        trajectory: humanTrajectory(),
      })
    )
    const json = await res.json()
    expect(json.success).toBe(false)
    // Здесь пазл менять нужно: иначе человек будет биться в заведомо
    // непройдаваемую картинку.
    expect(json.reason).toBe("expired")
  })

  it("отклоняет синтетическую траекторию, не обвиняя пользователя", async () => {
    const { token } = await getPuzzle()
    const payload = unsealPuzzle(token, TEST_SECRET)
    if (!payload) throw new Error("токен не расшифровался")

    // Идеально ровная скорость и никакого дрожания — машинный ввод.
    const synthetic: TrajectoryPoint[] = []
    for (let i = 0; i < 20; i++) {
      synthetic.push({ x: i * 8, y: 500, t: 1_700_000_000_000 + i * 60 })
    }
    expect(analyzeTrajectory(synthetic)).toBe(false)

    const res = await puzzleRoute.POST(
      request("/api/auth/captcha/puzzle", {
        token,
        userFraction: payload.tX / 1000,
        trajectory: synthetic,
      })
    )
    const json = await res.json()
    expect(json.success).toBe(false)
    // Формулировка про «неестественное движение» звучала как обвинение:
    // человек-то просто не смог перетащить кусочек так, как это сделала бы рука.
    expect(json.error).toBe(
      "Проверка не пройдена. Попробуйте перетащить кусочек ещё раз."
    )
    expect(json.error).not.toMatch(/неестественн/i)
    expect(json.error).not.toMatch(/бот/i)
  })

  it("отклоняет подделанный токен", async () => {
    const res = await puzzleRoute.POST(
      request("/api/auth/captcha/puzzle", {
        token: "AAAA.BBBB.CCCC",
        userFraction: 0.5,
        trajectory: humanTrajectory(),
      })
    )
    expect(res.status).toBe(403)
  })
})

describe("POST /api/auth/register", () => {
  it("не пускает без токена капчи", async () => {
    const supabaseFetch = vi.fn()
    vi.stubGlobal("fetch", supabaseFetch)

    const res = await registerRoute.POST(
      request("/api/auth/register", {
        email: "bot@example.com",
        password: "hunter2hunter2",
      })
    )

    expect(res.status).toBe(403)
    expect(supabaseFetch).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it("переводит ответ Supabase на русский и не показывает сырое сообщение", async () => {
    // Раньше пользователю прилетало «User already registered» или
    // «Database error saving new user» — и то и другое по-английски.
    const cases: Array<{ status: number; body: Record<string, unknown>; expected: string }> = [
      {
        status: 422,
        body: { msg: "User already registered", error_code: "user_already_exists" },
        expected: "Аккаунт с таким email уже есть. Попробуйте войти.",
      },
      {
        status: 422,
        body: { message: "A user with this email address has already been registered" },
        expected: "Аккаунт с таким email уже есть. Попробуйте войти.",
      },
      {
        status: 400,
        body: { msg: "Password should be at least 6 characters.", error_code: "weak_password" },
        expected: "Пароль слишком простой. Придумайте подлиннее и попробуйте снова.",
      },
      {
        status: 500,
        body: { msg: "Database error saving new user", error_code: "unexpected_failure" },
        expected: "Что-то пошло не так на нашей стороне. Попробуйте позже.",
      },
      {
        status: 400,
        body: { msg: "Something nobody has ever seen before" },
        expected: "Не получилось создать аккаунт. Попробуйте ещё раз — если не выйдет, напишите нам.",
      },
    ]

    for (const testCase of cases) {
      const supabaseFetch = vi.fn().mockResolvedValue(
        new Response(JSON.stringify(testCase.body), {
          status: testCase.status,
          headers: { "Content-Type": "application/json" },
        })
      )
      vi.stubGlobal("fetch", supabaseFetch)

      const captchaToken = await solvePuzzle()
      const res = await registerRoute.POST(
        request("/api/auth/register", {
          email: "bot@example.com",
          password: "hunter2hunter2",
          captchaToken,
        })
      )

      const json = await res.json()
      expect(json.error, JSON.stringify(testCase.body)).toBe(testCase.expected)
      // Человек не должен видеть английских фраз Supabase. «email» —
      // единственное допустимое латинское слово в русском интерфейсе.
      expect(
        (json.error.replace(/email/gi, "").match(/[A-Za-z]+/g) ?? []),
        JSON.stringify(testCase.body)
      ).toEqual([])

      vi.unstubAllGlobals()
    }
  })

  it("не пускает с токеном, подписанным чужим секретом", async () => {
    const supabaseFetch = vi.fn()
    vi.stubGlobal("fetch", supabaseFetch)

    const forged = generateVerificationToken(Date.now(), "nonce-abc", "wrong-secret")
    const res = await registerRoute.POST(
      request("/api/auth/register", {
        email: "bot@example.com",
        password: "hunter2hunter2",
        captchaToken: forged,
      })
    )

    expect(res.status).toBe(403)
    expect(supabaseFetch).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it("не пускает с протухшим токеном", async () => {
    const supabaseFetch = vi.fn()
    vi.stubGlobal("fetch", supabaseFetch)

    const stale = generateVerificationToken(
      Date.now() - 11 * 60_000,
      "nonce-stale",
      TEST_SECRET
    )
    const res = await registerRoute.POST(
      request("/api/auth/register", {
        email: "bot@example.com",
        password: "hunter2hunter2",
        captchaToken: stale,
      })
    )

    expect(res.status).toBe(403)
    expect(supabaseFetch).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })

  it("доходит до Supabase с настоящим токеном и не пускает повторно", async () => {
    const supabaseFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "user-id", email: "bot@example.com" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    )
    vi.stubGlobal("fetch", supabaseFetch)

    const captchaToken = await solvePuzzle()

    const first = await registerRoute.POST(
      request("/api/auth/register", {
        email: "bot@example.com",
        password: "hunter2hunter2",
        captchaToken,
      })
    )

    // Капча принята — запрос дошёл до Supabase.
    expect(first.status).toBe(200)
    expect(supabaseFetch).toHaveBeenCalledTimes(1)

    const [url, init] = supabaseFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://project.supabase.co/auth/v1/signup")
    expect(JSON.parse(String(init.body))).toMatchObject({
      email: "bot@example.com",
      password: "hunter2hunter2",
    })

    // Тот же токен второй раз не работает: иначе один пазл кормил бы
    // неограниченное число регистраций.
    const second = await registerRoute.POST(
      request("/api/auth/register", {
        email: "another@example.com",
        password: "hunter2hunter2",
        captchaToken,
      })
    )
    expect(second.status).toBe(403)
    expect(supabaseFetch).toHaveBeenCalledTimes(1)

    vi.unstubAllGlobals()
  })

  it("не пускает мусорный email", async () => {
    const supabaseFetch = vi.fn()
    vi.stubGlobal("fetch", supabaseFetch)

    const res = await registerRoute.POST(
      request("/api/auth/register", {
        email: "не-почта",
        password: "hunter2hunter2",
        captchaToken: generateVerificationToken(Date.now(), "n", TEST_SECRET),
      })
    )

    expect(res.status).toBe(400)
    expect(supabaseFetch).not.toHaveBeenCalled()

    vi.unstubAllGlobals()
  })
})
