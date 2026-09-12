import { describe, expect, it } from "vitest"
import { looksLikeHlsPlaylist, rewriteHlsPlaylist } from "@/lib/animdl/hls"

const wrap = (url: string) => `PROXY::${url}`

describe("rewriteHlsPlaylist", () => {
  it("переписывает относительные сегменты в абсолютные через wrap", () => {
    const manifest = [
      "#EXTM3U",
      "#EXT-X-VERSION:3",
      "#EXT-X-TARGETDURATION:6",
      "#EXTINF:5.0,",
      "seg-1.ts",
      "#EXTINF:5.0,",
      "../hls/seg-2.ts",
      "#EXT-X-ENDLIST",
    ].join("\n")

    const result = rewriteHlsPlaylist(
      manifest,
      "https://cdn.example.com/video/hls/ep1.m3u8",
      wrap,
    )

    expect(result).toContain("PROXY::https://cdn.example.com/video/hls/seg-1.ts")
    expect(result).toContain("PROXY::https://cdn.example.com/video/hls/seg-2.ts")
    expect(result).toContain("#EXTINF:5.0,")
    expect(result).toContain("#EXT-X-ENDLIST")
  })

  it("переписывает URI в EXT-X-KEY и EXT-X-MEDIA", () => {
    const manifest = [
      "#EXTM3U",
      '#EXT-X-KEY:METHOD=AES-128,URI="key.bin",IV=0x1',
      '#EXT-X-MEDIA:TYPE=SUBTITLES,NAME="ru",URI="subs/ru.vtt"',
      "seg-1.ts",
    ].join("\n")

    const result = rewriteHlsPlaylist(manifest, "https://cdn.example.com/ep.m3u8", wrap)

    expect(result).toContain('URI="PROXY::https://cdn.example.com/key.bin"')
    expect(result).toContain('URI="PROXY::https://cdn.example.com/subs/ru.vtt"')
  })

  it("не трогает абсолютные ссылки кроме оборачивания", () => {
    const manifest = ["#EXTM3U", "https://other-cdn.example.com/x/seg-1.ts"].join("\n")
    const result = rewriteHlsPlaylist(manifest, "https://cdn.example.com/ep.m3u8", wrap)
    expect(result).toContain("PROXY::https://other-cdn.example.com/x/seg-1.ts")
  })

  it("переписывает EXT-X-MAP init-сегмент", () => {
    const manifest = [
      "#EXTM3U",
      '#EXT-X-MAP:URI="init.mp4"',
      "seg-1.m4s",
    ].join("\n")
    const result = rewriteHlsPlaylist(manifest, "https://cdn.example.com/ep.m3u8", wrap)
    expect(result).toContain('URI="PROXY::https://cdn.example.com/init.mp4"')
  })

  it("сохраняет переводы строк и структуру", () => {
    const manifest = "#EXTM3U\n\nseg-1.ts\n"
    const result = rewriteHlsPlaylist(manifest, "https://cdn.example.com/ep.m3u8", wrap)
    expect(result.split("\n")).toHaveLength(4)
  })
})

describe("looksLikeHlsPlaylist", () => {
  it("распознаёт плейлист по заголовку", () => {
    expect(looksLikeHlsPlaylist("#EXTM3U\n#EXT-X-VERSION:3")).toBe(true)
    expect(looksLikeHlsPlaylist("\n  #EXT-X-TARGETDURATION:6")).toBe(true)
    expect(looksLikeHlsPlaylist("GIF89a....")).toBe(false)
  })
})
