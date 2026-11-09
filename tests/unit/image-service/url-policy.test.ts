/**
 * Правила img-сервиса, которые чаще всего виноваты в «часть обложек не
 * грузится»: белый список хостов, ротация зеркал, data-URI и параметры
 * оптимизации. Тестируем без express/sharp — модуль чистый.
 */
import { createRequire } from "node:module"
import path from "node:path"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const policy = require(path.resolve(process.cwd(), "coolify-image-service/url-policy.js")) as {
  ALLOWED_HOSTS: string[]
  SHIKIMORI_MIRRORS: string[]
  getExtraAllowedHosts: (env: Record<string, string>) => string[]
  isAllowedHost: (host: string, extra?: string[]) => boolean
  getReferer: (host: string) => string
  isSlowHost: (host: string) => boolean
  getFetchCandidates: (url: string) => string[]
  decodeDataUri: (url: string, maxBytes?: number) => { buffer: Buffer; contentType: string } | null
  parseImageParams: (query: Record<string, unknown>) => { width: number; quality: number; format: string }
  contentTypeForFormat: (format: string) => string
}

describe("img-сервис: белый список хостов", () => {
  it("пускает известные CDN и их поддомены", () => {
    expect(policy.isAllowedHost("shikimori.one")).toBe(true)
    expect(policy.isAllowedHost("shikimori.io")).toBe(true)
    expect(policy.isAllowedHost("s4.anilist.co")).toBe(true)
    expect(policy.isAllowedHost("raw.githubusercontent.com")).toBe(true)
    expect(policy.isAllowedHost("cdn.safebooru.org")).toBe(true)
  })

  it("не пускает левые хосты и look-alike домены", () => {
    expect(policy.isAllowedHost("example.com")).toBe(false)
    expect(policy.isAllowedHost("evilshikimori.one")).toBe(false)
    expect(policy.isAllowedHost("")).toBe(false)
    expect(policy.isAllowedHost("shikimori.one.evil.com")).toBe(false)
  })

  it("свой Supabase Storage можно разрешить только явно", () => {
    expect(policy.isAllowedHost("myproject.supabase.co")).toBe(false)
    expect(policy.isAllowedHost("myproject.supabase.co", ["myproject.supabase.co"])).toBe(true)
    // Соседний проект чужого бакета остаётся закрытым.
    expect(policy.isAllowedHost("another.supabase.co", ["myproject.supabase.co"])).toBe(false)
  })

  it("читает дополнительные хосты из env, включая полный URL", () => {
    expect(policy.getExtraAllowedHosts({
      EXTRA_ALLOWED_HOSTS: "a.example.com, b.example.com;cdn.example.net",
      SUPABASE_STORAGE_HOST: "https://proj.supabase.co",
    })).toEqual(["a.example.com", "b.example.com", "cdn.example.net", "proj.supabase.co"])
    expect(policy.getExtraAllowedHosts({})).toEqual([])
  })
})

describe("img-сервис: referer и таймауты", () => {
  it("даёт свой referer для каждого зеркала Shikimori", () => {
    expect(policy.getReferer("shikimori.one")).toBe("https://shikimori.one/")
    expect(policy.getReferer("shikimori.me")).toBe("https://shikimori.me/")
    expect(policy.getReferer("shikimori.io")).toBe("https://shikimori.io/")
    expect(policy.getReferer("shikimori.org")).toBe("https://shikimori.org/")
  })

  it("не путает AniList/Kitsu/Pinterest", () => {
    expect(policy.getReferer("s4.anilist.co")).toBe("https://anilist.co/")
    expect(policy.getReferer("i.pinimg.com")).toBe("https://www.pinterest.com/")
    expect(policy.getReferer("media.kitsu.io")).toBe("https://kitsu.io/")
    expect(policy.getReferer("example.com")).toBe("")
  })

  it("медленным хостом считается и поддомен", () => {
    expect(policy.isSlowHost("files.yande.re")).toBe(true)
    expect(policy.isSlowHost("cdn.files.yande.re")).toBe(true)
    expect(policy.isSlowHost("shikimori.one")).toBe(false)
  })
})

describe("img-сервис: ротация зеркал Shikimori", () => {
  it("для .one: исходный URL первый, остальные зеркала сохраняют path и query", () => {
    const url = "https://shikimori.one/system/animes/original/16498.jpg?1711973439"
    const candidates = policy.getFetchCandidates(url)
    expect(candidates).toHaveLength(policy.SHIKIMORI_MIRRORS.length)
    expect(candidates[0]).toBe(url)
    expect(new URL(candidates[1]).hostname).toBe("shikimori.me")
    expect(candidates.every(c => new URL(c).pathname === "/system/animes/original/16498.jpg")).toBe(true)
    expect(candidates.every(c => new URL(c).search === "?1711973439")).toBe(true)
  })

  it("ротация работает и для сохранённых ссылок с .io/.me/.org", () => {
    for (const mirror of policy.SHIKIMORI_MIRRORS.filter(m => m !== "shikimori.one")) {
      const url = `https://${mirror}/system/user_images_h/preview/a.jpg`
      const hosts = policy.getFetchCandidates(url).map(c => new URL(c).hostname)
      expect(hosts[0]).toBe(mirror)
      expect(new Set(hosts)).toEqual(new Set(policy.SHIKIMORI_MIRRORS))
    }
  })

  it("не трогает остальные хосты", () => {
    const url = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx1.jpg"
    expect(policy.getFetchCandidates(url)).toEqual([url])
  })
})

describe("img-сервис: data-URI и параметры", () => {
  it("декодирует data:image/svg+xml (сгенерированную обложку)", () => {
    const svg = "<svg xmlns='http://www.w3.org/2000/svg'></svg>"
    const uri = `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`
    const decoded = policy.decodeDataUri(uri)
    expect(decoded?.contentType).toBe("image/svg+xml")
    expect(decoded?.buffer.toString("utf8")).toBe(svg)
  })

  it("декодирует url-encoded data-URI", () => {
    const decoded = policy.decodeDataUri("data:image/svg+xml,%3Csvg%3E%3C%2Fsvg%3E")
    expect(decoded?.buffer.toString("utf8")).toBe("<svg></svg>")
  })

  it("отвергает не-картинки, мусор и слишком большие данные", () => {
    expect(policy.decodeDataUri("data:text/html,<script>alert(1)</script>")).toBeNull()
    expect(policy.decodeDataUri("https://shikimori.one/a.jpg")).toBeNull()
    expect(policy.decodeDataUri("data:image/png;base64,AAAA", 2)).toBeNull()
  })

  it("клампит w/q и приводит f к известному формату", () => {
    expect(policy.parseImageParams({})).toEqual({ width: 384, quality: 60, format: "webp" })
    expect(policy.parseImageParams({ w: "3840", q: "75", f: "jpg" })).toEqual({ width: 3840, quality: 75, format: "jpeg" })
    expect(policy.parseImageParams({ w: "0", q: "-1", f: "bogus" })).toEqual({ width: 1, quality: 1, format: "webp" })
    expect(policy.parseImageParams({ w: "abc", q: "999" })).toEqual({ width: 384, quality: 100, format: "webp" })
    expect(policy.parseImageParams({ w: "99999", f: "avif" })).toEqual({ width: 8192, quality: 60, format: "avif" })
  })

  it("content-type соответствует формату", () => {
    expect(policy.contentTypeForFormat("webp")).toBe("image/webp")
    expect(policy.contentTypeForFormat("avif")).toBe("image/avif")
    expect(policy.contentTypeForFormat("jpeg")).toBe("image/jpeg")
  })
})
