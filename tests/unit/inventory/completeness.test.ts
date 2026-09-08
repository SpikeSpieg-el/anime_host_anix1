import { describe, expect, it } from "vitest"
import { PAGES } from "../../registry/pages"
import { API_ROUTES } from "../../registry/api-routes"
import { findAppPages, findApiRoutes } from "../../helpers/scan-app"

describe("page inventory completeness", () => {
  const discovered = findAppPages()
  const registered = PAGES.map((p) => p.route).sort()

  it("every page.tsx is registered in tests/registry/pages.ts", () => {
    const missing = discovered.filter((route) => !registered.includes(route))
    expect(
      missing,
      `Новые страницы без записи в реестре: ${missing.join(", ")}\n` +
        "Добавьте их в tests/registry/pages.ts и покройте smoke/E2E.",
    ).toEqual([])
  })

  it("registry does not point at deleted pages", () => {
    const stale = registered.filter((route) => !discovered.includes(route))
    expect(
      stale,
      `В реестре есть страницы, которых больше нет: ${stale.join(", ")}`,
    ).toEqual([])
  })

  it("smoke paths are unique", () => {
    const paths = PAGES.map((p) => p.smokePath).filter(Boolean)
    expect(new Set(paths).size).toBe(paths.length)
  })
})

describe("API inventory completeness", () => {
  const discovered = findApiRoutes()
  const registered = API_ROUTES.map((r) => r.path).sort()

  it("every app/api/**/route.ts is registered", () => {
    const missing = discovered.filter((route) => !registered.includes(route))
    expect(
      missing,
      `Новые API без записи в реестре: ${missing.join(", ")}\n` +
        "Добавьте их в tests/registry/api-routes.ts (path, methods, auth).",
    ).toEqual([])
  })

  it("registry does not point at deleted API routes", () => {
    const stale = registered.filter((route) => !discovered.includes(route))
    expect(
      stale,
      `В реестре есть API, которых больше нет: ${stale.join(", ")}`,
    ).toEqual([])
  })

  it("API paths are unique", () => {
    expect(new Set(registered).size).toBe(registered.length)
  })

  it("every route declares at least one HTTP method", () => {
    for (const route of API_ROUTES) {
      expect(route.methods.length, route.path).toBeGreaterThan(0)
    }
  })
})
