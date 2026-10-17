/**
 * «Ожидание озвучки» (translation_alerts).
 *
 * Регрессия на главную дыру воронки: плашка «Скоро / Озвучка не найдена»
 * обещала уведомление, но поиск новых серий шёл по закладкам/истории и по
 * episodes_aired из Shikimori. Ожидание должно закрываться ровно тогда, когда
 * нужная серия реально появилась в Kodik, — ни раньше (ложный пуш), ни позже.
 */
import { describe, expect, it } from "vitest"
import {
  ALERT_MIN_RECHECK_INTERVAL_MS,
  PENDING_ALERTS_LIMIT,
  PENDING_ALERT_TTL_MS,
  clearPendingAlert,
  clearPendingAlerts,
  readPendingAlerts,
  rememberPendingAlert,
  ALERTS_CHECK_THROTTLE_MS,
  buildAlertNotification,
  currentDubEpisodes,
  dubEpisodeToWait,
  isAlertDueForRecheck,
  mapAlertRow,
  nextDubEpisode,
  pluralEpisodes,
  pluralEpisodesAccusative,
  resolveTranslationAlert,
  shouldRunAlertsCheck,
  toAlertRow,
  type AlertTranslation,
  type TranslationAlert,
} from "@/lib/translation-alerts"

const seasons = (episodes: number[], season = 1) => ({
  [String(season)]: {
    episodes: Object.fromEntries(episodes.map((ep) => [String(ep), `//link/${ep}`])),
  },
})

const voice = (count: number, overrides: Partial<AlertTranslation> = {}): AlertTranslation => ({
  title: "AniLibria",
  type: "voice",
  episodesCount: count,
  seasons: seasons(Array.from({ length: count }, (_, i) => i + 1)),
  ...overrides,
})

const subtitles = (count: number, overrides: Partial<AlertTranslation> = {}): AlertTranslation => ({
  title: "Subtitles",
  type: "subtitles",
  episodesCount: count,
  seasons: seasons(Array.from({ length: count }, (_, i) => i + 1)),
  ...overrides,
})

const alert = (overrides: Partial<TranslationAlert> = {}): TranslationAlert => ({
  animeId: "64510",
  animeTitle: "Если бы история была мяукающей статьёй",
  poster: null,
  episode: 1,
  baselineEpisode: 0,
  reason: "no-translations",
  ...overrides,
})

describe("resolveTranslationAlert", () => {
  it("не разобрано, пока озвучек нет вовсе", () => {
    const resolution = resolveTranslationAlert(alert(), [])
    expect(resolution.resolved).toBe(false)
    expect(resolution.kind).toBeNull()
    expect(resolution.wantedEpisode).toBe(1)
  })

  it("появилась озвучка с нужной серией — ожидание закрыто", () => {
    const resolution = resolveTranslationAlert(alert(), [voice(5)])
    expect(resolution.resolved).toBe(true)
    expect(resolution.kind).toBe("dub")
    expect(resolution.isVoice).toBe(true)
    expect(resolution.translationTitle).toBe("AniLibria")
    // В колокольчик показываем, сколько серий реально доступно
    expect(resolution.availableEpisode).toBe(5)
    expect(resolution.wantedEpisode).toBe(1)
  })

  it("озвучка есть, но нужной серии в ней ещё нет — ждём дальше", () => {
    const resolution = resolveTranslationAlert(alert({ episode: 7 }), [voice(5)])
    expect(resolution.resolved).toBe(false)
  })

  it("субтитры тоже считаются контентом, но уведомление другое", () => {
    const resolution = resolveTranslationAlert(alert(), [subtitles(3)])
    expect(resolution.resolved).toBe(true)
    expect(resolution.kind).toBe("subtitles")
    expect(resolution.isVoice).toBe(false)
  })

  it("озвучка в приоритете над субтитрами", () => {
    const resolution = resolveTranslationAlert(alert(), [subtitles(12), voice(4, { title: "AniDUB" })])
    expect(resolution.kind).toBe("dub")
    expect(resolution.translationTitle).toBe("AniDUB")
    expect(resolution.availableEpisode).toBe(4)
  })

  it("«серия ещё не вышла» закрывается как новая серия, а не как озвучка", () => {
    const resolution = resolveTranslationAlert(
      alert({ reason: "episode-not-ready", episode: 13, baselineEpisode: 12 }),
      [voice(13)],
    )
    expect(resolution.resolved).toBe(true)
    expect(resolution.kind).toBe("episode")
    expect(resolution.wantedEpisode).toBe(13)
  })

  it("Kodik не отдал границы — ложно не срабатываем", () => {
    const resolution = resolveTranslationAlert(alert(), [{ title: "AniLibria", type: "voice", episodesCount: 0 }])
    expect(resolution.resolved).toBe(false)
  })

  it("мусорный номер серии трактуется как первая", () => {
    const resolution = resolveTranslationAlert(alert({ episode: NaN }), [voice(1)])
    expect(resolution.resolved).toBe(true)
    expect(resolution.wantedEpisode).toBe(1)
  })

  it("availableEpisode никогда не меньше ожидаемой серии", () => {
    // Kodik отдаёт seasons на 12 серий, но episodes_count суммарный — граница 12
    const resolution = resolveTranslationAlert(alert({ episode: 12 }), [voice(12)])
    expect(resolution.availableEpisode).toBeGreaterThanOrEqual(12)
  })
})

