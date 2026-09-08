import { describe, expect, it } from "vitest"
import { isExternalImageUrl, getProxiedSrc } from "@/lib/image-loader"

describe("isExternalImageUrl", () => {
  it("is false for empty / local urls", () => {
    expect(isExternalImageUrl("")).toBe(false)
    expect(isExternalImageUrl("/logo.png")).toBe(false)
  })

  it("detects known artwork CDNs", () => {
    expect(isExternalImageUrl("https://shikimori.one/system/animes/original/1.jpg")).toBe(true)
    expect(isExternalImageUrl("https://i.pinimg.com/originals/aa.jpg")).toBe(true)
    expect(isExternalImageUrl("https://cdn.myanimelist.net/images/anime/1.jpg")).toBe(true)
    expect(isExternalImageUrl("https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/x.png")).toBe(true)
  })
})

describe("getProxiedSrc", () => {
  it("returns empty string for empty url", () => {
    expect(getProxiedSrc("")).toBe("")
  })

  it("does not proxy supabase storage", () => {
    const url = "https://xyz.supabase.co/storage/v1/object/public/avatars/a.png"
    expect(getProxiedSrc(url)).toBe(url)
  })

  it("proxies external domains through /api/image-proxy", () => {
    const url = "https://i.pinimg.com/originals/x.jpg"
    expect(getProxiedSrc(url)).toBe(`/api/image-proxy?url=${encodeURIComponent(url)}`)
  })

  it("leaves unknown local-ish urls untouched", () => {
    expect(getProxiedSrc("/posters/a.jpg")).toBe("/posters/a.jpg")
  })
})
