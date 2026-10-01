import { describe, expect, it } from "vitest"
import { sanitizeNewsHtml } from "@/lib/news/sanitize-html"

describe("sanitizeNewsHtml", () => {
  it("removes executable markup and dangerous attributes from stored news bodies", () => {
    const result = sanitizeNewsHtml(
      '<script>alert(1)</script><p onclick="alert(2)" style="background:url(javascript:alert(3))">News</p><img src="x" onerror="alert(4)"><a href="javascript:alert(5)" onclick="alert(6)">open</a>',
    )

    expect(result).not.toMatch(/<script|onerror|onclick|javascript:|style=/i)
    expect(result).toContain("News")
    expect(result).toContain("open")
    expect(result).toContain('<img src="x"')
  })

  it("preserves the safe formatting used by news cards, links, and video embeds", () => {
    const result = sanitizeNewsHtml(
      '<a href="/watch/123-title" class="news-anime-card" target="_blank" rel="noopener noreferrer">Anime</a><video controls preload="metadata"><source src="https://cdn.example/video.mp4" type="video/mp4"></video>',
    )

    expect(result).toContain('href="/watch/123-title"')
    expect(result).toContain('class="news-anime-card"')
    expect(result).toContain('rel="noopener noreferrer"')
    expect(result).toContain("<video controls preload=\"metadata\">")
    expect(result).toContain('src="https://cdn.example/video.mp4"')
  })

  it("rejects protocol-relative and data URLs", () => {
    const result = sanitizeNewsHtml(
      '<a href="//evil.example">external</a><img src="data:image/svg+xml,<svg onload=alert(1)>" alt="x">',
    )

    expect(result).not.toContain("//evil.example")
    expect(result).not.toContain("data:image")
    expect(result).not.toContain("onload")
  })
})
