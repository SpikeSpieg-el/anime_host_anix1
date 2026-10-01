import { describe, expect, it } from "vitest"
import { csvField } from "@/lib/csv"

describe("csvField", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-1+2", "@HYPERLINK(\"https://evil.example\")", "\t=cmd|calc", "\0=1+1"])(
    "neutralizes formula-like input %s",
    (value) => {
      expect(csvField(value).replace(/^\"/, "").startsWith("'")).toBe(true)
    },
  )

  it("preserves ordinary values and escapes CSV delimiters and quotes", () => {
    expect(csvField("plain text")).toBe("plain text")
    expect(csvField("A, \"B\"")).toBe('"A, ""B"""')
    expect(csvField(null)).toBe("")
    expect(csvField({ name: "Anime" })).toBe('"{""name"":""Anime""}"')
  })
})
