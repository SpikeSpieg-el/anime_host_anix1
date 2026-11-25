import { describe, expect, it } from "vitest"
import {
  buildSearchNotice,
  extractSeasonFromTitle,
  parseAnimeQuery,
  scoreSearchCandidate,
  stemSearchToken,
} from "@/lib/shikimori/smart-search"
import { makeShikimoriAnime } from "../../fixtures/anime"

describe("smart anime search query parsing", () => {
  it("separates the Tokyo Revengers title from the requested fourth season", () => {
    const parsed = parseAnimeQuery("токийские мстители 4 сезон")
    expect(parsed.season).toBe(4)
    expect(parsed.tokens).toEqual(expect.arrayContaining(["токийские", "мстители"]))
    expect(parsed.title).not.toContain("4")
    expect(buildSearchNotice("токийские мстители 4 сезон")).toContain("4 сезон")
  })

  it("recognizes season phrases and ordinal forms", () => {
    expect(parseAnimeQuery("Attack on Titan season 4").season).toBe(4)
    expect(parseAnimeQuery("наруто второй сезон").season).toBe(2)
    expect(extractSeasonFromTitle("Tokyo Revengers: Season 2")).toBe(2)
  })

  it("stems Russian inflections without erasing the searchable prefix", () => {
    expect(stemSearchToken("мстители")).toBe("мстител")
    expect(stemSearchToken("токийские")).toBe("токийск")
  })

  it("ranks the requested franchise season above the original season", () => {
    const parsed = parseAnimeQuery("токийские мстители 4 сезон")
    const first = makeShikimoriAnime({ id: 1, russian: "Токийские мстители", name: "Tokyo Revengers" })
    const fourth = makeShikimoriAnime({ id: 4, russian: "Токийские мстители: Четвёртый сезон", name: "Tokyo Revengers Season 4" })
    const knownSeasons = new Map([["1", 1], ["4", 4]])
    expect(scoreSearchCandidate(fourth, { parsed, knownSeasons })).toBeGreaterThan(
      scoreSearchCandidate(first, { parsed, knownSeasons }),
    )
  })
})
