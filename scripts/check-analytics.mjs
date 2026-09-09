#!/usr/bin/env node
/** Read-only browser smoke audit. Dry-run intercepts collection; --live sends tagged audit traffic. */
import { chromium, expect } from '@playwright/test'
import { parseArgs } from 'node:util'
import { randomUUID } from 'node:crypto'

const { values } = parseArgs({ options: {
  url: { type: 'string', default: 'https://weeb-x.com' },
  'website-id': { type: 'string', default: '9f20b8ce-f914-4cf9-a2b4-b638b4a93e43' },
  live: { type: 'boolean', default: false },
  headed: { type: 'boolean', default: false },
  help: { type: 'boolean', default: false },
} })
if (values.help) {
  console.log('npm run analytics:check -- [--url https://weeb-x.com] [--website-id UUID] [--live] [--headed]\nDefault: real website and tracker, collector mocked. --live sends a few events tagged audit:<run-id>. No login, purchases or account changes. Does NOT verify dashboard reports.')
  process.exit(0)
}
const runId = `audit:${randomUUID().slice(0, 8)}`
const base = new URL(values.url)
const browser = await chromium.launch({ headless: !values.headed })
const context = await browser.newContext({ locale: 'ru-RU', serviceWorkers: 'block' })
const page = await context.newPage()
const deliveries = []
const failures = []
let requests = 0
try {
  await page.route('**/api/send', async route => {
    const request = route.request()
    if (request.method() !== 'POST') return route.continue()
    const body = request.postDataJSON()
    if (!body?.payload?.website) return route.continue()
    requests++
    body.payload.tag = runId
    const record = { type: body.type, event: body.payload.name || 'pageview', url: body.payload.url, website: body.payload.website }
    if (!values.live) {
      deliveries.push({ ...record, mocked: true })
      return route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify({ cache: 'audit-mock', sessionId: 'audit-mock', visitId: 'audit-mock' }) })
    }
    try {
      const response = await route.fetch({ postData: JSON.stringify(body), timeout: 20_000 })
      const result = await response.json()
      const accepted = response.ok() && Boolean(result.cache && result.sessionId && result.visitId) && !result.disabled
      if (!accepted) failures.push({ ...record, status: response.status(), reason: result.message || (result.beep ? 'bot filtered' : 'no collection receipt') })
      deliveries.push({ ...record, accepted, status: response.status() })
      await route.fulfill({ response })
    } catch (error) {
      failures.push({ ...record, reason: String(error) })
      await route.abort()
    }
  })
  // A fresh context has no consent. Wait for the actual banner (hydration).
  await page.goto(base.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const accept = page.getByRole('button', { name: 'Принять все', exact: true })
  await expect(accept).toBeVisible({ timeout: 30_000 })
  expect(requests, 'No collection before consent').toBe(0)
  await expect(page.locator('#umami-script')).toHaveCount(0)
  await accept.click()
  await expect(page.locator('#umami-script')).toHaveAttribute('data-website-id', values['website-id'])
  await expect(page.locator('#umami-script')).toHaveAttribute('data-auto-track', 'false')
  await expect.poll(() => deliveries.filter(d => d.event === 'pageview').length, { timeout: 30_000 }).toBe(1)

  // A harmless DOM-only diagnostic exercises the site's actual delegated listener.
  await page.evaluate(() => {
    const button = document.createElement('button')
    button.id = 'analytics-audit-button'
    button.textContent = 'Analytics diagnostic'
    button.setAttribute('data-umami-event', 'analytics_diagnostic')
    button.style.cssText = 'position:fixed;top:0;left:0;z-index:2147483647'
    document.body.appendChild(button)
  })
  await page.locator('#analytics-audit-button').click()
  await expect.poll(() => deliveries.filter(d => d.event === 'analytics_diagnostic').length).toBe(1)
  await page.evaluate(() => document.getElementById('analytics-audit-button')?.remove())

  // Real Next links: routes, back/forward, no duplicate initial pageview on SPA navigation.
  await page.locator('a[href="/catalog"]:visible').first().click()
  await expect(page).toHaveURL(new URL('/catalog', base).href)
  await expect.poll(() => deliveries.filter(d => d.event === 'pageview').length).toBe(2)
  await page.goBack()
  await expect.poll(() => deliveries.filter(d => d.event === 'pageview').length).toBe(3)
  await page.goForward()
  await expect.poll(() => deliveries.filter(d => d.event === 'pageview').length).toBe(4)
  await page.evaluate(() => history.pushState({}, '', '/catalog?page=2'))
  await expect.poll(() => deliveries.filter(d => d.event === 'pageview').length).toBe(5)
  await page.goBack()
  await expect.poll(() => deliveries.filter(d => d.event === 'pageview').length).toBe(6)
  expect(deliveries.every(d => d.website === values['website-id'])).toBe(true)
  expect(failures, 'Collector must return sessionId/visitId/cache, not merely HTTP 200').toEqual([])
  console.log(JSON.stringify({ mode: values.live ? 'live collector receipts' : 'dry-run (NO real collection verified)', runId, deliveries, dashboardVerified: false }, null, 2))
} catch (error) {
  console.error(JSON.stringify({ mode: values.live ? 'live' : 'dry-run', runId, failures, deliveries, error: String(error), dashboardVerified: false }, null, 2))
  process.exitCode = 1
} finally {
  await browser.close()
}
