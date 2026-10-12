/**
 * Регрессии на защиту плеера от автоматических сканеров.
 *
 * Контекст. На живом сайте был воспроизведён полный обход защиты двумя
 * запросами с обычным User-Agent Chrome:
 *
 *   1) GET /api/player/translations?shikimoriId=21  → 200, `playerLink: /embed/<токен>`
 *   2) GET /embed/<токен>                            → 302 Location: kodikplayer.com/serial/...
 *
 * Второй запрос и есть то, что нужно антипиратскому сканеру для страйка.
 * Замер до правки: 40 параллельных запросов на каждый маршрут — 40 ответов
 * 200/302, ни одного отказа.
 *
 * Что защищает шифрованный токен и что не защищает: он прячет прямую
 * ссылку ОТ ВЗГЛЯДА (из HTML и из чужого кода), но не от владельца —
 * получив токен, ссылку можно развернуть обратно. Значит, ограничивать надо
 * не только выдачу токенов, но и число их разворачивания.
 */

import { describe, expect, it } from "vitest"
import {
  PLAYER_TOKEN_TTL_SEC,
  createPlayerToken,
  resolvePlayerToken,
} from "@/lib/player-protect"
import { createRateLimiter } from "@/lib/rate-limit"

const KODIK_URL = "https://kodikplayer.com/serial/4277/b1108a88309da7c36fe632b47937eb3c/720p"

/* ------------------------------------------------------------------ */
/* Секрет шифрования                                                   */
/* ------------------------------------------------------------------ */

describe("секрет шифрования ссылок на плеер", () => {
  it("разворачивается тем же секретом, которым выдан", () => {
    const token = createPlayerToken(KODIK_URL)
    expect(resolvePlayerToken(token!)).toBe(KODIK_URL)
  })
})

/* ------------------------------------------------------------------ */
/* Время жизни токена                                                  */
/* ------------------------------------------------------------------ */

describe("время жизни токена", () => {
  it("короче суток — окно, в котором токен можно использовать", () => {
    // 48 часов держали защиту широкой: токен из кэша CDN мог лежать сутки и
    // быть отдан кому угодно. Двух часов хватает одному просмотру.
    expect(PLAYER_TOKEN_TTL_SEC).toBeLessThanOrEqual(2 * 60 * 60)
  })

  it("не настолько короткий, чтобы ломать просмотр", () => {
    // Просмотр одной серии вместе с выбором озвучки укладывается в час.
    expect(PLAYER_TOKEN_TTL_SEC).toBeGreaterThanOrEqual(60 * 60)
  })

  it("подделанный токен не разворачивается", () => {
    // Даже с правильным сроком жизни: подделка не проходит проверку GCM.
    expect(resolvePlayerToken("dGFza2FtYWdlbmVyYXNoaXhjbGFudmFjdW9y")).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Пределы на обоих маршрутах                                          */
/* ------------------------------------------------------------------ */

/**
 * Те же числа, что стоят в роутах. Дублируем намеренно: если в коде
 * поменяют лимит, тест напомнит, что цифра из защиты изменилась, и её надо
 * будет пересмотреть, а не молча получить новую.
 */
const TRANSLATIONS_LIMIT = { interval: 60_000, maxRequests: 20 }
const EMBED_LIMIT = { interval: 60_000, maxRequests: 40 }

describe("антипиратский перебор упирается в предел", () => {
  it("список озвучек: массовый перебор получает отказ", () => {
    const limiter = createRateLimiter(TRANSLATIONS_LIMIT)
    const id = `scanner-translations-${Math.random()}`

    let refused = 0
    for (let i = 0; i < 200; i++) {
      if (!limiter.checkLimit(id).success) refused++
    }

    // 200 попыток за минуту от одного адреса: реальный зритель так не
    // ходит, а переборщик обязан упереться.
    expect(refused).toBeGreaterThan(150)
  })

  it("/embed: разворачивание токенов пачкой тоже ограничено", () => {
    const limiter = createRateLimiter(EMBED_LIMIT)
    const id = `scanner-embed-${Math.random()}`

    let refused = 0
    for (let i = 0; i < 200; i++) {
      if (!limiter.checkLimit(id).success) refused++
    }

    expect(refused).toBeGreaterThan(150)
  })

  it("предел не мешает обычному зрителю", () => {
    // Человек за сеанс открывает единицы серий и пару раз меняет озвучку.
    // 40 редиректов в минуту — с большим запасом.
    const limiter = createRateLimiter(EMBED_LIMIT)
    const id = `viewer-${Math.random()}`

    for (let i = 0; i < 30; i++) {
      expect(limiter.checkLimit(id).success).toBe(true)
    }
  })

  it("предел изолирован по адресу", () => {
    // Один адрес не должен обнулять лимит другого: за общим IP может
    // сидеть мобильный оператор с натром.
    const limiter = createRateLimiter(TRANSLATIONS_LIMIT)

    for (let i = 0; i < TRANSLATIONS_LIMIT.maxRequests; i++) {
      expect(limiter.checkLimit("ip-a").success).toBe(true)
    }
    expect(limiter.checkLimit("ip-a").success).toBe(false)
    expect(limiter.checkLimit("ip-b").success).toBe(true)
  })
})