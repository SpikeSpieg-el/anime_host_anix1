import { describe, expect, it } from "vitest"
import { isHentaiContent } from "@/lib/hentai-detector"
import { makeAnime } from "../../fixtures/anime"

describe("isHentaiContent", () => {
  it("returns false for regular anime", () => {
    expect(isHentaiContent(makeAnime())).toBe(false)
  })

  it("detects rx / r+ / r18 / 18+ ratings", () => {
    for (const rating of ["rx", "R+", "r18", "18+"]) {
      expect(isHentaiContent(makeAnime({ rating: rating as any }))).toBe(true)
    }
  })

  it("detects hentai genre (en/ru)", () => {
    expect(isHentaiContent(makeAnime({ genres: ["Hentai"] }))).toBe(true)
    expect(isHentaiContent(makeAnime({ genres: ["хентай"] }))).toBe(true)
  })

  it("detects keyword in title or description", () => {
    expect(isHentaiContent(makeAnime({ title: "Some Hentai Title" }))).toBe(true)
    expect(isHentaiContent(makeAnime({ description: "это хентай тайтл" }))).toBe(true)
  })

  it("flags special test id 10851", () => {
    expect(isHentaiContent(makeAnime({ id: "10851" }))).toBe(true)
  })

  it("does not flag parody / ecchi-only titles without markers", () => {
    expect(isHentaiContent(makeAnime({ genres: ["Пародия", "Этти"], rating: "pg-13" as any }))).toBe(false)
  })
})
