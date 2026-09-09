import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { installEngagementTracking } from "@/lib/analytics-engagement"
import { trackEvent } from "@/lib/analytics"
vi.mock("@/lib/analytics", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/analytics")>(), trackEvent: vi.fn(),
}))
let cleanup: () => void
function visibility(state: "hidden" | "visible") {
  vi.spyOn(document, "visibilityState", "get").mockReturnValue(state)
  document.dispatchEvent(new Event("visibilitychange"))
}
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(0)
  visibility("visible")
  cleanup = installEngagementTracking("/watch/1")
})
afterEach(() => { cleanup(); vi.useRealTimers() })

describe("engagement clock", () => {
  it("does not count hidden time or resend cumulative time", () => {
    vi.advanceTimersByTime(10000)
    visibility("hidden")
    window.dispatchEvent(new Event("pagehide"))
    expect(trackEvent).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(60000)
    visibility("visible")
    vi.advanceTimersByTime(6000)
    visibility("hidden")
    expect(vi.mocked(trackEvent).mock.calls.map(call => call[1]?.seconds)).toEqual([10, 6])
  })
  it("attributes leaving engagement to the old route", () => {
    vi.advanceTimersByTime(5000)
    cleanup()
    expect(trackEvent).toHaveBeenCalledWith("engagement", expect.objectContaining({ path: "/watch/1", seconds: 5 }), "/watch/1")
  })
  it("ignores short visits but accumulates short visible intervals", () => {
    vi.advanceTimersByTime(3000)
    visibility("hidden")
    expect(trackEvent).not.toHaveBeenCalled()
    vi.advanceTimersByTime(90000)
    visibility("visible")
    vi.advanceTimersByTime(3000)
    cleanup()
    expect(trackEvent).toHaveBeenCalledWith("engagement", expect.objectContaining({ seconds: 6 }), "/watch/1")
  })
})
