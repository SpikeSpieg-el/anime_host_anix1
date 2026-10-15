/**
 * Проверка: плавающий док мобильной навигации должен быть скрыт
 * в админке и присутствовать на обычных страницах.
 *
 * ПОЧЕМУ ОТДЕЛЬНЫЙ СКРИПТ, А НЕ ГЛАЗОМ
 *   Док рисуется только на мобильных (md:hidden), поэтому на десктопной
 *   ширине его не видно и проверить вручную невозможно. Здесь —
 *   реальная ширина 360px.
 */
import { chromium } from "playwright"

const BASE = (process.argv[2] || "http://127.0.0.1:3000").replace(/\/$/, "")

const CASES = [
  { route: "/admin", expectDock: false, label: "админка" },
  { route: "/admin/tutorial", expectDock: false, label: "туториал админки" },
  { route: "/", expectDock: true, label: "главная" },
]

const browser = await chromium.launch()
const context = await browser.newContext({
  viewport: { width: 360, height: 800 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
})
const page = await context.newPage()

let failures = 0

for (const testCase of CASES) {
  await page.goto(BASE + testCase.route, { waitUntil: "networkidle" })
  await page.waitForTimeout(1200)

  const result = await page.evaluate(() => {
    // Док — фиксированный блок у нижнего края с h-[68px] внутри.
    const candidates = [...document.querySelectorAll("div")].filter((element) => {
      const className = typeof element.className === "string" ? element.className : ""
      return (
        className.includes("fixed") &&
        className.includes("bottom-6") &&
        className.includes("md:hidden")
      )
    })
    const visible = candidates.filter((element) => {
      const rect = element.getBoundingClientRect()
      const style = getComputedStyle(element)
      return rect.height > 0 && style.display !== "none" && Number(style.opacity) > 0.05
    })

    // ScrollToTop тоже фиксированный — проверим, что он не висит в пустоте.
    const scrollToTop = document.querySelector('button[aria-label="Вернуться в начало страницы"]')
    const sctRect = scrollToTop ? scrollToTop.getBoundingClientRect() : null

    return {
      dockCount: visible.length,
      scrollToTopBottom: sctRect ? Math.round(window.innerHeight - sctRect.bottom) : null,
      scrollToTopVisible: sctRect ? getComputedStyle(scrollToTop).opacity !== "0" : null,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
    }
  })

  const ok = testCase.expectDock ? result.dockCount > 0 : result.dockCount === 0
  if (!ok) failures++

  console.log(`\n${testCase.label} (${testCase.route}) @360px`)
  console.log(`  док: ${result.dockCount} (ожидалось ${testCase.expectDock ? "есть" : "нет"}) ${ok ? "✅" : "❌"}`)
  console.log(`  ScrollToTop: ${result.scrollToTopVisible ? "виден" : "скрыт"}, отступ снизу ${result.scrollToTopBottom}px`)
  console.log(`  горизонталь: scrollWidth=${result.scrollWidth} innerWidth=${result.innerWidth} ${result.scrollWidth <= result.innerWidth + 1 ? "✅" : "❌"}`)
}

await context.close()
await browser.close()

console.log(`\n${failures === 0 ? "✅ Всё как задумано" : `❌ Расхождений: ${failures}`}`)
process.exit(failures === 0 ? 0 : 1)