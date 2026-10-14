import { act, createElement, type ReactNode } from "react"
import { createRoot, type Root } from "react-dom/client"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AuthModal } from "@/components/auth/auth-modal"

const mocks = vi.hoisted(() => ({
  setSession: vi.fn(), update: vi.fn(), eq: vi.fn(), refreshProfile: vi.fn(), close: vi.fn(),
  avatarProps: null as any,
}))
vi.mock("@/lib/supabase", () => ({ supabase: {
  auth: { setSession: mocks.setSession },
  from: () => ({ update: mocks.update }),
} }))
vi.mock("@/components/auth/auth-provider", () => ({ useAuth: () => ({ refreshProfile: mocks.refreshProfile }) }))
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock("@/components/providers/consent-provider", () => ({ useConsent: () => ({ hasConsent: false }) }))
vi.mock("@/lib/analytics", () => ({ AnalyticsEvent: {}, trackEvent: vi.fn(), identifyUser: vi.fn() }))
vi.mock("@/lib/guest-hooks", () => ({ consumeGuestHookAuthSource: () => null }))
vi.mock("@/components/auth/anime-slider-captcha", () => ({ AnimeSliderCaptcha: ({ onSuccess }: any) => createElement("button", { onClick: () => onSuccess("captcha") }, "Solve") }))
vi.mock("@/components/auth/avatar-upload", () => ({ AvatarUpload: (props: any) => {
  mocks.avatarProps = props
  return createElement("div", { "data-testid": "avatar" }, "Аватар")
} }))
vi.mock("@/components/ui/dialog", () => {
  const Wrap = ({ children }: { children: ReactNode }) => createElement("div", null, children)
  return { Dialog: ({ open, children }: any) => open ? createElement(Wrap, null, children) : null, DialogContent: Wrap, DialogHeader: Wrap, DialogTitle: Wrap, DialogTrigger: Wrap, DialogDescription: Wrap }
})
let root: Root
let host: HTMLDivElement
async function click(text: string) {
  const button = Array.from(host.querySelectorAll("button")).find(el => el.textContent?.trim() === text)
  expect(button, text).toBeTruthy()
  await act(async () => { button!.click() })
}
async function input(id: string, value: string) {
  const field = host.querySelector<HTMLInputElement>(`#${id}`)!
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(field, value)
    field.dispatchEvent(new Event("input", { bubbles: true }))
  })
}
async function register(payload = { user: { id: "new-user" }, access_token: "token", refresh_token: "refresh" } as any) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => payload }))
  await act(async () => { root.render(createElement<NonNullable<Parameters<typeof AuthModal>[0]>>(AuthModal, { isOpen: true, initialMode: "register", onClose: mocks.close })) })
  await click("Solve")
  await click("Продолжить")
  await input("auth-email", "test@example.com")
  await input("auth-password", "12345678")
  await act(async () => { host.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })) })
}
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true)
  mocks.avatarProps = null
  mocks.setSession.mockResolvedValue({ error: null })
  mocks.update.mockReturnValue({ eq: mocks.eq })
  mocks.eq.mockResolvedValue({ error: null })
  mocks.refreshProfile.mockResolvedValue(undefined)
  host = document.createElement("div")
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

describe("registration profile step", () => {
  it("offers nickname and avatar after credentials, and saves the trimmed nickname", async () => {
    await register()
    expect(host.textContent).toContain("Настройте профиль")
    expect(host.textContent).toContain("настройках аккаунта")
    expect(mocks.avatarProps).toMatchObject({ userId: "new-user", autoSave: true })
    expect(mocks.close).not.toHaveBeenCalled()
    await input("auth-nickname", "  Spike   Spiegel  ")
    await click("Сохранить и продолжить")
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ username: "Spike Spiegel" }))
    expect(mocks.eq).toHaveBeenCalledWith("id", "new-user")
    expect(mocks.refreshProfile).toHaveBeenCalled()
    expect(mocks.close).toHaveBeenCalledWith(false)
  })
  it("can skip both fields without writing a nickname", async () => {
    await register()
    await click("Пропустить — задам позже")
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.close).toHaveBeenCalledWith(false)
  })
  it("allows an avatar-only profile and refreshes it", async () => {
    await register()
    await act(async () => { mocks.avatarProps.onAvatarChange("https://example.com/avatar.jpg") })
    expect(mocks.avatarProps.currentAvatarUrl).toBe("https://example.com/avatar.jpg")
    await click("Сохранить и продолжить")
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.close).toHaveBeenCalledWith(false)
  })
  it("keeps the step open for invalid names and failed saves, allowing retry or skip", async () => {
    await register()
    await input("auth-nickname", "A")
    await click("Сохранить и продолжить")
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("от 2 до 24")
    expect(mocks.update).not.toHaveBeenCalled()
    await input("auth-nickname", "Spike")
    mocks.eq.mockResolvedValueOnce({ error: new Error("offline") })
    await click("Сохранить и продолжить")
    expect(host.querySelector('[role="alert"]')?.textContent).toContain("Не удалось сохранить ник")
    expect(mocks.close).not.toHaveBeenCalled()
    await click("Сохранить и продолжить")
    expect(mocks.close).toHaveBeenCalledWith(false)
  })
  it("does not close the step during avatar upload", async () => {
    await register()
    await act(async () => { mocks.avatarProps.onBusyChange(true) })
    await click("Пропустить — задам позже")
    expect(mocks.close).not.toHaveBeenCalled()
    await act(async () => { mocks.avatarProps.onBusyChange(false) })
    await click("Пропустить — задам позже")
    expect(mocks.close).toHaveBeenCalledWith(false)
  })
  it("explains email confirmation without attempting unauthenticated profile writes", async () => {
    await register({ id: "new-user", email: "test@example.com" })
    expect(host.textContent).toContain("подтвердите регистрацию")
    expect(host.textContent).toContain("Ник и аватар можно добавить")
    expect(mocks.setSession).not.toHaveBeenCalled()
    expect(mocks.avatarProps).toBeNull()
    expect(mocks.update).not.toHaveBeenCalled()
  })
})
