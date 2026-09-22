import { describe, expect, it } from "vitest"
import {
  AUTO_PROMPT_TAIL_SEC,
  extractEndingTimings,
  getMaxEpisodeFromSeasons,
  getTranslationMaxEpisode,
  hasNextEpisode,
  isEndingPromptAllowed,
  isEndingReached,
  isEpisodeAvailableInTranslation,
  isEpisodeMissingFromTranslation,
  isSeekedBackBeforeEnding,
  isVideoEndedEvent,
  MIN_PROMPT_CURRENT_SEC,
  parseSeconds,
  resolveMaxEpisode,
  trustedDuration,
  type KodikSeasonsMap,
} from "@/lib/kodik-player-logic"

const seasons = (map: Record<string, number[]>) =>
  Object.fromEntries(
    Object.entries(map).map(([season, episodes]) => [
      season,
      { episodes: Object.fromEntries(episodes.map((ep) => [String(ep), `//link/${ep}`])) },
    ])
  ) as KodikSeasonsMap

describe("getMaxEpisodeFromSeasons", () => {
  it("считает максимум по единственному сезону", () => {
    expect(getMaxEpisodeFromSeasons(seasons({ "1": [1, 2, 3, 4, 5] }))).toBe(5)
  })

  it("без номера сезона берёт максимум по всем сезонам", () => {
    expect(getMaxEpisodeFromSeasons(seasons({ "1": [1, 2, 3], "2": [1, 2] }))).toBe(3)
  })

  it("с номером сезона берёт максимум именно по нему", () => {
    const map = seasons({ "1": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "2": [1, 2, 3, 4, 5] })
    expect(getMaxEpisodeFromSeasons(map, 2)).toBe(5)
    expect(getMaxEpisodeFromSeasons(map, 1)).toBe(12)
  })

  it("возвращает undefined, если данных о сезонах нет", () => {
    expect(getMaxEpisodeFromSeasons(undefined)).toBeUndefined()
    expect(getMaxEpisodeFromSeasons(null)).toBeUndefined()
    expect(getMaxEpisodeFromSeasons({ "1": { episodes: {} } })).toBeUndefined()
  })
})

describe("getTranslationMaxEpisode", () => {
  it("берёт минимум из seasons и episodes_count", () => {
    // Kodik: seasons на 12 серий, но count суммарный по двум сезонам
    const translation = {
      seasons: seasons({ "1": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], "2": [1, 2, 3] }),
      episodesCount: 15,
    }
    expect(getTranslationMaxEpisode(translation)).toBe(12)
  })

  it("работает только по episodes_count, если seasons не отдали", () => {
    expect(getTranslationMaxEpisode({ episodesCount: 5 })).toBe(5)
  })

  it("работает только по seasons, если episodes_count пустой", () => {
    expect(getTranslationMaxEpisode({ seasons: seasons({ "1": [1, 2, 3] }), episodesCount: 0 })).toBe(3)
  })

  it("ничего не знает — undefined", () => {
    expect(getTranslationMaxEpisode(undefined)).toBeUndefined()
    expect(getTranslationMaxEpisode({ episodesCount: 0 })).toBeUndefined()
  })
})

describe("resolveMaxEpisode", () => {
  it("Shikimori отдаёт 12, а в озвучке 5 — граница 5", () => {
    expect(resolveMaxEpisode({ translationMaxEpisode: 5, siteMaxEpisode: 12 })).toBe(5)
  })

  it("в озвучке больше, чем вышло по Shikimori — граница Shikimori", () => {
    expect(resolveMaxEpisode({ translationMaxEpisode: 24, siteMaxEpisode: 12 })).toBe(12)
  })

  it("берёт единственный известный источник", () => {
    expect(resolveMaxEpisode({ siteMaxEpisode: 12 })).toBe(12)
    expect(resolveMaxEpisode({ translationMaxEpisode: 7 })).toBe(7)
  })

  it("игнорирует нули и мусор", () => {
    expect(resolveMaxEpisode({ translationMaxEpisode: 0, siteMaxEpisode: 12 })).toBe(12)
    expect(resolveMaxEpisode({ translationMaxEpisode: -3, siteMaxEpisode: 0 })).toBeUndefined()
  })

  it("без источников — undefined", () => {
    expect(resolveMaxEpisode({})).toBeUndefined()
  })
})

describe("hasNextEpisode", () => {
  it("есть следующая серия", () => {
    expect(hasNextEpisode(5, 12)).toBe(true)
    expect(hasNextEpisode(11, 12)).toBe(true)
  })

  it("последняя серия", () => {
    expect(hasNextEpisode(12, 12)).toBe(false)
    expect(hasNextEpisode(5, 5)).toBe(false)
    expect(hasNextEpisode(1, 1)).toBe(false)
  })

  it("граница неизвестна — не обещаем серию", () => {
    expect(hasNextEpisode(5, undefined)).toBe(false)
    expect(hasNextEpisode(5, 0)).toBe(false)
  })

  it("мусорный номер текущей серии", () => {
    expect(hasNextEpisode(NaN, 12)).toBe(false)
    expect(hasNextEpisode(0, 12)).toBe(false)
  })
})

