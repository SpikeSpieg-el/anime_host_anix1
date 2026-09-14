import { act, createElement, StrictMode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AnalyticsWrapper } from "@/components/layout/analytics-wrapper"
import { UMAMI_SCRIPT_TAG_ID, unloadAnalyticsScript } from "@/lib/analytics"

const state = vi.hoisted(() => ({
  loading: false,
  granted: true,
  path: "/",
  search: "",
  user: null as { id: string } | null,
  profile: null as { username?: string; referred_by?: string } | null,
}))
vi.mock("next/navigation", () => ({ usePathname: () => state.path, useSearchParams: () => new URLSearchParams(state.search) }))
vi.mock("@/components/providers/consent-provider", () => ({ useConsent: () => ({ hasConsent: state.granted, consent: { analytics: state.granted } }) }))
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ user: state.user, sessionLoading: state.loading, profile: state.profile }) }))

let root: Root
let host: HTMLDivElement
let payloads: Record<string, unknown>[]
let identify: ReturnType<typeof vi.fn>
async function render() {
  await act(async () => { root.render(createElement(StrictMode, null, createElement(AnalyticsWrapper))) })
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.stubEnv("NEXT_PUBLIC_UMAMI_WEBSITE_ID", "11111111-2222-3333-4444-555555555555")
  vi.stubEnv("NEXT_PUBLIC_UMAMI_DOMAINS", "")
  Object.assign(state, { loading: false, granted: true, path: "/", search: "", user: null, profile: null })
  unloadAnalyticsScript()
  document.getElementById(UMAMI_SCRIPT_TAG_ID)?.remove()
  payloads = []
  identify = vi.fn(() => Promise.resolve())
  window.umami = {
    track: build => { payloads.push((build as Function)({ hostname: "localhost", website: "test" })); return Promise.resolve() },
    identify,
  }
  const append = document.head.appendChild.bind(document.head)
  vi.spyOn(document.head, "appendChild").mockImplementation(<T extends Node>(node: T): T => {
    if (node instanceof HTMLScriptElement) node.type = "application/json"
    return append(node)
  })
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  unloadAnalyticsScript()
  document.getElementById(UMAMI_SCRIPT_TAG_ID)?.remove()
  delete window.umami
  host.remove()
  vi.unstubAllGlobals()
})

describe("AnalyticsWrapper integration", () => {
  it("single initial pageview under StrictMode, query changes and back/forward", async () => {
    await render()
    await act(async () => { document.getElementById(UMAMI_SCRIPT_TAG_ID)!.dispatchEvent(new Event("load")) })
    await render()
    state.path = "/catalog"; await render()
    state.search = "page=2"; await render()
    state.search = ""; await render() // back
    state.search = "page=2"; await render() // forward
    expect(payloads.map(p => p.url)).toEqual(["/", "/catalog", "/catalog?page=2", "/catalog", "/catalog?page=2"])
  })
  it("waits for restored auth before the first pageview (retention identity)", async () => {
    state.loading = true
    await render()
    await act(async () => { document.getElementById(UMAMI_SCRIPT_TAG_ID)!.dispatchEvent(new Event("load")) })
    expect(payloads).toHaveLength(0)
    state.loading = false
    state.user = { id: "returning-user" }
    await render()
    expect(payloads).toHaveLength(1)
    expect(payloads[0].id).toBe("supabase:returning-user")
  })
  it("does not load before consent and identifies the user before the first permitted pageview", async () => {
    state.granted = false
    state.user = { id: "user-1" }
    await render()
    expect(document.getElementById(UMAMI_SCRIPT_TAG_ID)).toBeNull()
    state.granted = true
    await render()
    await act(async () => { document.getElementById(UMAMI_SCRIPT_TAG_ID)!.dispatchEvent(new Event("load")) })
    expect(payloads).toHaveLength(1)
    expect(payloads[0].id).toBe("supabase:user-1")
    // Logout: the device becomes a stable guest, not an anonymous reset.
    state.user = null
    await render()
    const guestId = identify.mock.lastCall?.[0] as string
    expect(guestId).toMatch(/^guest:/)
    expect(identify.mock.lastCall?.[1]).toMatchObject({ user_type: "guest" })
    state.granted = false
    await render()
    state.path = "/catalog"; await render()
    expect(payloads).toHaveLength(1)
    state.granted = true
    await render()
    expect(payloads).toHaveLength(2)
    expect(payloads[1].id).toBe(guestId)
  })
  it("identifies a guest with properties before the first pageview, then re-identifies on login", async () => {
    await render()
    await act(async () => { document.getElementById(UMAMI_SCRIPT_TAG_ID)!.dispatchEvent(new Event("load")) })
    // Guest visit: stable id + properties, pageview carries the guest id.
    const guestId = identify.mock.calls[0][0] as string
    expect(guestId).toMatch(/^guest:/)
    expect(identify.mock.calls[0][1]).toMatchObject({ user_type: "guest", landing_page: "/" })
    expect(payloads).toHaveLength(1)
    expect(payloads[0].id).toBe(guestId)
    // Login: switch to the Supabase identity, minimal properties first…
    state.user = { id: "user-1" }
    await render()
    expect(identify).toHaveBeenLastCalledWith("supabase:user-1", expect.objectContaining({ user_type: "registered" }))
    // …then re-identify once the profile loads (Umami merges by key).
    state.profile = { username: "weeb" }
    await render()
    expect(identify).toHaveBeenLastCalledWith("supabase:user-1", expect.objectContaining({ user_type: "registered", username: "weeb" }))
  })
})
