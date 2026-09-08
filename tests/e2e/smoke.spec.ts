import { test, expect } from "@playwright/test"
import { SMOKE_PAGES } from "../registry/pages"

test.describe("smoke: public and optional pages load", () => {
  for (const pageInfo of SMOKE_PAGES) {
    test(`${pageInfo.name} (${pageInfo.smokePath})`, async ({ page }) => {
      const response = await page.goto(pageInfo.smokePath!, { waitUntil: "domcontentloaded" })
      expect(response, `no response for ${pageInfo.smokePath}`).toBeTruthy()
      const status = response!.status()
      expect(
        status,
        `${pageInfo.smokePath} returned ${status}`,
      ).toBeLessThan(500)
      await expect(page.locator("body")).toBeVisible()
    })
  }
})
