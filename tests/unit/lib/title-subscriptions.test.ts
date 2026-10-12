/**
 * Подписки на тайтлы (`title_subscriptions`).
 *
 * Регрессия на главную дыру модели уведомлений: подписки как сущности не
 * существовало, список проверяемых тайтлов строился как
 * `watch_history ∪ bookmarks`, и уведомлениями нельзя было управлять — ни
 * подписаться на нормальный тайтл, ни отписаться. Здесь закреплены правила,
 * на которых держится явная подписка.
 */

import { describe, expect, it } from "vitest"
import {
  PENDING_SUBSCRIPTIONS_LIMIT,
  PENDING_SUBSCRIPTION_TTL_MS,
  PENDING_SUBSCRIPTIONS_STORAGE_KEY,
  SUBSCRIBE_DEEP_LINK_PARAM,
  buildSubscribeStartPayload,
  buildSubscription,
  clearPendingSubscription,
  hasNewEpisode,
  isSubscribed,
  isSubscriptionDueForCheck,
  mapSubscriptionRow,
  mergeSubscriptionChannels,
  parseSubscribeStartPayload,
  pluralEpisodes,
  readPendingSubscriptions,
  rememberPendingSubscription,
  subscriptionSummary,
  toSubscriptionRow,
  getSubscriptionWatchPath,
  type TitleSubscription,
} from "@/lib/title-subscriptions"

const sub = (overrides: Partial<TitleSubscription> = {}): TitleSubscription => ({
  animeId: "64510",
  animeTitle: "Наруто",
  poster: null,
  notifyNewEpisodes: true,
  notifyDub: true,
  baselineEpisode: 10,
  ...overrides,
})

/* ------------------------------------------------------------------ */
/* Сборка подписки                                                     */
/* ------------------------------------------------------------------ */

describe("buildSubscription", () => {
  it("подставляет название, если его не передали", () => {
    const result = buildSubscription({ animeId: "12345" })
    expect(result?.animeTitle).toBe("Аниме #12345")
  })

  it("отказывается от пустого id", () => {
    expect(buildSubscription({ animeId: "" })).toBeNull()
    expect(buildSubscription({ animeId: "   " })).toBeNull()
  })

  it("по умолчанию ждёт и серии, и озвучку", () => {
    const result = buildSubscription({ animeId: "1" })
    expect(result?.notifyNewEpisodes).toBe(true)
    expect(result?.notifyDub).toBe(true)
  })

  it("не даёт подписку без каналов: включает серии", () => {
    // Человек нажал кнопку «слежу», а не выбирал канал из двух. Подписка,
    // которая ничего не обещает, — это не то, что он просил.
    const result = buildSubscription({
      animeId: "1",
      notifyNewEpisodes: false,
      notifyDub: false,
    })
    expect(result?.notifyNewEpisodes).toBe(true)
    expect(isSubscribed(result)).toBe(true)
  })

  it("уважает один выключенный канал", () => {
    const onlyDub = buildSubscription({
      animeId: "1",
      notifyNewEpisodes: false,
      notifyDub: true,
    })
    expect(onlyDub?.notifyNewEpisodes).toBe(false)
    expect(onlyDub?.notifyDub).toBe(true)

    const onlyEpisodes = buildSubscription({
      animeId: "1",
      notifyNewEpisodes: true,
      notifyDub: false,
    })
    expect(onlyEpisodes?.notifyNewEpisodes).toBe(true)
    expect(onlyEpisodes?.notifyDub).toBe(false)
  })

  it("не принимает отрицательный или дробный baseline", () => {
    expect(buildSubscription({ animeId: "1", baselineEpisode: -5 })?.baselineEpisode).toBe(0)
    expect(buildSubscription({ animeId: "1", baselineEpisode: 7.9 })?.baselineEpisode).toBe(7)
    expect(buildSubscription({ animeId: "1", baselineEpisode: null })?.baselineEpisode).toBe(0)
  })

  it("числительное для «серия/серии/серий» не путается", () => {
    expect(pluralEpisodes(1)).toBe("серия")
    expect(pluralEpisodes(3)).toBe("серии")
    expect(pluralEpisodes(5)).toBe("серий")
    expect(pluralEpisodes(11)).toBe("серий")
    expect(pluralEpisodes(21)).toBe("серия")
  })
})

/* ------------------------------------------------------------------ */
/* Каналы                                                              */
/* ------------------------------------------------------------------ */

