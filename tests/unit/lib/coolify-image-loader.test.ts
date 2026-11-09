/**
 * Кастомный next/image loader: внешние обложки — в /optimize, всё остальное
 * грузится напрямую. Именно здесь Supabase Storage / data: / локальные файлы
 * раньше превращались в 502 от img-сервиса.
 */
import { createRequire } from "node:module"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

const require = createRequire(import.meta.url)
const loaderPath = path.resolve(process.cwd(), "lib/coolify-image-loader.js")

type Loader = (args: { src: string; width: number; quality?: number }) => string

function load(value: string) {
  vi.stubEnv("NEXT_PUBLIC_IMAGE_SERVER_URL", value)
  delete require.cache[require.resolve(loaderPath)]
  const mod = require(loaderPath)
  return {
    loader: mod as Loader,
    bypass: mod.bypassImageService as (src: string) => boolean,
  }
}

const IMG_SERVER = "https://img.weeb-x.com"
const SHIKI = "https://shikimori.one/system/animes/original/16498.jpg"
const SUPABASE = "https://xyz.supabase.co/storage/v1/object/public/avatars/a.png"
const DATA_URI = "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("coolifyImageLoader при настроенном img-сервисе", () => {
  it("локальные файлы, data:, blob: и Supabase Storage отдаёт как есть", () => {
    const { loader, bypass } = load(IMG_SERVER)
    const call = (src: string) => loader({ src, width: 384, quality: 60 })

    expect(call("/catgirl_tutorial.png")).toBe("/catgirl_tutorial.png")
    expect(call(DATA_URI)).toBe(DATA_URI)
    expect(call("blob:https://weeb-x.com/uuid")).toBe("blob:https://weeb-x.com/uuid")
    expect(call(SUPABASE)).toBe(SUPABASE)

    expect(bypass("/catgirl_tutorial.png")).toBe(true)
    expect(bypass(DATA_URI)).toBe(true)
    expect(bypass(SUPABASE)).toBe(true)
    expect(bypass(SHIKI)).toBe(false)
  })

  it("не переоптимизирует уже обёрнутые адреса (включая старый :8443)", () => {
    const { loader } = load(IMG_SERVER)
    const proxied = `${IMG_SERVER}/proxy?url=${encodeURIComponent(SHIKI)}`
    const optimized = `${IMG_SERVER}/optimize?url=${encodeURIComponent(SHIKI)}&w=384`
    const legacy = `https://img.weeb-x.com:8443/proxy?url=${encodeURIComponent(SHIKI)}`

    expect(loader({ src: proxied, width: 384 })).toBe(proxied)
    expect(loader({ src: optimized, width: 384 })).toBe(optimized)
    expect(loader({ src: legacy, width: 384 })).toBe(legacy)
  })

  it("внешнюю обложку отправляет в /optimize с параметрами", () => {
    const { loader } = load(IMG_SERVER)
    expect(loader({ src: SHIKI, width: 3840, quality: 60 })).toBe(
      `${IMG_SERVER}/optimize?url=${encodeURIComponent(SHIKI)}&w=3840&q=60&f=webp`,
    )
  })

  it("protocol-relative ссылку нормализует в https", () => {
    const { loader } = load(IMG_SERVER)
    expect(loader({ src: "//shikimori.one/a.jpg", width: 384 })).toBe(
      `${IMG_SERVER}/optimize?url=${encodeURIComponent("https://shikimori.one/a.jpg")}&w=384&q=60&f=webp`,
    )
  })

  it("URL сервера с завершающим слэшем не даёт двойного слэша", () => {
    const { loader } = load(`${IMG_SERVER}/`)
    expect(loader({ src: SHIKI, width: 384 })).toBe(
      `${IMG_SERVER}/optimize?url=${encodeURIComponent(SHIKI)}&w=384&q=60&f=webp`,
    )
  })
})

describe("coolifyImageLoader без img-сервиса", () => {
  it("падает обратно на стандартный /_next/image", () => {
    const { loader } = load("")
    expect(loader({ src: SHIKI, width: 640, quality: 75 })).toBe(
      `/_next/image?url=${encodeURIComponent(SHIKI)}&w=640&q=75`,
    )
  })
})
