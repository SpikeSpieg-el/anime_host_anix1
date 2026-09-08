import { describe, expect, it, vi, beforeEach } from "vitest"

vi.mock("sonner", () => ({
  toast: vi.fn(),
}))

import { checkEasterEgg, easterEggs } from "@/lib/easter-eggs"

describe("easter eggs", () => {
  beforeEach(() => {
    document.head.innerHTML = ""
    document.body.innerHTML = ""
  })

  it("registers unique commands starting with ?", () => {
    const commands = easterEggs.map((e) => e.command)
    expect(new Set(commands).size).toBe(commands.length)
    for (const egg of easterEggs) {
      expect(egg.command.startsWith("?")).toBe(true)
      expect(egg.description.length).toBeGreaterThan(0)
      expect(typeof egg.action).toBe("function")
    }
  })

  it("checkEasterEgg is case-insensitive and trims input", () => {
    expect(checkEasterEgg("  ?COMMANDS  ")).toBe(true)
    expect(checkEasterEgg("?NyAn")).toBe(true)
  })

  it("returns false for unknown commands", () => {
    expect(checkEasterEgg("naruto")).toBe(false)
    expect(checkEasterEgg("?not-a-real-command")).toBe(false)
    expect(checkEasterEgg("")).toBe(false)
  })

  it("includes the documented help command", () => {
    expect(easterEggs.some((e) => e.command === "?commands")).toBe(true)
  })
})