describe("buildAlertNotification", () => {
  it("для озвучки обещает озвучку и ведёт на ожидаемую серию", () => {
    const resolution = resolveTranslationAlert(alert(), [voice(5)])
    const notification = buildAlertNotification(alert(), resolution, 12)

    expect(notification.title).toContain("появилась озвучка")
    expect(notification.title).toContain("Если бы история была мяукающей статьёй")
    expect(notification.body).toContain("5 серий")
    // Название конкретной озвучки НЕ называем: уведомление срабатывает, когда
    // серия нашлась хоть в одной озвучке, а озвучек у тайтла бывает несколько.
    expect(notification.body).not.toContain("AniLibria")
    expect(notification.body).toContain("озвучкой")
    // Ссылка — на 1-ю серию (ту, которую пользователь хотел открыть), не на 5-ю
    expect(notification.url.startsWith("/watch/64510-")).toBe(true)
    expect(notification.url.endsWith("?episode=1")).toBe(true)
    expect(notification.tag).toBe("translation-alert:64510")
  })

  it("для субтитров говорит про субтитры", () => {
    const resolution = resolveTranslationAlert(alert(), [subtitles(1)])
    const notification = buildAlertNotification(alert(), resolution)
    expect(notification.title).toContain("субтитры")
    expect(notification.body).toContain("субтитрами")
  })

  it("для новой серии показывает «из N», если известно total", () => {
    const target = alert({ reason: "episode-not-ready", episode: 13, baselineEpisode: 12 })
    const resolution = resolveTranslationAlert(target, [voice(13)])
    const notification = buildAlertNotification(target, resolution, 24)
    expect(notification.title).toContain("новая серия")
    expect(notification.body).toContain("13")
    expect(notification.body).toContain("из 24")
    expect(notification.url).toContain("episode=13")
  })

  it("без названия не падает и даёт осмысленный заголовок", () => {
    const target = alert({ animeTitle: "" })
    const resolution = resolveTranslationAlert(target, [voice(1)])
    const notification = buildAlertNotification(target, resolution)
    expect(notification.title).toContain("Аниме #64510")
    expect(notification.url.startsWith("/watch/64510")).toBe(true)
  })
})

describe("pluralEpisodes", () => {
  it("склоняет числительное", () => {
    expect(pluralEpisodes(1)).toBe("серия")
    expect(pluralEpisodes(2)).toBe("серии")
    expect(pluralEpisodes(5)).toBe("серий")
    expect(pluralEpisodes(11)).toBe("серий")
    expect(pluralEpisodes(12)).toBe("серий")
    expect(pluralEpisodes(21)).toBe("серия")
    expect(pluralEpisodes(22)).toBe("серии")
    expect(pluralEpisodes(100)).toBe("серий")
    expect(pluralEpisodes(101)).toBe("серия")
  })
})

describe("shouldRunAlertsCheck", () => {
  it("без метки — пора", () => {
    expect(shouldRunAlertsCheck(null)).toBe(true)
    expect(shouldRunAlertsCheck(undefined)).toBe(true)
    expect(shouldRunAlertsCheck("мусор")).toBe(true)
  })

  it("свежая метка — ещё рано", () => {
    const now = Date.now()
    expect(shouldRunAlertsCheck(now - 60_000, now)).toBe(false)
    expect(shouldRunAlertsCheck(now - ALERTS_CHECK_THROTTLE_MS + 1000, now)).toBe(false)
  })

  it("старая метка — пора", () => {
    const now = Date.now()
    expect(shouldRunAlertsCheck(now - ALERTS_CHECK_THROTTLE_MS, now)).toBe(true)
    expect(shouldRunAlertsCheck(now - ALERTS_CHECK_THROTTLE_MS - 1, now)).toBe(true)
  })
})

