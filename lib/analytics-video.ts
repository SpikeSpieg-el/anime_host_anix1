import { AnalyticsEvent, isAnalyticsEnabled, trackEvent, type UmamiEventData } from "@/lib/analytics"

/** Position milestones, not proof of time watched (the viewer may seek). */
export function createVideoProgressTracker() {
  const seen = new Map<string, number>()
  return (key: string, currentTime: number, duration: number, data: UmamiEventData) => {
    if (!isAnalyticsEnabled() || !Number.isFinite(duration) || duration <= 0 || !Number.isFinite(currentTime)) return
    const milestone = [75, 50, 25].find(percent => currentTime / duration * 100 >= percent)
    if (!milestone || milestone <= (seen.get(key) ?? 0)) return
    if (seen.size >= 100) seen.clear()
    seen.set(key, milestone)
    trackEvent(AnalyticsEvent.VIDEO_PROGRESS, { ...data, position_pct: milestone })
  }
}

/** Native videos only: events inside foreign iframes require that provider's API. */
export function installNativeVideoTracking(): () => void {
  const progress = createVideoProgressTracker()
  const ids = new WeakMap<HTMLVideoElement, number>()
  let nextId = 0
  const handler = (event: Event) => {
    const video = event.target
    if (!isAnalyticsEnabled() || !(video instanceof HTMLVideoElement) || video.closest('[data-track="off"]')) return
    const data = {
      player: video.dataset.analyticsPlayer || "native",
      episode: video.dataset.analyticsEpisode,
    }
    if (event.type === "timeupdate") {
      if (!ids.has(video)) ids.set(video, ++nextId)
      // The media URL is used only as a local key, NEVER sent (may contain signed tokens).
      progress(`${ids.get(video)}:${video.currentSrc || video.src}`, video.currentTime, video.duration, data)
    } else {
      const name = event.type === "ended" ? AnalyticsEvent.VIDEO_COMPLETE
        : event.type === "playing" ? AnalyticsEvent.VIDEO_PLAY : AnalyticsEvent.VIDEO_PAUSE
      if (event.type !== "pause" || !video.ended) trackEvent(name, data)
    }
  }
  const events = ["playing", "pause", "ended", "timeupdate"]
  for (const type of events) document.addEventListener(type, handler, true)
  return () => { for (const type of events) document.removeEventListener(type, handler, true) }
}
