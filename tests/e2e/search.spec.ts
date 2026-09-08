import { test, expect } from "@playwright/test"

test.describe("search / catalog query", () => {
  test("catalog accepts search query param", async ({ page }) => {
    const res = await page.goto("/catalog?search=Naruto")
    expect(res?.status()).toBeLessThan(500)
    await expect(page.locator("body")).toBeVisible()
  })

  test("search page loads", async ({ page }) => {
    const res = await page.goto("/search?q=one%20piece")
    expect(res?.status()).toBeLessThan(500)
  })
})