describe("dubEpisodeToWait: ждать или уже нечего", () => {
  it("онгоинг: ждём следующую за тем, что уже есть", () => {
    // Всего по расписанию 13, озвучка отстала до 12.
    expect(dubEpisodeToWait([voice(12)], 13)).toBe(13)
  })

  it("завершённый тайтл, озвучка догнала — ждать нечего", () => {
    // Главный баг: тайтл на 12 серий и закончен, а мы обещали «Ждём 13».
    // Такого ожидания не сойдётся никогда: озвучка не может отстать от
    // того, что уже закончилось.
    expect(dubEpisodeToWait([voice(12)], 12)).toBeNull()
    expect(nextDubEpisode([voice(12)])).toBe(13)
  })

  it("завершённый тайтл, озвучка отстала — ждём ещё", () => {
    // Тайтл на 12 серий, в озвучке 10: догонять есть что.
    expect(dubEpisodeToWait([voice(10)], 12)).toBe(11)
  })

  it("число серий неизвестно — ведём себя как раньше", () => {
    expect(dubEpisodeToWait([voice(5)], null)).toBe(6)
    expect(dubEpisodeToWait([voice(5)], undefined)).toBe(6)
    expect(dubEpisodeToWait([voice(5)], 0)).toBe(6)
  })

  it("озвучек нет вовсе — ждём первую", () => {
    expect(dubEpisodeToWait([], 12)).toBe(1)
    expect(dubEpisodeToWait(null, 12)).toBe(1)
  })

  it("берёт максимум по всем озвучкам", () => {
    expect(dubEpisodeToWait([voice(2), voice(7), voice(4)], 10)).toBe(8)
  })
})

describe("nextDubEpisode: какую серию ждать", () => {
  it("главный случай: три озвучки по 2 серии → ждём третью", () => {
    // Именно этот сценарий описывал пользователь: у тайтла 3 озвучки, ни в
    // одной нет третьей серии. Как только любая догонит — уведомление.
    const translations = [voice(2), voice(2, { title: "Kodik" }), voice(2, { title: "TV" })]
    expect(nextDubEpisode(translations)).toBe(3)
    expect(currentDubEpisodes(translations)).toBe(2)
  })

  it("берёт максимум, а не последнюю озвучку в списке", () => {
    expect(nextDubEpisode([voice(1), voice(5), voice(2)])).toBe(6)
  })

  it("учитывает субтитры наравне с озвучками", () => {
    expect(nextDubEpisode([subtitles(4)])).toBe(5)
  })

  it("озвучек нет вовсе → ждём первую серию", () => {
    expect(nextDubEpisode([])).toBe(1)
    expect(nextDubEpisode(null)).toBe(1)
    expect(nextDubEpisode(undefined)).toBe(1)
    expect(currentDubEpisodes([])).toBe(0)
  })

  it("мусор у провайдера не ломает расчёт", () => {
    const broken = [
      { type: "voice" },
      { type: "voice", seasons: null, episodesCount: null },
      voice(3),
    ] as AlertTranslation[]
    expect(nextDubEpisode(broken)).toBe(4)
  })
})

