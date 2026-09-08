import { describe, expect, it } from "vitest"
import { cn } from "@/lib/utils"

describe("cn (class merge)", () => {
  it("merges class names", () => {
    expect(cn("px-2", "py-1")).toContain("px-2")
    expect(cn("px-2", "py-1")).toContain("py-1")
  })

  it("resolves tailwind conflicts, last wins", () => {
    expect(cn("px-2", "px-4")).toBe("px-4")
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500")
  })

  it("ignores falsy values", () => {
    expect(cn("base", false && "hidden", null, undefined, "ok")).toBe("base ok")
  })

  it("handles empty input", () => {
    expect(cn()).toBe("")
  })
})