describe("isEpisodeAvailableInTranslation / isEpisodeMissingFromTranslation", () => {
  const fiveEpisodes = { seasons: seasons({ "1": [1, 2, 3, 4, 5] }), episodesCount: 5 }

  it("видит доступную и недоступную серии", () => {
    expect(isEpisodeAvailableInTranslation(fiveEpisodes, 5)).toBe(true)
    expect(isEpisodeAvailableInTranslation(fiveEpisodes, 6)).toBe(false)
    expect(isEpisodeMissingFromTranslation(fiveEpisodes, 6)).toBe(true)
    expect(isEpisodeMissingFromTranslation(fiveEpisodes, 5)).toBe(false)
  })

  it("при неизвестной границе серия не считается пропавшей", () => {
    expect(isEpisodeAvailableInTranslation({ episodesCount: 0 }, 6)).toBe(false)
    expect(isEpisodeMissingFromTranslation({ episodesCount: 0 }, 6)).toBe(false)
    expect(isEpisodeMissingFromTranslation(undefined, 6)).toBe(false)
  })
})

describe("isEndingReached — плашка не должна вылезать в начале", () => {
  const episode = { duration: 1440 } // 24 минуты

  it("нет данных о времени воспроизведения — плашки нет", () => {
    expect(isEndingReached({ ...episode, currentSec: null, videoEnded: true })).toBe(false)
    expect(isEndingReached({ currentSec: null })).toBe(false)
  })

  it("ended от преролла в первые секунды — плашки нет", () => {
    expect(isEndingReached({ ...episode, currentSec: 4, videoEnded: true })).toBe(false)
    expect(isEndingReached({ ...episode, currentSec: 30, videoEnded: true })).toBe(false)
  })

  it("кнопка «Пропустить эндинг» в DOM в начале серии — плашки нет", () => {
    expect(isEndingReached({ ...episode, currentSec: 2, domSkipActive: true })).toBe(false)
  })

  it("маркер эндинга не срабатывает в первой половине серии", () => {
    expect(
      isEndingReached({ ...episode, currentSec: 700, endingRange: { start: 1300 } })
    ).toBe(false)
  })

  it("середина серии без сигналов — плашки нет", () => {
    expect(isEndingReached({ ...episode, currentSec: 720 })).toBe(false)
    expect(isEndingReached({ ...episode, currentSec: 1340 })).toBe(false)
  })

  it("последние 90 секунд серии — плашка есть", () => {
    expect(isEndingReached({ ...episode, currentSec: 1440 - AUTO_PROMPT_TAIL_SEC })).toBe(true)
    expect(isEndingReached({ ...episode, currentSec: 1435 })).toBe(true)
  })

  it("ended именно серии — плашка есть", () => {
    expect(isEndingReached({ ...episode, currentSec: 1439, videoEnded: true })).toBe(true)
  })

  it("активная кнопка пропуска эндинга в зоне эндинга — плашка есть", () => {
    expect(isEndingReached({ ...episode, currentSec: 1320, domSkipActive: true })).toBe(true)
  })

  it("дошли до размеченного начала эндинга — плашка есть", () => {
    expect(isEndingReached({ ...episode, currentSec: 1305, endingRange: { start: 1300 } })).toBe(true)
  })

  it("длительность неизвестна — работает только по сигналам", () => {
    expect(isEndingReached({ currentSec: 1300 })).toBe(false)
    expect(isEndingReached({ currentSec: 1300, domSkipActive: true })).toBe(true)
  })

  it("короткая серия (< 5 мин) не показывается по авто-правилу, но показывается по ended", () => {
    const short = { duration: 200, currentSec: 195 }
    expect(isEndingReached(short)).toBe(false)
    expect(isEndingReached({ ...short, videoEnded: true })).toBe(true)
  })

  it("на паузе авто-правило не срабатывает", () => {
    expect(isEndingReached({ ...episode, currentSec: 1400, isPlaying: false })).toBe(false)
    expect(isEndingReached({ ...episode, currentSec: 1400, isPlaying: true })).toBe(true)
  })

  it("без времени серии ended принимается только после минуты просмотра", () => {
    expect(isEndingReached({ currentSec: null, watchedWallSec: 120, videoEnded: true })).toBe(true)
    expect(isEndingReached({ currentSec: null, watchedWallSec: 10, videoEnded: true })).toBe(false)
    expect(isEndingReached({ watchedWallSec: 10, videoEnded: true })).toBe(false)
  })

  it("мусорная длительность (рекламный ролик) не открывает плашку", () => {
    expect(isEndingReached({ duration: 30, currentSec: 29, videoEnded: true })).toBe(false)
    expect(isEndingReached({ duration: 60, currentSec: 59 })).toBe(false)
  })
})

