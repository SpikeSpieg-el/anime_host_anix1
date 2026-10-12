import { describe, expect, it } from "vitest"
import { transformAnime } from "@/lib/shikimori/transformers"
import { isHentaiContent, isNoIndexAnime } from "@/lib/hentai-detector"

// Реальные ответы Shikimori.one/api/animes/<id> (снято 2026-10-13).
// Фикстуры намеренно живые: баг «r_plus уезжает в хентай-плеер» невозможно
// поймать на выдуманных данных, потому что r_plus не хватает в тестовых
// объектах по умолчанию.
const SHIKI_61578 = {
  id: 61578, name: "Seitokai ni mo Ana wa Aru!", russian: "Даже у студсовета есть косяки!",
  rating: "r_plus", score: "7.62", kind: "tv", status: "ongoing", aired_on: "2026-10-04",
  episodes: 12, episodes_aired: 2, genres: [],
  image: { original: "/assets/globals/missing_original.jpg", preview: "/assets/globals/missing_preview.jpg", x96: "", x48: "" },
  description: "Умэ Мидзуноэ — первокурсник... Студенческий совет.",
} as any

const SHIKI_188 = {
  id: 188, name: "Gosenzo Sane", russian: "Маскарад", rating: "rx", score: "6.17",
  kind: "ova", status: "released", aired_on: "1998-09-25", episodes: 4, episodes_aired: 0,
  description: "Этот хентай расскажет нам об судьбе молодого человека по имени Ген Хирага...",
  image: { original: "/system/animes/original/188.jpg", preview: "/system/animes/preview/188.jpg", x96: "", x48: "" },
  genres: [
    { id: 4, name: "Comedy", russian: "Комедия" },
    { id: 37, name: "Supernatural", russian: "Сверхъестественное" },
    { id: 12, name: "Hentai", russian: "Хентай" },
  ],
} as any

const SHIKI_16498 = {
  id: 16498, name: "Shingeki no Kyojin", russian: "Атака титанов", rating: "r", score: "8.58",
  kind: "tv", status: "released", aired_on: "2013-04-07", episodes: 25, episodes_aired: 25,
  description: "С давних времён человечество ведёт свою борьбу с титанами.",
  image: { original: "/system/animes/original/16498.jpg", preview: "/system/animes/preview/16498.jpg", x96: "", x48: "" },
  genres: [
    { id: 27, name: "Shounen", russian: "Сёнен" },
    { id: 1, name: "Action", russian: "Экшен" },
    { id: 8, name: "Drama", russian: "Драма" },
    { id: 41, name: "Thriller", russian: "Триллер" },
    { id: 38, name: "Military", russian: "Военное" },
  ],
} as any

describe("реальные данные Shikimori → выбор плеера", () => {
  it("61578 «Даже у студсовета есть косяки!» (r_plus) → Kodik, не хентай", async () => {
    const anime = await transformAnime(SHIKI_61578, false, true)
    expect(anime.shikimoriRating).toBe("r_plus")
    expect(anime.isNsfw).toBe(true)
    expect(anime.isHentai).toBe(false)
    expect(isHentaiContent(anime)).toBe(false)
    expect(isNoIndexAnime(anime)).toBe(true)
  })

  it("188 «Маскарад» (rx, жанр Хентай) → хентай-плеер", async () => {
    const anime = await transformAnime(SHIKI_188, false, true)
    expect(anime.isHentai).toBe(true)
    expect(isHentaiContent(anime)).toBe(true)
  })

  it("16498 «Атака титанов» (r) → Kodik", async () => {
    const anime = await transformAnime(SHIKI_16498, false, true)
    expect(anime.isNsfw).toBe(false)
    expect(isHentaiContent(anime)).toBe(false)
    expect(isNoIndexAnime(anime)).toBe(false)
  })
})