describe("subscriptionSummary", () => {
  it("описывает, что именно человек ждёт", () => {
    expect(subscriptionSummary(sub({ notifyNewEpisodes: true, notifyDub: true }))).toBe(
      "серии и озвучка",
    )
    expect(subscriptionSummary(sub({ notifyNewEpisodes: true, notifyDub: false }))).toBe(
      "новые серии",
    )
    expect(subscriptionSummary(sub({ notifyNewEpisodes: false, notifyDub: true }))).toBe("озвучка")
  })

  it("возвращает null без подписки", () => {
    expect(subscriptionSummary(null)).toBeNull()
    expect(subscriptionSummary(undefined)).toBeNull()
  })
})

/* ------------------------------------------------------------------ */
/* Маппинг строки БД                                                   */
/* ------------------------------------------------------------------ */

describe("mapSubscriptionRow", () => {
  it("читает обе колонки-флага", () => {
    const result = mapSubscriptionRow({
      anime_id: "42",
      anime_title: "Наруто",
      notify_new_episodes: true,
      notify_dub: false,
      baseline_episode: 5,
    })
    expect(result).toEqual({
      animeId: "42",
      animeTitle: "Наруто",
      poster: null,
      notifyNewEpisodes: true,
      notifyDub: false,
      baselineEpisode: 5,
      lastNotifiedEpisode: null,
    })
  })

  it("отличает «выключено» от «значения нет»", () => {
    // Строки, созданные до добавления колонок, приходят с null. null здесь —
    // «неизвестно», а не «выключено»: иначе подписка молча пропадала бы.
    const withNull = mapSubscriptionRow({
      anime_id: "42",
      notify_new_episodes: null,
      notify_dub: null,
    })
    expect(withNull?.notifyNewEpisodes).toBe(true)
    expect(withNull?.notifyDub).toBe(true)
  })

  it("не теряет last_notified_episode — иначе придёт повтор", () => {
    const result = mapSubscriptionRow({
      anime_id: "42",
      baseline_episode: 10,
      last_notified_episode: 12,
    })
    expect(result?.lastNotifiedEpisode).toBe(12)
  })

  it("null в last_notified_episode остаётся null, а не нулём", () => {
    const result = mapSubscriptionRow({
      anime_id: "42",
      last_notified_episode: null,
    })
    expect(result?.lastNotifiedEpisode).toBeNull()
  })

  it("отбрасывает строку без id", () => {
    expect(mapSubscriptionRow({ anime_id: "" })).toBeNull()
    expect(mapSubscriptionRow(null)).toBeNull()
    expect(mapSubscriptionRow(undefined)).toBeNull()
  })

  it("терпит мусор в числах", () => {
    const result = mapSubscriptionRow({
      anime_id: "42",
      baseline_episode: Number.NaN,
      last_notified_episode: -3,
    })
    expect(result?.baselineEpisode).toBe(0)
    expect(result?.lastNotifiedEpisode).toBe(0)
  })
})

describe("mergeSubscriptionChannels", () => {
  it("не отменяет подписку на серии, созданную с другой страницы", () => {
    // Подписался на серии кнопкой «Следить за тайтлом», потом нажал
    // «Уведомить меня» в плеере. Плашка обещает только озвучку — и не должна
    // молча отменять то, про что человек не говорил.
    const merged = mergeSubscriptionChannels(
      { notifyNewEpisodes: true, notifyDub: false },
      { notifyNewEpisodes: false, notifyDub: true },
    )
    expect(merged).toEqual({ notifyNewEpisodes: true, notifyDub: true })
  })

  it("добавляет канал, которого не было", () => {
    const merged = mergeSubscriptionChannels(
      { notifyNewEpisodes: true, notifyDub: false },
      { notifyNewEpisodes: false, notifyDub: true },
    )
    expect(merged.notifyDub).toBe(true)
  })

  it("считает отсутствующую строку с подпиской, а не без неё", () => {
    expect(mergeSubscriptionChannels(null, { notifyNewEpisodes: false, notifyDub: true })).toEqual({
      notifyNewEpisodes: false,
      notifyDub: true,
    })
  })

  it("не выключает канал, который уже обещан", () => {
    const merged = mergeSubscriptionChannels(
      { notifyNewEpisodes: true, notifyDub: true },
      { notifyNewEpisodes: true, notifyDub: true },
    )
    expect(merged).toEqual({ notifyNewEpisodes: true, notifyDub: true })
  })
})

