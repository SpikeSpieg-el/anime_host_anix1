import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ALLANIME_XOR_KEY,
  decryptAllAnimeUrl,
  fetchAllAnimeEpisodeSources,
  searchAllAnime,
} from "@/lib/animdl/allanime"

/** Шифрование XOR-ом (симметрично дешифровке AllAnime из animdl). */
function xorHex(value: string): string {
  const source = Buffer.from(value, "utf-8")
  const out = Buffer.alloc(source.length)
  for (let i = 0; i < source.length; i++) {
    out[i] = source[i] ^ ALLANIME_XOR_KEY
  }
  return out.toString("hex")
}

const FETCH_RESPONSES: Array<{ match: RegExp; body: unknown }> = []

function stubFetch() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input.toString()
      const entry = FETCH_RESPONSES.find(({ match }) => match.test(url))
      if (!entry) {
        throw new Error(`Unexpected fetch in test: ${url}`)
      }
      return {
        ok: true,
        status: 200,
        text: async () =>
          typeof entry.body === "string" ? entry.body : JSON.stringify(entry.body),
        json: async () => entry.body,
      }
    }),
  )
}

beforeEach(() => {
  FETCH_RESPONSES.length = 0
  stubFetch()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("decryptAllAnimeUrl (XOR-56 как в animdl)", () => {
  it("дешифрует известный вектор", () => {
    // 'hello' -> каждый байт ^ 56 -> hex
    expect(decryptAllAnimeUrl("505d545457")).toBe("hello")
  })

  it("работает симметрично для реальных ссылок", () => {
    const original = "/clockWnZfQ.json?id=42&host=playtaku"
    expect(decryptAllAnimeUrl(xorHex(original))).toBe(original)
  })
})

describe("searchAllAnime", () => {
  it("парсит результаты поиска", async () => {
    FETCH_RESPONSES.push({
      match: /api\.allanime\.day\/api/,
      body: {
        data: {
          shows: {
            pageInfo: { total: 1 },
            edges: [
              {
                _id: "abc123",
                name: "Naruto",
                nativeName: "ナルト",
                availableEpisodesDetail: { sub: ["1", "2"], dub: ["1"] },
              },
            ],
          },
        },
      },
    })

    const shows = await searchAllAnime("Naruto", { translationType: "dub" })
    expect(shows).toHaveLength(1)
    expect(shows[0]._id).toBe("abc123")
    expect(shows[0].availableEpisodesDetail.dub).toEqual(["1"])
  })
})

describe("fetchAllAnimeEpisodeSources", () => {
  it("дешифрует sourceUrl и достаёт mp4/hls/субтитры из clock.json", async () => {
    const clockPath = "/clock-source.json?id=42"
    FETCH_RESPONSES.push({
      // getVersion
      match: /getVersion/,
      body: { episodeIframeHead: "https://allanime.day" },
    })
    FETCH_RESPONSES.push({
      // GQL episode
      match: /api\.allanime\.day\/api/,
      body: {
        data: {
          episode: {
            episodeString: "1",
            notes: null,
            sourceUrls: [
              { sourceName: "Default", sourceUrl: `--${xorHex(clockPath)}`, priority: 1 },
            ],
          },
        },
      },
    })
    FETCH_RESPONSES.push({
      // clock.json
      match: /allanime\.day\/clock\.json\?id=42/,
      body: {
        links: [
          {
            link: "https://playtaku.example/stream/ep1.m3u8",
            subtitles: [{ src: "https://static.example/ru.vtt", lang: "ru", label: "Русские" }],
          },
          {
            rawUrls: {
              audios: [],
              vids: [
                { height: 1080, url: "https://mp4.example/ep1-1080.mp4" },
                { height: 720, url: "https://mp4.example/ep1-720.mp4" },
              ],
            },
          },
        ],
      },
    })

    const info = await fetchAllAnimeEpisodeSources("show-id", 1, "dub")
    expect(info).not.toBeNull()
    expect(info?.sources).toHaveLength(3)

    const mp4s = info?.sources.filter(source => source.kind === "mp4") ?? []
    expect(mp4s.map(source => source.url)).toEqual([
      "https://mp4.example/ep1-1080.mp4",
      "https://mp4.example/ep1-720.mp4",
    ])

    const hls = info?.sources.find(source => source.kind === "hls")
    expect(hls?.url).toBe("https://playtaku.example/stream/ep1.m3u8")
    expect(hls?.subtitles[0].url).toBe("https://static.example/ru.vtt")
    expect(hls?.subtitles[0].lang).toBe("ru")
  })

  it("пропускает embed-страницы и ошибки clock.json", async () => {
    FETCH_RESPONSES.push({
      match: /getVersion/,
      body: { episodeIframeHead: "https://allanime.day" },
    })
    FETCH_RESPONSES.push({
      match: /api\.allanime\.day\/api/,
      body: {
        data: {
          episode: {
            episodeString: "1",
            sourceUrls: [
              { sourceName: "Filemoon", sourceUrl: "https://filemoon.example/embed-abc.html", priority: 2 },
            ],
          },
        },
      },
    })

    const info = await fetchAllAnimeEpisodeSources("show-id", 1, "sub")
    expect(info?.sources).toHaveLength(0)
  })
})
