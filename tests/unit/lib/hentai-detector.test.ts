import { describe, expect, it } from "vitest"
import { isHentaiContent } from "@/lib/hentai-detector"
import { makeAnime } from "../../fixtures/anime"

describe("isHentaiContent", () => {
  it("returns false for regular anime", () => {
    expect(isHentaiContent(makeAnime())).toBe(false)
  })

  it("detects rx / r18 / 18+ ratings", () => {
    for (const rating of ["rx", "r18", "18+"]) {
      expect(isHentaiContent(makeAnime({ rating: rating as any }))).toBe(true)
    }
  })

  it("detects hentai genre (en/ru)", () => {
    expect(isHentaiContent(makeAnime({ genres: ["Hentai"] }))).toBe(true)
    expect(isHentaiContent(makeAnime({ genres: ["хентай"] }))).toBe(true)
    expect(isHentaiContent(makeAnime({ genres: ["Эротика"] }))).toBe(true)
    expect(isHentaiContent(makeAnime({ genres: ["Додзинси"] }))).toBe(true)
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

  // --- Регрессы: не-хентай уходил в хентай-плеер ---

  // Репорт: https://weeb-x.com/watch/61578-dazhe-u-studsoveta-est-kosyaki
  // «Даже у студсовета есть косяки!» (Seitokai ni mo Ana wa Aru) — рейтинг r_plus.
  // r_plus = этти, а не хентай, поэтому тайтл должен идти в обычный Kodik-плеер.
  it("НЕ считает хентаем рейтинг r_plus", () => {
    expect(isHentaiContent(makeAnime({ shikimoriRating: "r_plus", isNsfw: true, isHentai: false }))).toBe(false)
    expect(isHentaiContent(makeAnime({ shikimoriRating: "r_plus", isNsfw: true }))).toBe(false)
  })

  // anime.isNsfw — широкий флаг (rx + r_plus + хентай-жанры). Раньше он
  // возвращал true в самом начале функции и ломал выбор плеера для этти.
  it("НЕ использует anime.isNsfw как признак хентая", () => {
    expect(isHentaiContent(makeAnime({ isNsfw: true }))).toBe(false)
  })

  // 33/34 в Shikimori — «Яой» и «Юри». Раньше они были в списке хентай-жанров,
  // поэтому любой яой/юри-тайтл получал хентай-плеер.
  it("НЕ считает хентаем яой и юри", () => {
    expect(isHentaiContent(makeAnime({ genres: ["Яой"], isNsfw: true }))).toBe(false)
    expect(isHentaiContent(makeAnime({ genres: ["Юри"], isNsfw: true }))).toBe(false)
  })

  // Строгий флаг из transformAnime — главный источник истины.
  it("уважает явный флаг isHentai из transformAnime", () => {
    expect(isHentaiContent(makeAnime({ isHentai: true }))).toBe(true)
    // даже если прочие эвристики не сработали (пустые жанры, без рейтинга)
    expect(isHentaiContent(makeAnime({ id: "99999", genres: [], isHentai: true }))).toBe(true)
    // и наоборот: r_plus с isHentai=false остаётся не-хентаем
    expect(isHentaiContent(makeAnime({ shikimoriRating: "r_plus", isHentai: false }))).toBe(false)
  })
})
