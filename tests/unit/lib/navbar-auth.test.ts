import { act, createElement, useEffect } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { Navbar } from "@/components/layout/navbar"

const state = vi.hoisted(() => ({
  path: "/", user: null as null | { id: string },
  mounts: 0, unmounts: 0,
  router: { push: vi.fn(), refresh: vi.fn() },
}))
vi.mock("next/navigation", () => ({ useRouter: () => state.router, usePathname: () => state.path }))
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ user: state.user, sessionLoading: false }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/hooks/use-episode-updates", () => ({ useEpisodeUpdates: () => ({ updates: [] }) }))
vi.mock("@/components/catalog/search-suggestions", () => ({ SearchSuggestions: () => null }))
vi.mock("@/components/watch/episode-update-badge", () => ({ EpisodeUpdateBadge: () => null }))
vi.mock("@/components/shared/theme-toggle", () => ({ ThemeToggle: () => null }))
vi.mock("@/components/tv/tv-mode-toggle", () => ({ TVModeToggle: () => null }))
vi.mock("@/components/shared/performance-toggle", () => ({ PerformanceToggle: () => null }))
vi.mock("@/components/shared/chibi-toggle", () => ({ ChibiToggle: () => null }))
vi.mock("@/components/providers/account-stats-recorder", () => ({ activityRecorder: { startSession: vi.fn(), flushSession: vi.fn() } }))
vi.mock("@/lib/analytics", () => ({ AnalyticsEvent: {}, trackEvent: vi.fn() }))
vi.mock("@/components/auth/auth-modal", () => ({ AuthModal: ({ isOpen }: any) => {
  useEffect(() => { state.mounts++; return () => { state.unmounts++ } }, [])
  return isOpen ? createElement("div", { "data-testid": "auth" }, "Profile onboarding") : null
} }))
let root: Root
let host: HTMLDivElement
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  Object.assign(state, { path: "/", user: null, mounts: 0, unmounts: 0 })
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

describe("registration dialog lifetime", () => {
  for (const path of ["/", "/battle", "/pvp"]) {
    it(`keeps the same open dialog mounted after SIGNED_IN on ${path}`, async () => {
      state.path = path
      await act(async () => { root.render(createElement(Navbar)) })
      await act(async () => {
        window.dispatchEvent(new CustomEvent("open-auth-modal", { detail: { mode: "register" } }))
      })
      expect(host.querySelector('[data-testid="auth"]')).not.toBeNull()
      const mounts = state.mounts
      const unmounts = state.unmounts
      state.user = { id: "new-user" }
      await act(async () => { root.render(createElement(Navbar)) })
      expect(host.querySelector('[data-testid="auth"]')).not.toBeNull()
      expect(state.mounts).toBe(mounts)
      expect(state.unmounts).toBe(unmounts)
    })
  }
})
