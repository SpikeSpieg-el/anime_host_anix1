import { describe, expect, it } from "vitest"
import {
  ANIME_PACKS,
  getPackById,
  searchPacksByTitle,
  createCustomPack,
  type ShikimoriAnimeResult,
} from "@/lib/gacha-packs"

describe("ANIME_PACKS catalog", () => {
  it("has unique ids and positive prices", () => {
    const ids = ANIME_PACKS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const pack of ANIME_PACKS) {
      expect(pack.price).toBeGreaterThan(0)
      expect(pack.name.length).toBeGreaterThan(0)
    }
  })

  it("year-based packs start empty (filled dynamically)", () => {
    expect(getPackById("main_characters_2000_2010")?.animeIds).toEqual([])
    expect(getPackById("main_characters_2010_2020")?.animeIds).toEqual([])
    expect(getPackById("main_characters_2015_2026")?.animeIds).toEqual([])
  })
})

describe("getPackById / searchPacksByTitle", () => {
  it("finds pack by id", () => {
    expect(getPackById("naruto")?.name).toBe("Naruto")
    expect(getPackById("missing")).toBeUndefined()
  })

  it("returns empty array for blank query", () => {
    expect(searchPacksByTitle("")).toEqual([])
    expect(searchPacksByTitle("   ")).toEqual([])
  })

  it("searches by name, description and id (case-insensitive)", () => {
    expect(searchPacksByTitle("naruto").some((p) => p.id === "naruto")).toBe(true)
    expect(searchPacksByTitle("DEATH").some((p) => p.id === "death_note")).toBe(true)
    expect(searchPacksByTitle("attack_on_titan").length).toBeGreaterThan(0)
    expect(searchPacksByTitle("титанов").some((p) => p.id === "attack_on_titan")).toBe(true)
  })
})

describe("createCustomPack", () => {
  const results: ShikimoriAnimeResult[] = [
    {
      id: 1,
      name: "Cowboy Bebop",
      russian: "Ковбой Бибоп",
      score: 8.8,
      kind: "tv",
      episodes: 26,
      status: "released",
      image: { original: "x.jpg" },
    },
    {
      id: 2,
      name: "Samurai Champloo",
      russian: "Самурай Чамплу",
      score: 8.5,
      kind: "tv",
      episodes: 26,
      status: "released",
      image: { original: "y.jpg" },
    },
  ]

  it("uses russian title of first anime and sums ids", () => {
    const pack = createCustomPack("bebop", results)
    expect(pack.name).toBe("Ковбой Бибоп")
    expect(pack.animeIds).toEqual([1, 2])
    expect(pack.isCustom).toBe(true)
    expect(pack.searchQuery).toBe("bebop")
  })

  it("price = 2000 + floor(avgScore * 100) capped at +1000", () => {
    const pack = createCustomPack("q", results)
    const avg = (8.8 + 8.5) / 2
    expect(pack.price).toBe(2000 + Math.floor(avg * 100))
  })

  it("assigns guaranteed rarity from average score", () => {
    expect(createCustomPack("q", results).guaranteedRarity).toBe("epic")
    const mid = createCustomPack("q", [{ ...results[0], score: 7.6 }])
    expect(mid.guaranteedRarity).toBe("super_rare")
    const low = createCustomPack("q", [{ ...results[0], score: 6.6 }])
    expect(low.guaranteedRarity).toBe("rare")
    const none = createCustomPack("q", [{ ...results[0], score: 5 }])
    expect(none.guaranteedRarity).toBeUndefined()
  })

  it("handles missing scores", () => {
    const pack = createCustomPack("empty", [{ ...results[0], score: null }])
    expect(pack.price).toBe(2000)
    expect(pack.name).toBe("Ковбой Бибоп")
  })
})