describe("склонение «серия»", () => {
  it("именительный — для подписей вида «3 серии»", () => {
    expect(pluralEpisodes(1)).toBe("серия")
    expect(pluralEpisodes(3)).toBe("серии")
    expect(pluralEpisodes(5)).toBe("серий")
  })

  it("винительный — для «Ждём 1 серию»", () => {
    // На карточке ожидания стоит «Ждём N серию/серии/серий». С именительным
    // получалось «Ждём 1 серия» — заметная опечатка в самом заметном месте.
    expect(pluralEpisodesAccusative(1)).toBe("серию")
    expect(pluralEpisodesAccusative(2)).toBe("серии")
    expect(pluralEpisodesAccusative(4)).toBe("серии")
    expect(pluralEpisodesAccusative(5)).toBe("серий")
  })

  it("одинаково понимает 11-19 в обоих падежах", () => {
    for (const n of [11, 12, 13, 14, 15, 19]) {
      const nominative = pluralEpisodes(n)
      const accusative = pluralEpisodesAccusative(n)
      // Для 11-14 формы совпадают («серии»), у 15-19 обе «серий».
      expect(accusative).toBe(nominative === "серия" ? "серию" : nominative)
    }
  })

  it("21 серия — одна серия, а не серии", () => {
    expect(pluralEpisodes(21)).toBe("серия")
    expect(pluralEpisodesAccusative(21)).toBe("серию")
    expect(pluralEpisodesAccusative(22)).toBe("серии")
  })

  it("111 серий — не серия: сто одиннадцать", () => {
    // Русский язык здесь спорит с «цифрой на конце»: 111 читается как
    // «сто одиннадцать», поэтому форма «серия» не применяется, хотя
    // mod10 === 1.
    expect(pluralEpisodesAccusative(111)).toBe("серий")
    expect(pluralEpisodesAccusative(112)).toBe("серий")
    // А вот 121 — «сто двадцать одна», единственное число.
    expect(pluralEpisodesAccusative(121)).toBe("серию")
  })
})

describe("закрытие ожидания по любой озвучке", () => {
  it("срабатывает, когда нужная серия появилась ХОТЬ В ОДНОЙ", () => {
    const alert: TranslationAlert = {
      animeId: "1",
      animeTitle: "Тайтл",
      episode: 3,
      baselineEpisode: 2,
      reason: "episode-not-ready",
    }
    // Все три по две — ещё ждём.
    expect(resolveTranslationAlert(alert, [voice(2), voice(2), voice(2)]).resolved).toBe(false)
    // Один догнал — уведомление, даже если он в конце списка и не выбран.
    const grown = [voice(2), voice(2), voice(3, { title: "TV" })]
    expect(resolveTranslationAlert(alert, grown).resolved).toBe(true)
  })
})

describe("buildAlertNotification: текст без названия озвучки", () => {
  const alert: TranslationAlert = {
    animeId: "1",
    animeTitle: "Атака титанов",
    episode: 3,
    baselineEpisode: 2,
    reason: "episode-not-ready",
  }

  it("не называет конкретную озвучку", () => {
    // 'dub-behind' — причина с кнопки «Следить за тайтлом»: человек ждёт
    // озвучку, поэтому уведомление обязано говорить про озвучку, а не
    // «новая серия» (за это отвечает 'episode-not-ready').
    const alert: TranslationAlert = {
      animeId: "1",
      animeTitle: "Атака титанов",
      episode: 3,
      baselineEpisode: 2,
      reason: "dub-behind",
    }
    const resolution = resolveTranslationAlert(alert, [voice(3, { title: "AniLibria" })])

    expect(resolution.resolved).toBe(true)
    expect(resolution.kind).toBe("dub")
    expect(resolution.translationTitle).toBe("AniLibria")

    const notification = buildAlertNotification(alert, resolution, 12)
    // Название в тексте не должно появляться: уведомление срабатывает,
    // когда серия нашлась хоть в одной озвучке, и называть одну — значит
    // заявить, что вышла именно она.
    expect(notification.body).not.toContain("AniLibria")
    expect(notification.body).toContain("озвучкой")
    expect(notification.title).toContain("Атака титанов")
  })

  it("'episode-not-ready' по-прежнему пишет «новая серия»", () => {
    // Обратная совместимость с плашкой в плеере: там человек упёрся в
    // потолок Shikimori и действительно ждёт серию.
    const alert: TranslationAlert = {
      animeId: "1",
      animeTitle: "Атака титанов",
      episode: 3,
      baselineEpisode: 2,
      reason: "episode-not-ready",
    }
    const resolution = resolveTranslationAlert(alert, [voice(3)])
    expect(resolution.kind).toBe("episode")
    expect(buildAlertNotification(alert, resolution, 12).title).toContain("новая серия")
  })
})

describe("isAlertDueForRecheck", () => {
  it("никогда не проверяли — проверяем", () => {
    expect(isAlertDueForRecheck(null)).toBe(true)
    expect(isAlertDueForRecheck(undefined)).toBe(true)
  })

  it("недавняя проверка — пропускаем (экономим Kodik API)", () => {
    const now = Date.now()
    expect(isAlertDueForRecheck(new Date(now - 60_000).toISOString(), now)).toBe(false)
    expect(isAlertDueForRecheck(now - 60_000, now)).toBe(false)
  })

  it("давняя проверка — снова в очередь", () => {
    const now = Date.now()
    const old = new Date(now - ALERT_MIN_RECHECK_INTERVAL_MS - 1).toISOString()
    expect(isAlertDueForRecheck(old, now)).toBe(true)
  })

  it("битая дата не блокирует проверку навсегда", () => {
    expect(isAlertDueForRecheck("не-дата")).toBe(true)
  })
})

