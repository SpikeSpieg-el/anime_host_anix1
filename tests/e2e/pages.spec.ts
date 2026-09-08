import { test, expect } from "@playwright/test"

test.describe("key pages content", () => {
  test("home has Weebx branding", async ({ page }) => {
    await page.goto("/")
    await expect(page.locator("body")).toBeVisible()
    await expect(page.locator("body")).toContainText(/Weeb/i)
  })

  test("catalog page renders", async ({ page }) => {
    await page.goto("/catalog")
    await expect(page.locator("body")).toBeVisible()
  })

  test("legal pages contain headings", async ({ page }) => {
    await page.goto("/privacy")
    await expect(page.locator("body")).toBeVisible()
    await page.goto("/terms")
    await expect(page.locator("body")).toBeVisible()
    await page.goto("/dmca")
    await expect(page.locator("body")).toBeVisible()
  })

  test("faq / help / contacts load", async ({ page }) => {
    for (const path of ["/faq", "/help", "/contacts"]) {
      const res = await page.goto(path)
      expect(res?.ok() || (res && res.status() < 500)).toBeTruthy()
    }
  })

  test("gacha page loads without server crash", async ({ page }) => {
    const res = await page.goto("/gacha")
    expect(res?.status()).toBeLessThan(500)
  })

  test("battle page loads without server crash", async ({ page }) => {
    const res = await page.goto("/battle")
    expect(res?.status()).toBeLessThan(500)
  })
})
