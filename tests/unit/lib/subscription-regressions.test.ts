/**
 * Регрессия: колокольчик не теряет уведомление об озвучке.
 *
 * `episode_updates` — одна таблица на два разных уведомления:
 *   `shikimori` — «вышла новая серия» (пишет браузер);
 *   `dub`       — «появилась озвучка» (пишет сервер и бот).
 *
 * Числа в них несопоставимы: для одного тайтла Kodik может показать 12 серий,
 * а Shikimori — 3 вышло. Именно поэтому колонка `source` и введена.
 *
 * Баг был в том, что после проверки колокольчик выбрасывал всё, чего нет
 * среди тайтлов с каналом `notify_new_episodes`. Но в этот список попадают
 * только те тайтлы, которые браузер вообще умеет проверять, а подписавшийся
 * ТОЛЬКО на озвучку из плеера — не попадает. Его уведомление об озвучке
 * молча исчезало из колокольчика, хотя запись в БД оставалась.
 *
 * Баг 1 (плашка молча включала ожидание новых серий) закрыт отдельно, на
 * настоящем хуке: `tests/unit/hooks/use-translation-alert.test.ts`.
 */

import { describe, expect, it } from "vitest"
import {
  isStaleSubscriptionUpdate,
  keepLiveSubscriptionUpdates,
  type EpisodeUpdateLike,
} from "@/lib/title-subscriptions"

type Update = EpisodeUpdateLike

/**
 * Ровно тот отбор, который делает `episode-updates-provider` после проверки.
 *
 * Функция живёт в `lib`, а не в компоненте: правило «что считается устаревшим»
 * обязано быть одно на сайт и на тест, иначе тест проверяет не то, что
 * работает в проде.
 */
const keepAfterCheck = keepLiveSubscriptionUpdates

describe("колокольчик не теряет уведомление об озвучке", () => {
  it("оставляет уведомление об озвучке, даже если тайтл не проверяется браузером", () => {
    const updates: Update[] = [
      { animeId: "111", source: "shikimori" },
      { animeId: "222", source: "dub" },
    ]

    // Браузер проверяет только тайтлы с каналом «новые серии».
    const kept = keepAfterCheck(updates, ["111"])

    expect(kept).toEqual([
      { animeId: "111", source: "shikimori" },
      { animeId: "222", source: "dub" },
    ])
  })

  it("выбрасывает запись браузера, если человек отписался", () => {
    const updates: Update[] = [
      { animeId: "111", source: "shikimori" },
      { animeId: "333", source: "shikimori" },
    ]

    // 333 больше не в списке подписок — уведомление правда устарело.
    expect(keepAfterCheck(updates, ["111"])).toEqual([{ animeId: "111", source: "shikimori" }])
  })

  it("не выбрасывает ничего, если проверять нечего (тайтлов нет)", () => {
    // Пустой список — это «проверять нечего», а не «всё устарело». Записи
    // сервера в этом случае обязаны остаться на месте.
    const updates: Update[] = [{ animeId: "222", source: "dub" }]

    expect(keepAfterCheck(updates, [])).toEqual([{ animeId: "222", source: "dub" }])
  })

  it("устаревшим бывает только браузерное уведомление", () => {
    // Проверка источника — единственное, что отличает «своё» от «чужого».
    // Без неё любая запись вне `checkedIds` считалась бы устаревшей.
    expect(isStaleSubscriptionUpdate({ animeId: "1", source: "dub" }, [])).toBe(false)
    expect(isStaleSubscriptionUpdate({ animeId: "1", source: "shikimori" }, [])).toBe(true)
  })
})
