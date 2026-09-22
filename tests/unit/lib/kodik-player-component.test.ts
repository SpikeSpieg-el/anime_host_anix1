/**
 * Интеграционные проверки самого компонента KodikPlayer:
 * плашка «Следующая серия» не должна появляться в начале видео
 * и не должна вести на серию, которой нет.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, createElement, type ComponentProps } from "react"
import { createRoot, type Root } from "react-dom/client"
import { KodikPlayer } from "@/components/watch/kodik-player"

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type PlayerProps = Partial<ComponentProps<typeof KodikPlayer>> & {
  shikimoriId: string
  title: string
}

interface MountResult {
  container: HTMLDivElement
  root: Root
  onEpisodeChange: ReturnType<typeof vi.fn>
  onEpisodeUnavailable: ReturnType<typeof vi.fn>
}

function makeTranslation(overrides: Record<string, unknown> = {}) {
  return {
    id: "material-1",
    translationId: "640",
    title: "AniLibria",
    type: "voice",
    quality: "720p",
    episodesCount: 12,
    playerLink: "//kodikplayer.com/serial/1/hash/720p",
    seasons: {
      "1": {
        episodes: Object.fromEntries(
          Array.from({ length: 12 }, (_, i) => [String(i + 1), `//link/${i + 1}`])
        ),
      },
    },
    ...overrides,
  }
}

function stubFetch(translations: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes("/api/kodik/translations")) {
        return { ok: true, status: 200, json: async () => ({ translations }) }
      }
      return { ok: false, status: 500, json: async () => ({}) }
    })
  )
}

async function mountPlayer(props: PlayerProps): Promise<MountResult> {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)
  const onEpisodeChange = vi.fn()
  const onEpisodeUnavailable = vi.fn()

  await act(async () => {
    root.render(
      createElement(KodikPlayer, {
        poster: "",
        episode: 1,
        onEpisodeChange,
        onEpisodeUnavailable,
        ...props,
      } as ComponentProps<typeof KodikPlayer>)
    )
  })

  return { container, root, onEpisodeChange, onEpisodeUnavailable }
}

function clickButton(container: HTMLElement, textPart: string) {
  const button = Array.from(container.querySelectorAll("button")).find((el) =>
    (el.textContent || "").includes(textPart)
  )
  if (!button) throw new Error(`Не найдена кнопка «${textPart}»`)
  act(() => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }))
  })
  return button
}

function postFromPlayer(container: HTMLElement, data: unknown) {
  const frame = container.querySelector("iframe") as HTMLIFrameElement | null
  act(() => {
    window.dispatchEvent(
      new MessageEvent("message", { data, source: frame?.contentWindow ?? null })
    )
  })
}

/** Прогоняем плеер до заданной секунды (имитация timeupdate-событий Kodik). */
function seekTo(container: HTMLElement, seconds: number, duration: number) {
  postFromPlayer(container, { key: "kodik_player_init", value: { duration } })
  for (let sec = 0; sec <= seconds; sec += 60) {
    postFromPlayer(container, { key: "kodik_player_timeupdate", value: { seconds: sec, duration } })
  }
  postFromPlayer(container, { key: "kodik_player_timeupdate", value: { seconds, duration } })
}

function nextEpisodeCard(container: HTMLElement): HTMLElement | null {
  return Array.from(container.querySelectorAll("div")).find(
    (el) => (el.textContent || "").includes("Следующая серия") && el.className.includes("z-40")
  ) ?? null
}