describe("toSubscriptionRow", () => {
  it("кладёт snake_case и обнуляет отметку о прошлом уведомлении", () => {
    // Повторная подписка обязана начать отсчёт заново: человек явно сказал
    // «слежу», и старая отметка не должна мешать новой серии прийти снова.
    const row = toSubscriptionRow("user-1", sub({ lastNotifiedEpisode: 12 })) as Record<string, unknown>

    expect(row.user_id).toBe("user-1")
    expect(row.anime_id).toBe("64510")
    expect(row.notify_new_episodes).toBe(true)
    expect(row.notify_dub).toBe(true)
    expect(row.source).toBe("manual")
    expect(row.baseline_episode).toBe(10)
    expect(row.last_notified_episode).toBeNull()
    expect(row.last_checked_at).toBeNull()
  })

  it("подставляет источник, если он задан", () => {
    const row = toSubscriptionRow("u", sub(), { source: "bookmark" }) as Record<string, unknown>
    expect(row.source).toBe("bookmark")
  })
})

/* ------------------------------------------------------------------ */
/* Правило «вышла ли новая серия»                                      */
/* ------------------------------------------------------------------ */

describe("hasNewEpisode", () => {
  it("уведомляет, когда вышло больше, чем человек видел", () => {
    expect(hasNewEpisode(sub({ baselineEpisode: 10 }), 11)).toBe(true)
  })

  it("молчит, когда ничего нового", () => {
    expect(hasNewEpisode(sub({ baselineEpisode: 10 }), 10)).toBe(false)
  })

  it("не присылает мгновенное ложное уведомление о давно вышедшем тайтле", () => {
    // Ровно тот баг, ради которого существует baseline: подписка на тайтл,
    // у которого уже 12 серий, не должна тут же написать «вышла 12».
    expect(hasNewEpisode(sub({ baselineEpisode: 12 }), 12)).toBe(false)
  })

  it("не повторяет уже отправленную серию", () => {
    // Без last_notified_episode уведомление о 12-й серии приходило бы на
    // каждой проверке, пока Shikimori не обновит счётчик, — то есть каждые
    // полчаса.
    expect(hasNewEpisode(sub({ baselineEpisode: 10, lastNotifiedEpisode: 12 }), 12)).toBe(false)
    expect(hasNewEpisode(sub({ baselineEpisode: 10, lastNotifiedEpisode: 12 }), 13)).toBe(true)
  })

  it("не срабатывает на нуле и мусоре от Shikimori", () => {
    expect(hasNewEpisode(sub({ baselineEpisode: 10 }), 0)).toBe(false)
    expect(hasNewEpisode(sub({ baselineEpisode: 10 }), Number.NaN)).toBe(false)
  })
})

describe("isSubscriptionDueForCheck", () => {
  const now = 1_700_000_000_000

  it("пустая подписка проверяется сразу", () => {
    expect(isSubscriptionDueForCheck(null, now)).toBe(true)
    expect(isSubscriptionDueForCheck(undefined, now)).toBe(true)
    expect(isSubscriptionDueForCheck("", now)).toBe(true)
  })

  it("не проверяет раньше окна в полчаса", () => {
    const justChecked = new Date(now - 10 * 60 * 1000).toISOString()
    expect(isSubscriptionDueForCheck(justChecked, now)).toBe(false)
  })

  it("проверяет после окна", () => {
    const longAgo = new Date(now - 31 * 60 * 1000).toISOString()
    expect(isSubscriptionDueForCheck(longAgo, now)).toBe(true)
  })

  it("битая дата не блокирует проверку навсегда", () => {
    expect(isSubscriptionDueForCheck("не дата", now)).toBe(true)
  })
})

/* ------------------------------------------------------------------ */
/* Ссылки                                                              */
/* ------------------------------------------------------------------ */

describe("ссылки подписки", () => {
  it("ведёт на страницу тайтла", () => {
    expect(getSubscriptionWatchPath(sub())).toBe("/watch/64510-naruto")
  })
})

describe("deep-link бота", () => {
  it("собирает payload из id", () => {
    expect(buildSubscribeStartPayload("64510")).toBe("sub_64510")
  })

  it("разбирает payload обратно", () => {
    expect(parseSubscribeStartPayload("sub_64510")).toBe("64510")
  })

  it("учитывает лимит Telegram в 64 байта", () => {
    // В start-параметр влезает только короткий id: название тайла туда не
    // поместится, поэтому бот берёт его из Shikimori по id.
    expect(buildSubscribeStartPayload("x".repeat(33))).toBeNull()
    expect(buildSubscribeStartPayload("x".repeat(32))).toBe("sub_" + "x".repeat(32))
  })

  it("игнорирует чужой payload, а не ломается", () => {
    expect(parseSubscribeStartPayload("link")).toBeNull()
    expect(parseSubscribeStartPayload("sub_")).toBeNull()
    expect(parseSubscribeStartPayload(null)).toBeNull()
    expect(parseSubscribeStartPayload(undefined)).toBeNull()
  })

  it("использует стабильный query-параметр", () => {
    expect(SUBSCRIBE_DEEP_LINK_PARAM).toBe("sub")
  })
})

