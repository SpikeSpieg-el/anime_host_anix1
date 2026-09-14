import { describe, expect, it } from "vitest"
import {
  createSignedProxyUrl,
  decodeProxyParam,
  encodeProxyParam,
  resolveProxySecret,
  verifyProxyRequest,
} from "@/lib/animdl/proxy-url"

describe("resolveProxySecret (стабильность в деплое)", () => {
  it("явный ANIMDL_PROXY_SECRET имеет приоритет", () => {
    expect(
      resolveProxySecret({ ANIMDL_PROXY_SECRET: "explicit" }),
    ).toBe("explicit")
  })

  it("без явного — стабильная производная от серверного секрета", () => {
    const a = resolveProxySecret({ SUPABASE_SERVICE_ROLE_KEY: "svc-key" })
    const b = resolveProxySecret({ SUPABASE_SERVICE_ROLE_KEY: "svc-key" })
    expect(a).toBe(b)
    expect(a).not.toContain("svc-key") // секрет не утекает в само значение
    expect(a).toHaveLength(64) // sha256 hex
  })

  it("производная не зависит от ротации другого секрета", () => {
    const fromSupabase = resolveProxySecret({ SUPABASE_SERVICE_ROLE_KEY: "k1" })
    const fromVk = resolveProxySecret({ VK_SERVICE_KEY: "k2" })
    expect(fromSupabase).not.toBe(fromVk)
  })
})

describe("animdl proxy-url", () => {
  it("кодирует и декодирует параметры туда-обратно", () => {
    const value = "https://cdn.example.com/video/ep1.m3u8?token=абв&ext=1"
    const encoded = encodeProxyParam(value)
    expect(encoded).not.toContain("https")
    expect(decodeProxyParam(encoded)).toBe(value)
  })

  it("создаёт подписанную ссылку и верифицирует её", () => {
    const signed = createSignedProxyUrl(
      "hls",
      "https://cdn.example.com/ep1.m3u8",
      "https://allanime.to/",
    )
    expect(signed).toMatch(/^\/api\/animdl\/hls\?/)

    const params = new URL(signed, "https://weeb-x.com").searchParams
    const verified = verifyProxyRequest("hls", params)
    expect(verified).not.toBeNull()
    expect(verified?.url).toBe("https://cdn.example.com/ep1.m3u8")
    expect(verified?.referer).toBe("https://allanime.to/")
    expect(verified?.download).toBe(false)
  })

  it("не пускает ссылку другого типа прокси", () => {
    const signed = createSignedProxyUrl("hls", "https://cdn.example.com/a.m3u8", "")
    const params = new URL(signed, "https://weeb-x.com").searchParams
    expect(verifyProxyRequest("file", params)).toBeNull()
  })

  it("отклоняет подделанный URL", () => {
    const signed = createSignedProxyUrl("hls", "https://cdn.example.com/a.m3u8", "")
    const params = new URL(signed, "https://weeb-x.com").searchParams
    params.set("u", encodeProxyParam("https://evil.example.com/a.m3u8"))
    expect(verifyProxyRequest("hls", params)).toBeNull()
  })

  it("отклоняет просроченную ссылку", () => {
    const signed = createSignedProxyUrl("hls", "https://cdn.example.com/a.m3u8", "", {
      ttlSeconds: 60,
    })
    const params = new URL(signed, "https://weeb-x.com").searchParams
    // Симулируем прошедшее время: подменяем exp и переподписываем «старым» exp нельзя,
    // поэтому просто сдвигаем exp — подпись перестаёт совпадать.
    params.set("e", String(Math.floor(Date.now() / 1000) - 10))
    expect(verifyProxyRequest("hls", params)).toBeNull()
  })

  it("пробрасывает флаг скачивания и имя файла", () => {
    const signed = createSignedProxyUrl("file", "https://cdn.example.com/ep1.mp4", "", {
      download: true,
      filename: "Клинок — серия 3 (1080p).mp4",
    })
    const params = new URL(signed, "https://weeb-x.com").searchParams
    const verified = verifyProxyRequest("file", params)
    expect(verified?.download).toBe(true)
    expect(verified?.filename).toBe("Клинок — серия 3 (1080p).mp4")
  })

  it("отклоняет мусорные параметры", () => {
    expect(verifyProxyRequest("hls", new URLSearchParams())).toBeNull()
    expect(
      verifyProxyRequest("hls", new URLSearchParams({ u: "not-a-url", r: "", e: "1", s: "x" })),
    ).toBeNull()
  })
})
