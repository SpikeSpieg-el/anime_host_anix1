import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { API_ROUTES, AUTH_REQUIRED_API } from "../registry/api-routes"
import { findApiRoutes, readExportedHttpMethods } from "../helpers/scan-app"

function routeFile(apiPath: string): string {
  const rel = apiPath
    .replace(/^\/api/, "app/api")
    .replace(/:([^/]+)/g, "[$1]")
  return join(process.cwd(), rel, "route.ts")
}

describe("API route contracts", () => {
  it("registered methods exist as exported handlers", () => {
    const mismatches: string[] = []
    for (const route of API_ROUTES) {
      let source: string
      try {
        source = readFileSync(routeFile(route.path), "utf-8")
      } catch {
        mismatches.push(`${route.path}: file missing`)
        continue
      }
      const exported = readExportedHttpMethods(source)
      for (const method of route.methods) {
        if (!exported.includes(method)) {
          mismatches.push(`${route.path}: declared ${method} but exported [${exported.join(", ")}]`)
        }
      }
    }
    expect(mismatches, mismatches.join("\n")).toEqual([])
  })

  it("auth-required routes mention Bearer or getUser / authorization", () => {
    const unprotected: string[] = []
    for (const route of AUTH_REQUIRED_API) {
      const source = readFileSync(routeFile(route.path), "utf-8")
      const looksGuarded =
        /authorization/i.test(source) ||
        /Bearer/.test(source) ||
        /getUser\(/.test(source) ||
        /getAuthenticatedUser/.test(source) ||
        /getMarketAuth/.test(source) ||
        /requireAdmin/.test(source) ||
        /isAdmin/.test(source) ||
        /admin/i.test(source)
      if (!looksGuarded) unprotected.push(route.path)
    }
    expect(
      unprotected,
      `Эндпоинты помечены как bearer/admin, но в коде нет проверки авторизации:\n${unprotected.join("\n")}`,
    ).toEqual([])
  })

  it("filesystem API set matches registry size", () => {
    expect(findApiRoutes().length).toBe(API_ROUTES.length)
  })
})