describe("KodikPlayer: плашка «Следующая серия»", () => {
  let mounted: MountResult | null = null

  beforeEach(() => {
    stubFetch([makeTranslation()])
  })

  afterEach(async () => {
    if (mounted) {
      await act(async () => {
        mounted?.root.unmount()
      })
      mounted.container.remove()
      mounted = null
    }
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("не появляется в начале серии, даже если плеер шлёт ended (преролл)", async () => {
    mounted = await mountPlayer({ shikimoriId: "21", title: "One Piece", episode: 1, maxEpisode: 12 })
    clickButton(mounted.container, "Смотреть 1 серию")

    // Рекламный ролик закончился до начала серии: ended без времени серии
    postFromPlayer(mounted.container, { key: "kodik_player_init", value: { duration: 1440 } })
    postFromPlayer(mounted.container, { key: "kodik_player_ad_ended", value: {} })
    postFromPlayer(mounted.container, { key: "kodik_player_video_ended", value: {} })

    expect(mounted.container.textContent).not.toContain("Следующая серия")
    expect(mounted.onEpisodeChange).not.toHaveBeenCalled()
  })

  it("ended от преролла не «всплывает» позже, когда серия уже идёт", async () => {
    mounted = await mountPlayer({ shikimoriId: "21", title: "One Piece", episode: 1, maxEpisode: 12 })
    clickButton(mounted.container, "Смотреть 1 серию")

    postFromPlayer(mounted.container, { key: "kodik_player_init", value: { duration: 1440 } })
    postFromPlayer(mounted.container, { key: "kodik_player_video_ended", value: {} })
    // Серия пошла с начала
    seekTo(mounted.container, 720, 1440)

    expect(mounted.container.textContent).not.toContain("Следующая серия")
    expect(mounted.onEpisodeChange).not.toHaveBeenCalled()
  })

  it("показывается по ended, даже если плеер не присылает время серии", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const base = Date.now()

    mounted = await mountPlayer({ shikimoriId: "21", title: "One Piece", episode: 4, maxEpisode: 12 })
    clickButton(mounted.container, "Смотреть 4 серию")

    // Плеер молчит про время — сразу после старта ended принимать нельзя
    postFromPlayer(mounted.container, { key: "kodik_player_video_ended", value: {} })
    expect(nextEpisodeCard(mounted.container)).toBeNull()

    // Прошло 2 минуты просмотра — это уже похоже на конец серии
    vi.setSystemTime(base + 120_000)
    postFromPlayer(mounted.container, { key: "kodik_player_video_ended", value: {} })
    expect(nextEpisodeCard(mounted.container)).not.toBeNull()
  })

  it("не реагирует на ended из чужого окна (рекламный iframe)", async () => {
    mounted = await mountPlayer({ shikimoriId: "21", title: "One Piece", episode: 1, maxEpisode: 12 })
    clickButton(mounted.container, "Смотреть 1 серию")

    seekTo(mounted.container, 1300, 1440)
    expect(nextEpisodeCard(mounted.container)).toBeNull()

    // Сообщение не из окна плеера — плеер его видеть не должен
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", { data: { key: "kodik_player_video_ended", value: { seconds: 1300 } }, source: null })
      )
    })
    expect(nextEpisodeCard(mounted.container)).toBeNull()
  })

  it("не появляется в середине серии", async () => {
    mounted = await mountPlayer({ shikimoriId: "21", title: "One Piece", episode: 1, maxEpisode: 12 })
    clickButton(mounted.container, "Смотреть 1 серию")

    seekTo(mounted.container, 720, 1440)

    expect(mounted.container.textContent).not.toContain("Следующая серия")
  })

  it("появляется в конце серии и переключает на следующую", async () => {
    mounted = await mountPlayer({ shikimoriId: "21", title: "One Piece", episode: 1, maxEpisode: 12 })
    clickButton(mounted.container, "Смотреть 1 серию")

    seekTo(mounted.container, 1400, 1440)

    expect(nextEpisodeCard(mounted.container)).not.toBeNull()
    clickButton(mounted.container, "Следующая серия")
    expect(mounted.onEpisodeChange).toHaveBeenCalledWith(2)
  })

  it("скрывается после перемотки назад", async () => {
    mounted = await mountPlayer({ shikimoriId: "21", title: "One Piece", episode: 1, maxEpisode: 12 })
    clickButton(mounted.container, "Смотреть 1 серию")

    seekTo(mounted.container, 1400, 1440)
    expect(nextEpisodeCard(mounted.container)).not.toBeNull()

    postFromPlayer(mounted.container, { key: "kodik_player_timeupdate", value: { seconds: 300, duration: 1440 } })
    expect(nextEpisodeCard(mounted.container)).toBeNull()
  })

  it("не предлагает серию, которой нет в озвучке (в Shikimori 12, в озвучке 5)", async () => {
    stubFetch([makeTranslation({ episodesCount: 5, seasons: {
      "1": { episodes: { "1": "//l/1", "2": "//l/2", "3": "//l/3", "4": "//l/4", "5": "//l/5" } },
    } })])

    mounted = await mountPlayer({ shikimoriId: "21", title: "One Piece", episode: 5, maxEpisode: 12 })
    clickButton(mounted.container, "Смотреть 5 серию")

    seekTo(mounted.container, 1400, 1440)

    expect(mounted.container.textContent).not.toContain("Следующая серия")
    expect(mounted.container.textContent).toContain("последняя доступная")
    expect(mounted.onEpisodeChange).not.toHaveBeenCalled()
  })

  it("предлагает другую озвучку, если в текущей следующей серии нет", async () => {
    stubFetch([
      makeTranslation({
        translationId: "640",
        title: "AniLibria",
        episodesCount: 5,
        seasons: { "1": { episodes: { "1": "//l/1", "2": "//l/2", "3": "//l/3", "4": "//l/4", "5": "//l/5" } } },
      }),
      makeTranslation({ id: "material-2", translationId: "641", title: "Anidub", episodesCount: 12 }),
    ])

    mounted = await mountPlayer({ shikimoriId: "21", title: "One Piece", episode: 5, maxEpisode: 12 })
    clickButton(mounted.container, "Смотреть 5 серию")

    seekTo(mounted.container, 1400, 1440)

    expect(mounted.container.textContent).toContain("Следующая серия")
    expect(mounted.container.textContent).toContain("есть в «Anidub»")

    clickButton(mounted.container, "Следующая серия")
    expect(mounted.onEpisodeChange).toHaveBeenCalledWith(6)
  })

  it("не уходит на серию, которую плеер переключил сам внутри iframe", async () => {
    stubFetch([makeTranslation({ episodesCount: 5, seasons: {
      "1": { episodes: { "1": "//l/1", "2": "//l/2", "3": "//l/3", "4": "//l/4", "5": "//l/5" } },
    } })])

    mounted = await mountPlayer({ shikimoriId: "21", title: "One Piece", episode: 5, maxEpisode: 12 })
    clickButton(mounted.container, "Смотреть 5 серию")

    postFromPlayer(mounted.container, { key: "kodik_player_current_episode", value: { episode: 7 } })

    expect(mounted.onEpisodeChange).not.toHaveBeenCalled()
    expect(mounted.container.textContent).toContain("Серия 7 недоступна")
    expect(mounted.onEpisodeUnavailable).not.toHaveBeenCalled()
  })

  it("принимает переход на серию, которая есть в озвучке", async () => {
    mounted = await mountPlayer({ shikimoriId: "21", title: "One Piece", episode: 3, maxEpisode: 12 })
    clickButton(mounted.container, "Смотреть 3 серию")

    postFromPlayer(mounted.container, { key: "kodik_player_current_episode", value: { episode: 4 } })

    expect(mounted.onEpisodeChange).toHaveBeenCalledWith(4)
  })
})
