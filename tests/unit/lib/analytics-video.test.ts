import { afterEach, describe, expect, it, vi } from "vitest"
import { createVideoProgressTracker, installNativeVideoTracking } from "@/lib/analytics-video"
import { isAnalyticsEnabled, trackEvent } from "@/lib/analytics"
vi.mock("@/lib/analytics", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/analytics")>(),
  isAnalyticsEnabled: vi.fn(() => true), trackEvent: vi.fn(),
}))
afterEach(() => { document.body.innerHTML = "" })
describe("video events", () => {
  it("emits bounded milestones per episode, ignoring missing duration", () => {
    const progress = createVideoProgressTracker()
    const data = { player: "kodik", episode: 1 }
    for (const time of [1, 25, 30, 50, 75, 100]) progress("episode-1", time, 100, data)
    progress("episode-1", 30, NaN, data)
    progress("episode-1", 30, 0, data)
    progress("episode-2", 25, 100, { ...data, episode: 2 })
    expect(vi.mocked(trackEvent).mock.calls.map(call => call[1]?.position_pct)).toEqual([25, 50, 75, 25])
  })
  it("does not consume milestones before consent", () => {
    const progress = createVideoProgressTracker()
    vi.mocked(isAnalyticsEnabled).mockReturnValueOnce(false)
    progress("one", 25, 100, {})
    progress("one", 25, 100, {})
    expect(trackEvent).toHaveBeenCalledTimes(1)
  })
  it("tracks real native playback and completion without exposing media URLs", () => {
    const cleanup = installNativeVideoTracking()
    try {
      document.body.innerHTML = '<video data-analytics-player="hentai" data-analytics-episode="1" src="https://media.example/movie?token=secret"></video>'
      const video = document.querySelector("video")!
      for (const type of ["playing", "pause", "ended"]) video.dispatchEvent(new Event(type))
      expect(vi.mocked(trackEvent).mock.calls.map(call => call[0])).toEqual(["video_play", "video_pause", "video_complete"])
      expect(JSON.stringify(vi.mocked(trackEvent).mock.calls)).not.toMatch(/token|media.example/)
      cleanup()
      video.dispatchEvent(new Event("playing"))
      expect(trackEvent).toHaveBeenCalledTimes(3)
    } finally { cleanup() }
  })
})
