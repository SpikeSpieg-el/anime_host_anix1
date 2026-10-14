import { act, createElement } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthProvider, useAuth } from "@/components/auth/auth-provider"
import { signOutLocalWithTimeout } from "@/lib/auth-session"

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(), signOut: vi.fn(), sync: vi.fn(), toast: vi.fn(),
  router: { replace: vi.fn(), refresh: vi.fn() },
  callback: null as null | ((event: string, session: any) => unknown),
}))
vi.mock("next/navigation", () => ({ useRouter: () => mocks.router }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: mocks.toast }) }))
vi.mock("@/lib/analytics", () => ({ AnalyticsEvent: { AUTH_SIGN_OUT: "logout" }, trackEvent: vi.fn() }))
vi.mock("@/lib/supabase", () => ({
  syncLocalDataToAccount: mocks.sync,
  supabase: { auth: {
    getSession: mocks.getSession, signOut: mocks.signOut,
    onAuthStateChange: (callback: typeof mocks.callback) => {
      mocks.callback = callback
      return { data: { subscription: { unsubscribe: vi.fn() } } }
    },
  } },
}))

let root: Root
let host: HTMLDivElement
let auth: ReturnType<typeof useAuth>
const session = { user: { id: "user-1" }, access_token: "token" }
function Consumer() { auth = useAuth(); return null }
async function mount() {
  await act(async () => { root.render(createElement(AuthProvider, null, createElement(Consumer))) })
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  vi.useFakeTimers()
  mocks.getSession.mockResolvedValue({ data: { session: null } })
  mocks.signOut.mockImplementation(async () => {
    mocks.callback?.("SIGNED_OUT", null)
    return { error: null }
  })
  mocks.sync.mockResolvedValue(undefined)
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ success: true, profile: { id: "user-1" } }) }))
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("auth lifecycle", () => {
  it("does not hold the auth callback open while guest data is syncing; logs out on the first attempt", async () => {
    await mount()
    mocks.sync.mockReturnValue(new Promise(() => {}))
    let result: unknown
    await act(async () => { result = mocks.callback!("SIGNED_IN", session) })
    expect(result).toBeUndefined()
    expect(mocks.sync).not.toHaveBeenCalled()
    await act(async () => { await vi.advanceTimersByTimeAsync(0) })
    expect(mocks.sync).toHaveBeenCalledWith("user-1")
    localStorage.setItem("sb-project-auth-token", "secret")
    localStorage.setItem("bookmarks_v1", "[]")
    const end = vi.fn()
    window.addEventListener("logout-end", end, { once: true })
    await act(async () => { await auth.signOut() })
    expect(mocks.signOut).toHaveBeenCalledTimes(1)
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" })
    expect(mocks.getSession).toHaveBeenCalledTimes(1) // No extra getSession on logout.
    expect(auth.user).toBeNull()
    expect(auth.session).toBeNull()
    expect(auth.loading || auth.sessionLoading || auth.profileLoading).toBe(false)
    expect(localStorage.getItem("sb-project-auth-token")).toBeNull()
    expect(localStorage.getItem("bookmarks_v1")).toBeNull()
    expect(end).toHaveBeenCalledOnce()
    expect(mocks.router.replace).toHaveBeenCalledWith("/")
  })

  it("ignores a profile response arriving after logout", async () => {
    let resolveProfile!: (value: Response) => void
    vi.mocked(fetch).mockReturnValue(new Promise(resolve => { resolveProfile = resolve }) as Promise<Response>)
    mocks.getSession.mockResolvedValue({ data: { session } })
    await mount()
    expect(auth.profileLoading).toBe(true)
    await act(async () => { await auth.signOut() })
    await act(async () => {
      resolveProfile({ ok: true, status: 200, json: async () => ({ success: true, profile: { id: "user-1", username: "old" } }) } as Response)
    })
    expect(auth.profile).toBeNull()
    expect(auth.profileLoading).toBe(false)
  })

  it("finishes loading and resets the client if logout never resolves", async () => {
    await mount()
    mocks.signOut.mockReturnValue(new Promise(() => {}))
    const replace = vi.spyOn(window.location, "replace").mockImplementation(() => {})
    localStorage.setItem("sb-project-auth-token", "secret")
    await act(async () => {
      const pending = auth.signOut()
      await vi.advanceTimersByTimeAsync(8000)
      await pending
    })
    expect(auth.loading || auth.sessionLoading || auth.profileLoading).toBe(false)
    expect(localStorage.getItem("sb-project-auth-token")).toBeNull()
    expect(replace).toHaveBeenCalledWith("/")
  })

  it("handles returned auth errors, not just rejected promises", async () => {
    const error = new Error("Network unavailable")
    await expect(signOutLocalWithTimeout({ signOut: async () => ({ error }) })).rejects.toBe(error)
    expect(vi.getTimerCount()).toBe(0)
  })

  it("cancels deferred sync on provider unmount", async () => {
    await mount()
    await act(async () => { mocks.callback!("SIGNED_IN", session) })
    await act(async () => { root.render(null) })
    await vi.advanceTimersByTimeAsync(0)
    expect(mocks.sync).not.toHaveBeenCalled()
  })
})
