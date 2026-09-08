import { afterEach, vi } from "vitest"

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
  if (typeof localStorage !== "undefined") localStorage.clear()
  if (typeof sessionStorage !== "undefined") sessionStorage.clear()
})

if (typeof window !== "undefined" && !window.crypto?.randomUUID) {
  Object.defineProperty(window.crypto, "randomUUID", {
    value: () => "00000000-0000-4000-8000-000000000000",
    configurable: true,
  })
}
