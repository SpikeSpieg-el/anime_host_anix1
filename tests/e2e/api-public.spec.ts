import { test, expect } from "@playwright/test"

const PUBLIC_GET = [
  "/api/home-data",
  "/api/region",
  "/api/anime/catalog?limit=1",
  "/api/market/listings",
  "/api/push/vapid-public-key",
]

test.describe("public API smoke", () => {
  for (const path of PUBLIC_GET) {
    test(`GET ${path} is not 5xx`, async ({ request }) => {
      const res = await request.get(path)
      expect(res.status(), await res.text().catch(() => "")).toBeLessThan(500)
    })
  }

  test("protected API rejects anonymous POST", async ({ request }) => {
    const res = await request.post("/api/coins", {
      data: { operation: "add", amount: 1 },
    })
    expect([401, 403, 400, 405]).toContain(res.status())
  })
})
