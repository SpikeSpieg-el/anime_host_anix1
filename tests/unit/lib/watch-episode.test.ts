import { describe, expect, it, vi } from "vitest"
import { refreshWatchAnimeForEpisode } from "@/lib/shikimori/watch-episode"

const anime = (episodesCurrent: number, episodesTotal = 24) => ({ episodesCurrent, episodesTotal })

describe("watch episode links", () => {
  it("refreshes an older cached count before rendering the requested episode", async () => {
    const loadFresh = vi.fn().mockResolvedValue(anime(10))
    const result = await refreshWatchAnimeForEpisode(10, async () => anime(9), loadFresh)
    expect(result?.episodesCurrent).toBe(10)
    expect(loadFresh).toHaveBeenCalledOnce()
  })

  it.each([undefined, 0, -1, NaN, 9, 1])("does not refetch for an invalid or already known episode %s", async episode => {
    const loadFresh = vi.fn()
    expect(await refreshWatchAnimeForEpisode(episode, async () => anime(9), loadFresh)).toEqual(anime(9))
    expect(loadFresh).not.toHaveBeenCalled()
  })

  it("does not trust the URL when a fresh count still has no such episode", async () => {
    expect(await refreshWatchAnimeForEpisode(10, async () => anime(9), async () => anime(9))).toEqual(anime(9))
  })

  it("retains cached data if the refresh fails or returns null", async () => {
    expect(await refreshWatchAnimeForEpisode(10, async () => anime(9), async () => null)).toEqual(anime(9))
    expect(await refreshWatchAnimeForEpisode(10, async () => anime(9), async () => { throw Error("offline") })).toEqual(anime(9))
  })

  it("does not refresh a missing title", async () => {
    const loadFresh = vi.fn()
    expect(await refreshWatchAnimeForEpisode(10, async () => null, loadFresh)).toBeNull()
    expect(loadFresh).not.toHaveBeenCalled()
  })
})
