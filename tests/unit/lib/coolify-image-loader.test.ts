import { describe, expect, it } from "vitest"

// Лоадер — CommonJS-модуль, читает env на момент require.
// Витест кэширует модули, поэтому для обоих сценариев используем
// динамический require с инвалидацией кэша.
const loadLoader = () => {
  delete require.cache[require.resolve("../../../lib/coolify-image-loader")]
  return require("../../../lib/coolify-image-loader") as (
    props: { src: string; width: number; quality?: number },
  ) => string
}

describe("coolify-image-loader", () => {
  it("routes external images through the image service when NEXT_PUBLIC_IMAGE_SERVER_URL is set", () => {
    process.env.NEXT_PUBLIC_IMAGE_SERVER_URL = "https://img.weeb-x.com"
    const loader = loadLoader()
    expect(
      loader({ src: "https://media.kitsu.app/anime/1/poster_image/a.jpg", width: 384, quality: 60 }),
    ).toBe(
      "https://img.weeb-x.com/optimize?url=" +
        encodeURIComponent("https://media.kitsu.app/anime/1/poster_image/a.jpg") +
        "&w=384&q=60&f=webp",
    )
    // Уже проксированный URL не заворачивается повторно
    expect(loader({ src: "https://img.weeb-x.com/proxy?url=abc", width: 100 })).toBe(
      "https://img.weeb-x.com/proxy?url=abc",
    )
  })

  it("serves local paths and data URIs directly", () => {
    process.env.NEXT_PUBLIC_IMAGE_SERVER_URL = "https://img.weeb-x.com"
    const loader = loadLoader()
    expect(loader({ src: "/icon.svg", width: 100 })).toBe("/icon.svg")
    expect(loader({ src: "data:image/svg+xml;base64,xxx", width: 100 })).toBe(
      "data:image/svg+xml;base64,xxx",
    )
    expect(loader({ src: "", width: 100 })).toBe("")
  })

  it("falls back to /api/image-proxy (never /_next/image) when the env var is not baked", () => {
    delete process.env.NEXT_PUBLIC_IMAGE_SERVER_URL
    const loader = loadLoader()
    const url = "https://media.kitsu.app/anime/1/poster_image/a.jpg"
    const result = loader({ src: url, width: 384, quality: 60 })
    // /_next/image при кастомном лоадере не существует (404) — нельзя использовать
    expect(result).not.toContain("/_next/image")
    expect(result).toBe(`/api/image-proxy?url=${encodeURIComponent(url)}`)
    // Локальные пути и в fallback не проксируются
    expect(loader({ src: "/icon.svg", width: 100 })).toBe("/icon.svg")
    expect(loader({ src: "data:image/svg+xml;base64,xxx", width: 100 })).toBe(
      "data:image/svg+xml;base64,xxx",
    )
  })
})