/* ------------------------------------------------------------------ */
/* Намерение гостя                                                     */
/* ------------------------------------------------------------------ */

describe("намерение гостя", () => {
  it("переживает перезагрузку: localStorage, не память", () => {
    rememberPendingSubscription({ animeId: "42", animeTitle: "Наруто", baselineEpisode: 3 })
    const stored = localStorage.getItem(PENDING_SUBSCRIPTIONS_STORAGE_KEY)
    expect(stored).toBeTruthy()

    const read = readPendingSubscriptions()
    expect(read).toHaveLength(1)
    expect(read[0].animeId).toBe("42")
    expect(read[0].baselineEpisode).toBe(3)
  })

  it("повторное нажатие перезаписывает, а не дублирует", () => {
    // Метки времени близки к «сейчас»: с epoch-метками намерение считалось бы
    // протухшим и не попало бы в выборку вообще.
    const now = Date.now()
    rememberPendingSubscription({ animeId: "42", animeTitle: "Старое", ts: now - 1000 })
    rememberPendingSubscription({ animeId: "42", animeTitle: "Новое", ts: now })
    const read = readPendingSubscriptions()
    expect(read).toHaveLength(1)
    expect(read[0].animeTitle).toBe("Новое")
  })

  it("не хранит намерение без id", () => {
    rememberPendingSubscription({ animeId: "", animeTitle: "Пусто" })
    expect(readPendingSubscriptions()).toHaveLength(0)
  })

  it("чистится после сохранения подписки в аккаунт", () => {
    rememberPendingSubscription({ animeId: "42", animeTitle: "Наруто" })
    clearPendingSubscription("42")
    expect(readPendingSubscriptions()).toHaveLength(0)
    // Ключ должен исчезнуть совсем: пустой localStorage — это мусор, который
    // потом приходится разбирать при отладке.
    expect(localStorage.getItem(PENDING_SUBSCRIPTIONS_STORAGE_KEY)).toBeNull()
  })

  it("не убирает чужие намерения", () => {
    rememberPendingSubscription({ animeId: "42", animeTitle: "Наруто" })
    rememberPendingSubscription({ animeId: "43", animeTitle: "Блич" })
    clearPendingSubscription("42")
    expect(readPendingSubscriptions().map((i) => i.animeId)).toEqual(["43"])
  })

  it("протухшие намерения не достаются и вычищаются", () => {
    const stale = Date.now() - PENDING_SUBSCRIPTION_TTL_MS - 1000
    rememberPendingSubscription({ animeId: "old", animeTitle: "Старый", ts: stale })
    rememberPendingSubscription({ animeId: "fresh", animeTitle: "Свежий" })

    const read = readPendingSubscriptions()
    expect(read.map((i) => i.animeId)).toEqual(["fresh"])
    expect(JSON.parse(localStorage.getItem(PENDING_SUBSCRIPTIONS_STORAGE_KEY)!)).toEqual({
      fresh: expect.objectContaining({ animeId: "fresh" }),
    })
  })

  it("битый JSON не ломает чтение", () => {
    localStorage.setItem(PENDING_SUBSCRIPTIONS_STORAGE_KEY, "{ не json")
    expect(readPendingSubscriptions()).toHaveLength(0)

    localStorage.setItem(PENDING_SUBSCRIPTIONS_STORAGE_KEY, "[1,2,3]")
    expect(readPendingSubscriptions()).toHaveLength(0)
  })

  it("свежие намерения важнее старых, лимит соблюдается", () => {
    const old = Date.now() - PENDING_SUBSCRIPTION_TTL_MS / 2
    for (let i = 0; i < PENDING_SUBSCRIPTIONS_LIMIT + 5; i++) {
      rememberPendingSubscription({ animeId: `id-${i}`, animeTitle: `T${i}`, ts: old + i })
    }
    const read = readPendingSubscriptions()
    expect(read).toHaveLength(PENDING_SUBSCRIPTIONS_LIMIT)
    // Первым идёт самое свежее — по нему и подписываемся после входа.
    expect(read[0].animeId).toBe(`id-${PENDING_SUBSCRIPTIONS_LIMIT + 4}`)
  })
})