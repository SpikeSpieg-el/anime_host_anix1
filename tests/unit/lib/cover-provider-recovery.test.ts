/**
 * Регрессия восстановления обложки Steel Ball Run (Shikimori id 61469).
 *
 * /watch приезжает с data:-заглушкой и догоняет настоящую обложку через
 * /api/posters + CoverProvider. Два условия, без которых догон не работает:
 * заглушку нельзя кэшировать на 7 дней и forgetPoster должен инвалидировать
 * кэш синхронно — onError вызывает forgetPoster и сразу же getPoster, когда
 * setCache ещё не перерисовал компонент.
 */
import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CoverProvider, useCover } from "@/components/providers/cover-provider"

const SBR_ID = "61469"
const SBR_COVER = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx190327-riJNCFL7w9y4.jpg"
const FALLBACK = "/api/fallback-poster?title=Steel%20Ball%20Run"

let root: Root
let host: HTMLDivElement
let cover: ReturnType<typeof useCover>

function Consumer() {
  cover = useCover()
  return null
}

async function mount() {
  await act(async () => {
    root.render(createElement(CoverProvider, null, createElement(Consumer)))
  })
}

function stubPosterResponse(...posters: string[]) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({ posters: [{ id: SBR_ID, poster: posters.shift() || FALLBACK }] }),
  }))
  vi.stubGlobal("fetch", fetchMock)
  return fetchMock
}

beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  window.localStorage.clear()
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})

afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

describe("CoverProvider / восстановление постера", () => {
  it("не закрепляет /api/fallback-poster в кэше: следующий заход снова спрашивает API", async () => {
    const fetchMock = stubPosterResponse(FALLBACK, SBR_COVER)
    await mount()

    let first = ""
    await act(async () => {
      first = await cover.getPoster(SBR_ID, "", "Steel Ball Run: JoJo no Kimyou na Bouken", "Гонка «Стальной шар»", false, true)
    })
    expect(first).toBe(FALLBACK)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    let second = ""
    await act(async () => {
      second = await cover.getPoster(SBR_ID, "", "Steel Ball Run: JoJo no Kimyou na Bouken", "Гонка «Стальной шар»", false, true)
    })
    expect(second).toBe(SBR_COVER)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("forgetPoster забывает битую обложку до следующего рендера", async () => {
    const fetchMock = stubPosterResponse(SBR_COVER, "https://s4.anilist.co/other.jpg")
    await mount()

    let first = ""
    await act(async () => {
      first = await cover.getPoster(SBR_ID, "", "Steel Ball Run", "Гонка «Стальной шар»", false, true)
    })
    expect(first).toBe(SBR_COVER)

    // onError в WatchPageClient: forgetPoster + повторный getPoster в одном
    // обработчике. getPoster здесь ещё видит старое замыкание `cache`.
    const staleGetPoster = cover.getPoster
    act(() => cover.forgetPoster(SBR_ID))

    let second = ""
    await act(async () => {
      second = await staleGetPoster(SBR_ID, "", "Steel Ball Run", "Гонка «Стальной шар»", false, true)
    })
    expect(second).toBe("https://s4.anilist.co/other.jpg")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("передаёт excludeShikimori в /api/posters, чтобы missing_original.jpg не вернулся", async () => {
    const fetchMock = stubPosterResponse(SBR_COVER)
    await mount()

    await act(async () => {
      await cover.getPoster(SBR_ID, "", "Steel Ball Run", "Гонка «Стальной шар»", false, true)
    })

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.animes[0]).toMatchObject({
      id: SBR_ID,
      shikimoriUrl: "",
      excludeShikimori: true,
    })
  })
})
