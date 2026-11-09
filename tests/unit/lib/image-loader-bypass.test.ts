/**
 * Обложки, которые img-сервис НЕ может обслужить, должны грузиться напрямую.
 * Раньше getProxiedSrc без разбора оборачивал всё в /proxy?url=..., контейнер
 * отвечал 502 «Host not allowed: » / «Invalid URL» — и обложка пропадала.
 */
import { afterEach, describe, expect, it, vi } from "vitest"

const ENV_KEY = "NEXT_PUBLIC_IMAGE_SERVER_URL"
const IMG_SERVER = "https://img.weeb-x.com"

async function loadLoader(value = "") {
  vi.resetModules()
  vi.stubEnv(ENV_KEY, value)
  return import("@/lib/image-loader")
}

const SUPABASE = "https://xyz.supabase.co/storage/v1/object/public/avatars/a.png"
const DATA_URI = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="
const SHIKI = "https://shikimori.one/system/animes/original/16498.jpg"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe("getProxiedSrc при настроенном img-сервисе", () => {
  it("не проксирует локальные файлы, data:, blob: и Supabase Storage", async () => {
    const { getProxiedSrc } = await loadLoader(IMG_SERVER)
    expect(getProxiedSrc("/posters/a.jpg")).toBe("/posters/a.jpg")
    expect(getProxiedSrc(DATA_URI)).toBe(DATA_URI)
    expect(getProxiedSrc("blob:https://weeb-x.com/1234")).toBe("blob:https://weeb-x.com/1234")
    expect(getProxiedSrc(SUPABASE)).toBe(SUPABASE)
    expect(getProxiedSrc("")).toBe("")
  })

  it("не оборачивает уже обёрнутый адрес img-сервиса повторно", async () => {
    const { getProxiedSrc } = await loadLoader(IMG_SERVER)
    const already = `${IMG_SERVER}/proxy?url=${encodeURIComponent(SHIKI)}`
    expect(getProxiedSrc(already)).toBe(already)
    // Старый адрес с портом — тот же хост, тоже не перепроксируем.
    const legacy = `https://img.weeb-x.com:8443/proxy?url=${encodeURIComponent(SHIKI)}`
    expect(getProxiedSrc(legacy)).toBe(legacy)
  })

  it("обычные внешние обложки по-прежнему идут через /proxy", async () => {
    const { getProxiedSrc } = await loadLoader(IMG_SERVER)
    expect(getProxiedSrc(SHIKI)).toBe(`${IMG_SERVER}/proxy?url=${encodeURIComponent(SHIKI)}`)
  })

  it("protocol-relative ссылку нормализует в https перед проксированием", async () => {
    const { getProxiedSrc } = await loadLoader(IMG_SERVER)
    expect(getProxiedSrc("//shikimori.one/a.jpg")).toBe(
      `${IMG_SERVER}/proxy?url=${encodeURIComponent("https://shikimori.one/a.jpg")}`,
    )
  })
})

describe("getProxiedSrc без img-сервиса (регрессия старых тестов)", () => {
  it("Pinterest идёт в локальный /api/image-proxy, остальное — как есть", async () => {
    const { getProxiedSrc } = await loadLoader("")
    const pin = "https://i.pinimg.com/originals/x.jpg"
    expect(getProxiedSrc(pin)).toBe(`/api/image-proxy?url=${encodeURIComponent(pin)}`)
    expect(getProxiedSrc(SHIKI)).toBe(`/api/image-proxy?url=${encodeURIComponent(SHIKI)}`)
    expect(getProxiedSrc("https://unknown.example/a.jpg")).toBe("https://unknown.example/a.jpg")
    expect(getProxiedSrc("/posters/a.jpg")).toBe("/posters/a.jpg")
    expect(getProxiedSrc(SUPABASE)).toBe(SUPABASE)
    expect(getProxiedSrc(DATA_URI)).toBe(DATA_URI)
    expect(getProxiedSrc("")).toBe("")
  })

  it("shouldBypassImageService экспортируется и работает как чистая функция", async () => {
    const { shouldBypassImageService } = await loadLoader(IMG_SERVER)
    expect(shouldBypassImageService("/a.png")).toBe(true)
    expect(shouldBypassImageService(DATA_URI)).toBe(true)
    expect(shouldBypassImageService(SUPABASE)).toBe(true)
    expect(shouldBypassImageService(SHIKI)).toBe(false)
  })
})
