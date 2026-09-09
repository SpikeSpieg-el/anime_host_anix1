import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installAnalyticsDomTracking } from "@/lib/analytics-dom"
import { trackEvent, isAnalyticsEnabled } from "@/lib/analytics"

vi.mock("@/lib/analytics", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/analytics")>(),
  isAnalyticsEnabled: vi.fn(() => true), trackEvent: vi.fn(),
}))
let cleanup: () => void
beforeEach(() => { window.history.replaceState({}, "", "/"); cleanup = installAnalyticsDomTracking() })
afterEach(() => { cleanup(); document.body.innerHTML = "" })
const click = (selector: string) => document.querySelector(selector)!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))

describe("DOM analytics", () => {
  it("captures nested targets, tabs, switches and repeated intentional clicks", () => {
    document.body.innerHTML = '<button><span>Play</span></button><div role="tab">Collection</div><button role="switch">Theme</button>'
    click("span"); click("span"); click('[role="tab"]'); click('[role="switch"]')
    expect(trackEvent).toHaveBeenCalledTimes(4)
    expect(trackEvent).toHaveBeenCalledWith("click", expect.objectContaining({ label: "Play", element: "button" }))
  })
  it("custom events fire once without hijacking Next links", () => {
    document.body.innerHTML = '<a href="/gacha" data-umami-event="gacha_pack_open" data-umami-event-pack="2024"><span>Open</span></a>'
    expect(click("span")).toBe(true) // no preventDefault
    expect(trackEvent).toHaveBeenCalledExactlyOnceWith("gacha_pack_open", { pack: "2024" })
  })
  it("honors ancestor opt-out for clicks, custom events and forms", () => {
    document.body.innerHTML = '<section data-track="off"><button data-umami-event="private">Private</button><form></form></section>'
    click("button")
    document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true }))
    expect(trackEvent).not.toHaveBeenCalled()
  })
  it("does not collect editable content or disabled buttons", () => {
    document.body.innerHTML = '<button disabled>Disabled</button><div contenteditable="true" data-track="editor">Private text</div>'
    click("button"); click("div")
    expect(trackEvent).not.toHaveBeenCalled()
  })
  it("tracks submission intent without form contents or action tokens", () => {
    document.body.innerHTML = '<form id="login" action="/auth?token=secret"><input name="email" value="private@example.com"><input type="password" value="secret"></form>'
    document.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true }))
    expect(trackEvent).toHaveBeenCalledWith("form_submit", { id: "login", name: undefined, path: "/", action: "/auth" })
    expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toMatch(/secret|private@example/)
  })
  it("captures checkbox/select changes, not free text", () => {
    document.body.innerHTML = '<input type="checkbox" checked><select><option>Private label</option></select><input type="email" value="private@example.com">'
    for (const el of document.querySelectorAll("input,select")) el.dispatchEvent(new Event("change", { bubbles: true }))
    expect(trackEvent).toHaveBeenCalledTimes(2)
    expect(trackEvent).toHaveBeenCalledWith("control_change", expect.objectContaining({ checked: true }))
    expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toMatch(/Private|private@example/)
  })
  it("captures nothing without consent and removes listeners", () => {
    document.body.innerHTML = '<button>Play</button>'
    vi.mocked(isAnalyticsEnabled).mockReturnValueOnce(false)
    click("button")
    cleanup()
    click("button")
    expect(trackEvent).not.toHaveBeenCalled()
  })
})
