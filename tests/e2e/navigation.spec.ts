import { test, expect } from "@playwright/test"

test.describe("navigation", () => {
  test("home links to catalog", async ({ page }) => {
    await page.goto("/")
    const catalog = page.locator('a[href*="/catalog"]').first()
    await expect(catalog).toBeVisible({ timeout: 15_000 })
    await catalog.click()
    await expect(page).toHaveURL(/catalog/)
  })

  test("404 page offers way home", async ({ page }) => {
    const res = await page.goto("/this-page-definitely-does-not-exist-wx")
    expect(res?.status()).toBe(404)
    await expect(page.locator("body")).toContainText(/не найдена|404/i)
    const home = page.locator('a[href="/"]').first()
    await expect(home).toBeVisible()
  })
})
