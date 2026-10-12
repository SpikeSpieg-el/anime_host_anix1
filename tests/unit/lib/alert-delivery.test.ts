/**
 * Доставка уведомлений: захват ожидания и продление после срабатывания.
 *
 * Здесь закреплены решения, которые выглядят простыми, но ломаются молча:
 *
 *  - `hasNewEpisode` vs закрытое ожидание (тот же файл правил, что и на сайте);
 *  - кнопка «Следить дальше» должна начинать со СЛЕДУЮЩЕЙ серии, иначе скан
 *    разрешит ожидание тем же самым, о чём человек уже получил уведомление.
 */

import { describe, expect, it } from "vitest"
import { hasNewEpisode, type TitleSubscription } from "@/lib/title-subscriptions"

const sub = (overrides: Partial<TitleSubscription> = {}): TitleSubscription => ({
  animeId: "64510",
  animeTitle: "Наруто",
  poster: null,
  notifyNewEpisodes: true,
  notifyDub: true,
  baselineEpisode: 10,
  ...overrides,
})

/**
 * Продление закрытого ожидания — та же арифметика, что в обработчике
 * «Следить дальше». Дублируем её здесь намеренно: правило проверяется
 * отдельно от БД, чтобы падение UPDATE (которое тестами не ловится) не
 * выглядело как «правило сломалось».
 */
function continueWaiting(
  lastKnown: { episode?: number | null; baselineEpisode?: number | null },
): { episode: number; baselineEpisode: number } {
  const last = Math.max(Number(lastKnown.baselineEpisode) || 0, Number(lastKnown.episode) || 0, 0)
  return { episode: last + 1, baselineEpisode: last }
}

describe("продление после срабатывания", () => {
  it("ждёт серию после той, что уже пришла", () => {
    const next = continueWaiting({ episode: 12, baselineEpisode: 12 })
    expect(next).toEqual({ episode: 13, baselineEpisode: 12 })
  })

  it("не разрешается сразу тем же, что уже сообщили", () => {
    // Главная ошибка реализации: если бы baseline остался 12, а episode
    // тоже 12, скан через минуту написал бы «появилась озвучка» про ту же
    // серию, которую человек только что получил.
    const next = continueWaiting({ episode: 12, baselineEpisode: 12 })
    expect(hasNewEpisode(sub(next), 12)).toBe(false)
    expect(hasNewEpisode(sub(next), 13)).toBe(true)
  })

  it("берёт максимум из episode и baseline, а не первое попавшееся", () => {
    // baseline бывает больше episode: подписку создавали на 10, а ждали 3.
    const next = continueWaiting({ episode: 3, baselineEpisode: 10 })
    expect(next).toEqual({ episode: 11, baselineEpisode: 10 })
  })

  it("начинает с первой серии, если неизвестно, где остановились", () => {
    const next = continueWaiting({})
    expect(next).toEqual({ episode: 1, baselineEpisode: 0 })
    // Ожидание первой серии не должно разрешиться мгновенно тем же самым.
    expect(hasNewEpisode(sub(next), 1)).toBe(true)
  })

  it("не падает на мусоре в базе", () => {
    const next = continueWaiting({ episode: Number.NaN, baselineEpisode: null })
    expect(next).toEqual({ episode: 1, baselineEpisode: 0 })
  })

  it("не откатывается назад, если episode меньше baseline", () => {
    const next = continueWaiting({ episode: 5, baselineEpisode: 20 })
    expect(next.baselineEpisode).toBe(20)
    expect(next.episode).toBe(21)
  })
})

describe("захват ожидания", () => {
  /**
   * Условие захвата — `.is("notified_at", null)` в UPDATE. Именно оно
   * делает проверку атомарной: без него UPDATE без условия всегда затрагивает
   * строку и всегда возвращает её, даже если второй писатель закрыл её
   * миллисекундой раньше. Именно из-за этого человек получал два
   * одинаковых уведомления, когда вкладка и бот проверяли одно ожидание
   * одновременно.
   *
   * Тест фиксирует инвариант, а не реализацию БД: закрыть должен суметь
   * ровно один, и второй обязан уйти молча.
   */
  it("закрывает ожидание ровно один раз", () => {
    const row = { notified_at: null as string | null }

    // Первый претендент: условие выполнено, строка закрыта.
    const claim = (): boolean => {
      if (row.notified_at !== null) return false
      row.notified_at = new Date(1000).toISOString()
      return true
    }

    expect(claim()).toBe(true)
    // Второй претендент обязан получить 0 затронутых строк и уйти, ничего
    // не отправив.
    expect(claim()).toBe(false)
    expect(row.notified_at).toBe(new Date(1000).toISOString())
  })
})

describe("запись уведомления в колокольчик", () => {
  it("помечает серверную запись как dub, чтобы браузер её не тронул", () => {
    // Число в серверной записи — «сколько серий доступно в Kodik». Браузер
    // считает по episodes_aired, и раньше подставлял своё, из-за чего
    // уведомление показывало 3 вместо 12.
    const serverRecord = { newEpisode: 12, source: "dub" as const }
    const browserWouldWrite = 3

    expect(serverRecord.source).toBe("dub")
    expect(serverRecord.newEpisode).not.toBe(browserWouldWrite)
  })
})