describe("mapAlertRow / toAlertRow", () => {
  it("строка БД → модель с дефолтами", () => {
    const mapped = mapAlertRow({
      anime_id: "64510",
      anime_title: null,
      poster: null,
      episode: 0,
      baseline_episode: -5,
      reason: "что-то странное",
    })
    expect(mapped).not.toBeNull()
    expect(mapped?.animeTitle).toBe("Аниме #64510")
    expect(mapped?.episode).toBe(1)
    expect(mapped?.baselineEpisode).toBe(0)
    expect(mapped?.reason).toBe("no-translations")
  })

  it("без anime_id модель не собирается", () => {
    expect(mapAlertRow({ anime_id: "" })).toBeNull()
    expect(mapAlertRow(null)).toBeNull()
    expect(mapAlertRow(undefined)).toBeNull()
  })

  it("reason episode-not-ready сохраняется", () => {
    expect(mapAlertRow({ anime_id: "1", reason: "episode-not-ready" })?.reason).toBe("episode-not-ready")
  })

  it("модель → строка БД без мусора", () => {
    const row = toAlertRow("user-1", alert({ episode: NaN, baselineEpisode: -3 }))
    expect(row.user_id).toBe("user-1")
    expect(row.anime_id).toBe("64510")
    expect(row.episode).toBe(1)
    expect(row.baseline_episode).toBe(0)
    expect(row.reason).toBe("no-translations")
  })
})

describe("отложенное намерение гостя", () => {
  it("запоминается и читается обратно", () => {
    rememberPendingAlert(alert({ episode: 3, baselineEpisode: 2, reason: "episode-not-ready" }))

    const pending = readPendingAlerts()
    expect(pending).toHaveLength(1)
    expect(pending[0].animeId).toBe("64510")
    expect(pending[0].episode).toBe(3)
    expect(pending[0].reason).toBe("episode-not-ready")
  })

  it("повторный клик по тому же тайтлу не плодит записи", () => {
    rememberPendingAlert(alert({ episode: 1 }))
    rememberPendingAlert(alert({ episode: 5 }))
    expect(readPendingAlerts()).toHaveLength(1)
    expect(readPendingAlerts()[0].episode).toBe(5)
  })

  it("протухшее намерение (30 дней) в аккаунт не тащим", () => {
    rememberPendingAlert(alert())
    const future = Date.now() + PENDING_ALERT_TTL_MS + 1000
    expect(readPendingAlerts(future)).toHaveLength(0)
    // и из хранилища оно вычищено
    expect(localStorage.getItem("weebx_pending_translation_alerts")).toBeNull()
  })

  it("clearPendingAlert убирает только свой тайтл", () => {
    rememberPendingAlert(alert({ animeId: "1" }))
    rememberPendingAlert(alert({ animeId: "2" }))
    clearPendingAlert("1")
    expect(readPendingAlerts().map((i) => i.animeId)).toEqual(["2"])
  })

  it("clearPendingAlerts без аргумента чистит всё", () => {
    rememberPendingAlert(alert({ animeId: "1" }))
    rememberPendingAlert(alert({ animeId: "2" }))
    clearPendingAlerts()
    expect(readPendingAlerts()).toHaveLength(0)
  })

  it("мусор в localStorage не роняет чтение", () => {
    localStorage.setItem("weebx_pending_translation_alerts", "{ не json")
    expect(readPendingAlerts()).toHaveLength(0)
    localStorage.setItem("weebx_pending_translation_alerts", "[1,2,3]")
    expect(readPendingAlerts()).toHaveLength(0)
  })

  it("больше лимита не копим — свежие вытесняют старые", () => {
    for (let i = 0; i < PENDING_ALERTS_LIMIT + 5; i++) {
      rememberPendingAlert(alert({ animeId: String(i) }))
    }
    expect(readPendingAlerts().length).toBeLessThanOrEqual(PENDING_ALERTS_LIMIT)
  })
})
