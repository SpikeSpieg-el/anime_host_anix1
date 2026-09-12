import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/anilibria/api", () => ({
  normalizeTitleForMatch: (value: string) =>
    value.toLowerCase().replaceAll("ё", "е").replace(/[^\p{L}\p{N}]+/gu, " ").trim(),
  findAniLibriaPlayback: vi.fn(),
  getAniLibriaTorrentDownloadUrl: (torrent: { torrent_id: number }) =>
    `https://www.anilibria.tv/public/torrent/download.php?id=${torrent.torrent_id}`,
}))

vi.mock("@/lib/animdl/allanime", () => ({
  findShowForEpisode: vi.fn(),
  fetchAllAnimeEpisodeSources: vi.fn(),
}))

import { findAniLibriaPlayback } from "@/lib/anilibria/api"
import { fetchAllAnimeEpisodeSources, findShowForEpisode } from "@/lib/animdl/allanime"
import {
  buildAnimdlCliCommand,
  formatBytes,
  resolveEpisodeSources,
  sanitizeFilename,
} from "@/lib/animdl/resolve"

const mockPlayback = vi.mocked(findAniLibriaPlayback)
const mockFindShow = vi.mocked(findShowForEpisode)
const mockEpisodeSources = vi.mocked(fetchAllAnimeEpisodeSources)

// Уникальные названия на каждый тест — резолвер кеширует результаты в памяти.
let testRun = 0

beforeEach(() => {
  testRun += 1
  vi.clearAllMocks()
})

describe("цепочка источников", () => {
  it("AniLibria (русская озвучка) имеет приоритет над AllAnime", async () => {
    const title = `Уникальный тайтл ${testRun}-a`
    mockPlayback.mockResolvedValue({
      titleId: 1,
      code: "unique",
      title: "Уникальный тайтл",
      qualities: [{ label: "720p", url: "https://cache.libria.fun/video.m3u8" }],
      torrents: [
        {
          torrent_id: 10,
          hash: "hash",
          leechers: 1,
          seeders: 5,
          downloads: 10,
          total_size: 1_500_000_000,
          quality: { string: "BDRip 1080p", code: "BDRip" },
          series: { string: "1-12" },
          uploaded_timestamp: 0,
          magnet: "magnet:?xt=urn:btih:hash",
        },
      ],
    })

    const result = await resolveEpisodeSources({ title, episode: 3 })

    expect(result?.provider).toBe("anilibria")
    expect(result?.ruDub).toBe(true)
    expect(result?.qualities[0]).toMatchObject({
      label: "720p",
      kind: "hls",
      url: "https://cache.libria.fun/video.m3u8",
      referer: "https://www.anilibria.tv/",
    })
    expect(result?.torrents[0].quality).toBe("BDRip 1080p")
    expect(result?.torrents[0].torrentUrl).toContain("download.php?id=10")
    expect(mockFindShow).not.toHaveBeenCalled()
  })

  it("если AniLibрия не нашлась — берёт AllAnime dub, затем sub", async () => {
    const title = `Только сабы ${testRun}-b`
    mockPlayback.mockResolvedValue(null)
    mockFindShow
      .mockResolvedValueOnce(null) // dub — ничего
      .mockResolvedValueOnce({
        _id: "show1",
        name: "Subs Only",
        availableEpisodesDetail: { sub: ["1"] },
      })
    mockEpisodeSources.mockResolvedValueOnce({
      episodeString: "1",
      notes: null,
      sources: [
        {
          sourceName: "Default",
          kind: "hls",
          url: "https://playtaku.example/ep.m3u8",
          subtitles: [{ lang: "en", label: "English", url: "https://static.example/en.vtt" }],
          priority: 1,
        },
      ],
    })

    const result = await resolveEpisodeSources({
      title,
      originalTitle: "Subs Only: The Animation",
      episode: 1,
    })

    expect(result?.provider).toBe("allanime")
    expect(result?.ruDub).toBe(false)
    expect(result?.translationType).toBe("sub")
    expect(result?.qualities[0].kind).toBe("hls")
    expect(result?.subtitles).toHaveLength(1)
  })

  it("ничего не находит — возвращает null и кеширует негатив (источники не дёргаются повторно)", async () => {
    const title = `Пустой тайтл ${testRun}-c`
    mockPlayback.mockResolvedValue(null)
    mockFindShow.mockResolvedValue(null)

    const first = await resolveEpisodeSources({ title, episode: 1 })
    const second = await resolveEpisodeSources({ title, episode: 1 })

    expect(first).toBeNull()
    expect(second).toBeNull()
    expect(mockFindShow).toHaveBeenCalledTimes(2) // dub+sub один раз, из кеша второй
  })
})

describe("утилиты", () => {
  it("formatBytes даёт читаемые размеры", () => {
    expect(formatBytes(1_500_000_000)).toBe("1.4 ГБ")
    expect(formatBytes(0)).toBe("")
    expect(formatBytes(1024)).toBe("1 КБ")
  })

  it("sanitizeFilename убирает запрещённые символы", () => {
    expect(sanitizeFilename('Аниме: Серия/1 "финал"?')).toBe("Аниме Серия 1 финал")
  })

  it("buildAnimdlCliCommand строит команду с диапазоном", () => {
    const command = buildAnimdlCliCommand({
      title: "Наруто",
      originalTitle: "Naruto",
      episode: 5,
      rangeEnd: 8,
    })
    expect(command).toBe('animdl download "search:Naruto" -e 5-8 --quality best')

    const single = buildAnimdlCliCommand({ title: "Наруто", episode: 3 })
    expect(single).toContain('"search:Наруто"')
    expect(single).toContain("-e 3")
  })
})
