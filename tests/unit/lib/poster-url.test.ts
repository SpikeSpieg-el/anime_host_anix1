/**
 * Steel Ball Run (Shikimori id 61469): в API лежит
 * /assets/globals/missing_original.jpg, поэтому /watch получает data:-заглушку.
 * Такую обложку надо не «лечить проксированием», а подменить настоящей через
 * CoverProvider → /api/posters.
 */
import { describe, expect, it } from "vitest"
import { isPlaceholderPoster, shouldRecoverPoster } from "@/lib/poster-url"

const SBR_MISSING = "https://shikimori.one/assets/globals/missing_original.jpg"
const SBR_REAL_COVER = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx190327-riJNCFL7w9y4.jpg"
const GENERATED = `data:image/svg+xml;base64,${Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>").toString("base64")}`

describe("isPlaceholderPoster", () => {
  it("считает заглушкой пустоту, сгенерированный SVG и /api/fallback-poster", () => {
    expect(isPlaceholderPoster(undefined)).toBe(true)
    expect(isPlaceholderPoster(null)).toBe(true)
    expect(isPlaceholderPoster("")).toBe(true)
    expect(isPlaceholderPoster(GENERATED)).toBe(true)
    expect(isPlaceholderPoster("/api/fallback-poster?title=Steel%20Ball%20Run")).toBe(true)
  })

  it("ловит реальный ответ Shikimori для Steel Ball Run", () => {
    expect(isPlaceholderPoster(SBR_MISSING)).toBe(true)
    expect(isPlaceholderPoster("/assets/globals/missing_x96.jpg")).toBe(true)
    expect(isPlaceholderPoster("https://cdn.example.com/placeholder.png")).toBe(true)
  })

  it("не трогает настоящие обложки", () => {
    expect(isPlaceholderPoster(SBR_REAL_COVER)).toBe(false)
    expect(isPlaceholderPoster("https://shikimori.one/system/animes/original/16498.jpg?1711973439")).toBe(false)
    expect(isPlaceholderPoster("https://xyz.supabase.co/storage/v1/object/public/avatars/a.png")).toBe(false)
  })
})

describe("shouldRecoverPoster", () => {
  it("требует восстановления только для заглушек", () => {
    expect(shouldRecoverPoster(SBR_MISSING)).toBe(true)
    expect(shouldRecoverPoster(GENERATED)).toBe(true)
    expect(shouldRecoverPoster(SBR_REAL_COVER)).toBe(false)
  })
})
