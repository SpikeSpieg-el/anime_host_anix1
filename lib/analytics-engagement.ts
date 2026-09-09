import { AnalyticsEvent, trackEvent } from "@/lib/analytics"

/** Each route owns its clock. Only visible time is counted; each flush sends a delta. */
export function installEngagementTracking(url: string): () => void {
  let startedAt: number | null = document.visibilityState === "hidden" ? null : Date.now()
  let elapsed = 0
  let maxScroll = 0
  const scroll = () => {
    const scrollable = document.documentElement.scrollHeight - window.innerHeight
    maxScroll = Math.max(maxScroll, scrollable > 0
      ? Math.min(100, Math.max(0, Math.round(window.scrollY / scrollable * 100))) : 100)
  }
  const pause = () => {
    if (startedAt !== null) elapsed += Math.max(0, Date.now() - startedAt)
    startedAt = null
  }
  const flush = () => {
    pause()
    if (elapsed >= 5000) {
      trackEvent(AnalyticsEvent.ENGAGEMENT, {
        path: url, seconds: Math.floor(elapsed / 1000), max_scroll_pct: maxScroll,
      }, url)
      elapsed = 0
    }
  }
  const resume = () => {
    if (startedAt === null && document.visibilityState !== "hidden") startedAt = Date.now()
  }
  const visibility = () => document.visibilityState === "hidden" ? flush() : resume()
  scroll()
  window.addEventListener("scroll", scroll, { passive: true })
  window.addEventListener("resize", scroll, { passive: true })
  window.addEventListener("pagehide", flush)
  window.addEventListener("pageshow", resume)
  document.addEventListener("visibilitychange", visibility)
  return () => {
    flush()
    window.removeEventListener("scroll", scroll)
    window.removeEventListener("resize", scroll)
    window.removeEventListener("pagehide", flush)
    window.removeEventListener("pageshow", resume)
    document.removeEventListener("visibilitychange", visibility)
  }
}
