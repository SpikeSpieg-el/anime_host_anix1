/**
 * Обложки: восстановление после 404.
 *
 * Сценарий, который чинится: ссылка на обложку с Shikimori отдаёт 404, но
 * выглядит валидно (обычный `.jpg`), поэтому `isHighQualityImage` её пропускает
 * и `resolveBestPoster` возвращает её на шаге 1. «Фоллбэк на другой провайдер»
 * в итоге отдавал ту же сломанную ссылку — обложка с шики и обложка с прокси
 * совпадали, и круг восстановления не закрывался.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { resolveBestPoster } from "@/lib/shikimori/images"

// Kodik тянет токены и ходит в kodik-api.com — в этом тесте внешние источники
// недоступны, поэтому подменяем его заглушкой, чтобы не ждать реальную сеть.
vi.mock("@/lib/kodik", () => ({
  getKodikPoster: vi.fn(async () => null),
}))

const SHIKI_POSTER = "https://shikimori.one/system/images/original/12345.jpg"

describe("resolveBestPoster: заведомо сломанная ссылка Shikimori", () => {
  beforeEach(() => {
    // Все внешние провайдеры недоступны → поиск доходит до generateArtPoster.
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("offline in test")
    }))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("по умолчанию отдаёт Shikimori — по виду URL он выглядит пригодным", async () => {
    const poster = await resolveBestPoster(SHIKI_POSTER, "Some Anime", "Какое-то аниме", "1")
    expect(poster).toContain("shikimori.one")
    expect(poster).toBe(SHIKI_POSTER)
  })

  it("при excludeShikimori больше не возвращает Shikimori, даже когда URL выглядит валидным", async () => {
    const poster = await resolveBestPoster(
      SHIKI_POSTER,
      "Some Anime",
      "Какое-то аниме",
      "1",
      false,
      true,
    )
    expect(poster).not.toContain("shikimori.one")
  })

  it("при excludeShikimori не вернёт Shikimori и на последнем шаге (шаг 6)", async () => {
    // Ссылка, которую isHighQualityImage отвергнет по «thumb» в URL: до шага 6
    // дело не доходит, но шаг 6 тоже обязан её пропустить.
    const thumbish = "https://shikimori.one/system/images/preview/999.jpg"
    const poster = await resolveBestPoster(
      thumbish,
      "Some Anime",
      "Какое-то аниме",
      "2",
      false,
      true,
    )
    expect(poster).not.toContain("shikimori.one")
  })

  it("кеш разделяет варианты: фоллбэк без Shikimori не отдаёт его из кэша", async () => {
    // Первый вызов кладёт в кэш Shikimori-ссылку...
    await resolveBestPoster(SHIKI_POSTER, "Some Anime", "Какое-то аниме", "3")
    // ...а второй, с excludeShikimori, обязан её проигнорировать: ключ кэша
    // теперь включает флаг, иначе восстановление снова отдало бы сломанное.
    const poster = await resolveBestPoster(
      SHIKI_POSTER,
      "Some Anime",
      "Какое-то аниме",
      "3",
      false,
      true,
    )
    expect(poster).not.toContain("shikimori.one")
  })

  it("disableExternalAPIs: шаг 1 всё равно отдаёт Shikimori — так задокументировано", async () => {
    // Важно не перепутать: флаг отключает внешние API, но не сам Shikimori.
    // Шаг 1 стоит ДО проверки флага намеренно.
    const poster = await resolveBestPoster(
      SHIKI_POSTER,
      "Some Anime",
      "Какое-то аниме",
      "4",
      true,
      false,
    )
    expect(poster).toBe(SHIKI_POSTER)
  })

  it("disableExternalAPIs + excludeShikimori ведёт к сгенерированной заглушке", async () => {
    const poster = await resolveBestPoster(
      SHIKI_POSTER,
      "Some Anime",
      "Какое-то аниме",
      "5",
      true,
      true,
    )
    // Заглушка — data:image, а не ссылка на внешний источник.
    expect(poster.startsWith("data:image")).toBe(true)
  })
})