import { describe, expect, it } from "vitest"
import { safeSerializeJson } from "@/lib/seo/safe-json"

describe("safeSerializeJson", () => {
  it("escapes HTML-sensitive characters while preserving valid JSON", () => {
    const value = { text: '</script><script>alert("x")</script>&\u2028line' }
    const serialized = safeSerializeJson(value)

    expect(serialized).not.toContain("<")
    expect(serialized).not.toContain(">")
    expect(serialized).not.toContain("&")
    expect(serialized).toContain("\\u003c")
    expect(JSON.parse(serialized)).toEqual(value)
  })

  it("serializes undefined as valid null JSON", () => {
    expect(safeSerializeJson(undefined)).toBe("null")
  })
})