describe("isEndingPromptAllowed", () => {
  it("не раньше 60-й секунды", () => {
    expect(isEndingPromptAllowed({ currentSec: MIN_PROMPT_CURRENT_SEC - 1 })).toBe(false)
    expect(isEndingPromptAllowed({ currentSec: MIN_PROMPT_CURRENT_SEC })).toBe(true)
  })

  it("не раньше 45% серии", () => {
    expect(isEndingPromptAllowed({ currentSec: 647, duration: 1440 })).toBe(false)
    expect(isEndingPromptAllowed({ currentSec: 648, duration: 1440 })).toBe(true)
  })
})

describe("isSeekedBackBeforeEnding", () => {
  it("перемотка назад гасит плашку", () => {
    expect(
      isSeekedBackBeforeEnding({ currentSec: 300, duration: 1440, endingRange: { start: 1300 } })
    ).toBe(true)
    expect(isSeekedBackBeforeEnding({ currentSec: 300, duration: 1440 })).toBe(true)
  })

  it("в зоне эндинга не гасит", () => {
    expect(
      isSeekedBackBeforeEnding({ currentSec: 1310, duration: 1440, endingRange: { start: 1300 } })
    ).toBe(false)
  })

  it("пока реально идёт эндинг (кнопка в DOM) — не гасит", () => {
    expect(
      isSeekedBackBeforeEnding({ currentSec: 300, duration: 1440, domSkipActive: true })
    ).toBe(false)
  })

  it("сбрасывает «ended», оставшийся от преролла", () => {
    expect(
      isSeekedBackBeforeEnding({ currentSec: 300, duration: 1440, videoEnded: true })
    ).toBe(true)
  })

  it("для коротких серий без маркеров не срабатывает", () => {
    expect(isSeekedBackBeforeEnding({ currentSec: 10, duration: 200 })).toBe(false)
  })
})

describe("isVideoEndedEvent", () => {
  it("принимает события конца серии", () => {
    expect(isVideoEndedEvent("kodik_player_video_ended")).toBe(true)
    expect(isVideoEndedEvent("kodik_player_ended")).toBe(true)
    expect(isVideoEndedEvent("ended")).toBe(true)
  })

  it("отклоняет ended от рекламы", () => {
    expect(isVideoEndedEvent("kodik_player_ad_ended")).toBe(false)
    expect(isVideoEndedEvent("kodik_player_ads_ended")).toBe(false)
    expect(isVideoEndedEvent("kodik_player_preroll_ended")).toBe(false)
    expect(isVideoEndedEvent("kodik_player_commercial_ended")).toBe(false)
  })

  it("отклоняет прочие события и не-строки", () => {
    expect(isVideoEndedEvent("kodik_player_video_started")).toBe(false)
    expect(isVideoEndedEvent("kodik_player_paused")).toBe(false)
    expect(isVideoEndedEvent(undefined)).toBe(false)
    expect(isVideoEndedEvent(42)).toBe(false)
  })
})

describe("parseSeconds / trustedDuration", () => {
  it("разбирает секунды и таймкоды", () => {
    expect(parseSeconds(125)).toBe(125)
    expect(parseSeconds("2:05")).toBe(125)
    expect(parseSeconds("0:20:05")).toBe(1205)
    expect(parseSeconds(-5)).toBeUndefined()
    expect(parseSeconds("мусор")).toBeUndefined()
  })

  it("не доверяет коротким длительностям", () => {
    expect(trustedDuration(30)).toBeUndefined()
    expect(trustedDuration(119)).toBeUndefined()
    expect(trustedDuration(120)).toBe(120)
    expect(trustedDuration(null)).toBeUndefined()
  })
})

describe("extractEndingTimings", () => {
  it("берёт прямые поля ending_start/ending_end", () => {
    expect(extractEndingTimings({ ending_start: 1300, ending_end: 1400 })).toEqual({
      start: 1300,
      end: 1400,
    })
  })

  it("берёт skip_buttons.ending", () => {
    expect(extractEndingTimings({ skip_buttons: { ending: { start: "21:40", end: "23:10" } } })).toEqual({
      start: 1300,
      end: 1390,
    })
  })

  it("берёт маркер эндинга из cuepoints и игнорирует опенинг", () => {
    const payload = {
      cuepoints: [
        { title: "Опенинг", time: 90 },
        { title: "Эндинг", time: 1300 },
      ],
    }
    expect(extractEndingTimings(payload)).toEqual({ start: 1300, end: undefined })
  })

  it("игнорирует опенинг целиком", () => {
    expect(extractEndingTimings({ type: "opening", ending_start: 1300 })).toBeNull()
  })
})
