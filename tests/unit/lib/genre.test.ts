import { describe, expect, it, beforeEach } from "vitest"
import { GenreCache } from "@/lib/genre-cache"
import { GenreFallbackService } from "@/lib/genre-fallback"

describe("GenreCache", () => {
  beforeEach(() => {
    GenreCache.clear()
  })

  it("returns null for missing keys", () => {
    expect(GenreCache.get("nope")).toBeNull()
  })

  it("stores and retrieves genres", () => {
    GenreCache.set("naruto", ["Сёнэн", "Экшен"])
    expect(GenreCache.get("naruto")).toEqual(["Сёнэн", "Экшен"])
  })

  it("clear wipes all entries", () => {
    GenreCache.set("a", ["x"])
    GenreCache.clear()
    expect(GenreCache.get("a")).toBeNull()
  })
})

describe("GenreFallbackService.extractGenresFromDescription", () => {
  it("returns empty for blank description", () => {
    expect(GenreFallbackService.extractGenresFromDescription("")).toEqual([])
  })

  it("extracts known russian keywords and capitalizes them", () => {
    const genres = GenreFallbackService.extractGenresFromDescription(
      "Это экшен и комедия про школа и исекай",
    )
    expect(genres).toEqual(expect.arrayContaining(["Экшен", "Комедия", "Школа", "Исекай"]))
  })

  it("deduplicates", () => {
    const genres = GenreFallbackService.extractGenresFromDescription("драма драма драма")
    expect(genres.filter((g) => g.toLowerCase() === "драма")).toHaveLength(1)
  })
})

describe("GenreFallbackService.getFallbackGenresSync", () => {
  beforeEach(() => GenreCache.clear())

  it("returns cached value when present", () => {
    GenreCache.set("Title-", ["Фэнтези"])
    expect(GenreFallbackService.getFallbackGenresSync("Title")).toEqual(["Фэнтези"])
  })

  it("falls back to description extraction", () => {
    const result = GenreFallbackService.getFallbackGenresSync("X", undefined, "романтика и спорт")
    expect(result).toEqual(expect.arrayContaining(["Романтика", "Спорт"]))
  })
})
