import { describe, expect, it } from "vitest"
import { isChunkLoadError } from "@/lib/chunk-load-error"

describe("isChunkLoadError", () => {
  it("recognizes stale Next.js and dynamic import chunk failures", () => {
    expect(isChunkLoadError(new Error("Loading chunk 42 failed."))).toBe(true)
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module"))).toBe(true)
    expect(isChunkLoadError({ name: "ChunkLoadError", message: "Loading CSS chunk 3 failed" })).toBe(true)
  })

  it("does not classify application render errors as chunk failures", () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined"))).toBe(false)
    expect(isChunkLoadError("Something else went wrong")).toBe(false)
  })
})
