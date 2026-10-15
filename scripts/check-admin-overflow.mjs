/**
 * Проверка админки на переполнение по горизонтали.
 *
 * ЗАЧЕМ
 *   Аудит вёрстки на глаз пропускает мелочи, а на телефоне одна
 *   непрокручиваемая таблица или один `w-fit` внутри grid делают всю
 *   страницу непригодной: появляется горизонтальный скролл, а
 *   `position: sticky` внутри перестаёт работать.
 *
 * ЧТО ДЕЛАЕТ
 *   Для каждого маршрута на нескольких ширинах (360 / 390 / 430 / 768):
 *     - сравнивает document.scrollWidth с window.innerWidth;
 *     - перечисляет элементы, чей правый край выходит за вьюпорт;
 *     - проверяет, не перекрыт ли нижний контент плавающим доком навигации.
 *
 * ЗАПУСК
 *   node scripts/check-admin-overflow.mjs [baseUrl]
 *   По умолчанию http://127.0.0.1:3111
 *
 *   Маршруты за входом (вкладки) проверь отдельно: экспортируй SESSION,
 *   либо запусти с указанием своей авторизованной сессии.
 */
import { chromium } from "playwright"

const BASE = (process.argv[2] || "http://127.0.0.1:3111").replace(/\/$/, "")

// Публичные страницы админки: экран входа и гейт туториала.
const ROUTES = ["/admin", "/admin/tutorial"]

const WIDTHS = [360, 390, 430, 768]

const PROBE = () => {
  const vw = window.innerWidth
  const doc = document.documentElement

  // Элементы, чей правый край выходит за вьюпорт.
  const overflowing = []
  for (const el of document.querySelectorAll('body *')) {
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 && rect.height === 0) continue
    if (rect.right > vw + 1) {
      overflowing.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.getAttribute('class') || '').slice(0, 110),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
      })
    }
  }

  // Нижний док навигации: перекрывает ли он контент внизу страницы?
  let dock = null
  const nav = document.querySelector('nav.fixed, header.fixed, [class*="bottom-6"][class*="fixed"]')
  if (nav) {
    const r = nav.getBoundingClientRect()
    dock = { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) }
  }

  // Нижняя граница последнего элемента страницы — нужна, чтобы понять,
  // уходит ли контент под док.
  let lastBottom = 0
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (r.height > 0 && r.width > 0) {
      lastBottom = Math.max(lastBottom, r.bottom + window.scrollY)
    }
  }

  return {
    vw,
    scrollWidth: doc.scrollWidth,
    horizontalOverflow: doc.scrollWidth - vw,
    bodyOverflowX: getComputedStyle(document.body).overflowX,
    overflowing: overflowing.slice(0, 12),
    overflowingCount: overflowing.length,
    dock,
    lastBottom: Math.round(lastBottom),
  }
}

let failures = 0

const browser = await chromium.launch()

for (const width of WIDTHS) {
  const context = await browser.newContext({
    viewport: { width, height: 800 },
    deviceScaleFactor: 2,
    isMobile: width < 768,
    hasTouch: width < 768,
  })
  const page = await context.newPage()

  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "networkidle" })
    await page.waitForTimeout(600)

    const result = await page.evaluate(PROBE)
    const bad = result.horizontalOverflow > 1

    console.log(`\n${route} @ ${width}px`)
    console.log(`  scrollWidth=${result.scrollWidth} innerWidth=${result.vw} overflowX=${result.horizontalOverflow} body[overflow-x]=${result.bodyOverflowX}`)

    if (bad) {
      failures++
      console.log(`  ❌ ГОРИЗОНТАЛЬНОЕ ПЕРЕПОЛНЕНИЕ (+${result.horizontalOverflow}px), элементов: ${result.overflowingCount}`)
      for (const el of result.overflowing) {
        console.log(`     <${el.tag}> right=${el.right} w=${el.width} .${el.cls}`)
      }
    } else {
      console.log(`  ✅ переполнения нет`)
    }

    if (result.dock) {
      console.log(`  док: top=${result.dock.top} height=${result.dock.height}; контент до y=${result.lastBottom}`)
    }
  }

  if (width === 360) {
    await page.goto(BASE + "/admin", { waitUntil: "networkidle" })
    await page.waitForTimeout(600)
    await page.screenshot({ path: "admin-360.png", fullPage: true })
    console.log("\n  📸 admin-360.png")
  }

  await context.close()
}

await browser.close()

console.log(`\n${failures === 0 ? "✅ Всё чисто" : `❌ Проблемных сочетаний: ${failures}`}`)
process.exit(failures === 0 ? 0 : 1)