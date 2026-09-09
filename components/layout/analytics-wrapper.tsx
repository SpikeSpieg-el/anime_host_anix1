"use client"

/**
 * PostHog analytics integration (self-hosted on Coolify).
 *
 * Replaces the old `@vercel/analytics` snippet. Unlike Vercel Analytics, PostHog
 * gives us full product analytics that all live on our own server:
 *   - automatic pageviews ($pageview) on every client-side route change
 *   - autocapture of clicks on buttons/links/forms (no per-element wiring)
 *   - session recordings, funnels, retention, heatmaps, feature flags, A/B
 *   - UTM / referrer attribution per visitor
 *
 * Everything respects the existing cookie-consent gate: if the user hasn't
 * granted "analytics" we never initialise the SDK and no data leaves the
 * browser. Logged-in users are attached to the same internal, per-user profile
 * via `identify()` so analytics is consistent across devices.
 *
 * Required env vars (set in Coolify):
 *   NEXT_PUBLIC_POSTHOG_KEY  - project API key ("phc_...")
 *   NEXT_PUBLIC_POSTHOG_HOST - self-hosted origin, e.g. https://analytics.weeb-x.com
 */
import { useEffect, useRef } from "react"
import { usePathname } from "next/navigation"
import posthog from "posthog-js"
import { useConsent } from "@/components/providers/consent-provider"
import { useAuth } from "@/components/auth/auth-provider"

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST

const ENABLED = Boolean(POSTHOG_KEY && POSTHOG_HOST)

export function AnalyticsWrapper() {
  const { consent, hasConsent } = useConsent()
  const { user } = useAuth()
  const pathname = usePathname()

  const initializedRef = useRef(false)

  const consentKnown = hasConsent
  const analyticsGranted = Boolean(consent?.analytics)

  // 1. Init (or pause/resume) the SDK based on the consent the user granted.
  useEffect(() => {
    if (!ENABLED || !consentKnown) return

    if (analyticsGranted) {
      if (!initializedRef.current) {
        posthog.init(POSTHOG_KEY!, {
          api_host: POSTHOG_HOST!,
          // App Router: we send $pageview ourselves on route changes below.
          capture_pageview: false,
          capture_performance: true,
          // Auto-track every button / link / form click without manual wiring.
          autocapture: true,
          // Session recordings: mask all input values (passwords are always
          // masked regardless); we never record anything sensitive.
          session_recording: {
            maskAllInputs: true,
          },
          // Track everyone (only after they accepted the analytics cookie),
          // so unique-visitor / retention / funnel dashboards work for the
          // whole audience, not just logged-in users.
          person_profiles: "always",
          disable_session_recording: false,
        })
        initializedRef.current = true
      } else {
        posthog.opt_in_capturing()
      }
    } else if (initializedRef.current) {
      // User revoked "analytics" consent → stop capturing.
      posthog.opt_out_capturing()
    }
  }, [analyticsGranted, consentKnown])

  // 2. Pageview tracking on every client-side route change.
  const lastUrlRef = useRef<string | null>(null)
  useEffect(() => {
    if (!initializedRef.current || !analyticsGranted) return

    // Read the full URL from window only (client-side), so we never need
    // <Suspense> around useSearchParams during static prerendering.
    const url = typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : pathname

    if (lastUrlRef.current === url) return
    lastUrlRef.current = url

    posthog.capture("$pageview")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, analyticsGranted])

  // 3. Attach logged-in users to a stable internal profile (no PII, no email).
  useEffect(() => {
    if (!initializedRef.current || !analyticsGranted) return
    if (!user?.id) return

    const profileId = `supabase:${user.id}`
    if (posthog.get_distinct_id() !== profileId) {
      posthog.identify(profileId)
    }
  }, [user?.id, analyticsGranted])

  return null
}

/**
 * Send an explicit custom event (beyond autocaptured clicks). Use for
 * high-value actions PostHog can't infer — e.g. a gacha pull, PvP battle,
 * watch of a specific episode.
 *
 *   import { trackEvent } from "@/components/layout/analytics-wrapper"
 *   trackEvent("gacha_pull", { rarity: "UR" })
 */
export function trackEvent(
  event: string,
  properties?: Record<string, unknown>,
) {
  if (!ENABLED || !posthog.__loaded) return
  posthog.capture(event, properties)
}
