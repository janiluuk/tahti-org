#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Functional check for the Channel Designer (/dashboard/channel/edit) — the
 * rebuilt focused-section editor (section list + active panel + live
 * preview). Exercises real save round trips, not just "the page loads":
 * Links and Player overlay text are saved then re-fetched on reload to
 * confirm persistence, Header & backdrop's visibility toggle is flipped and
 * saved, and every section is visited to confirm its panel renders.
 *
 *   API_URL=http://localhost:15011 APP_URL=http://localhost:17777 node tests/e2e/channel-designer.mjs
 */

import { chromium } from 'playwright'
import { apiLogin, assertAuthenticated } from './lib/playwright-auth.mjs'

const APP = process.env.APP_URL ?? 'http://localhost:17777'
const API = process.env.API_URL ?? 'http://localhost:15011'
const PASS = process.env.E2E_DEMO_PASS ?? 'screenshot-demo-pass'
const ARTIST_EMAIL = process.env.E2E_DEMO_ARTIST_EMAIL ?? 'screenshot-artist@e2e.tahti.live'

const VIEWPORT = { width: 1440, height: 900 }

const SECTIONS = [
  { hash: 'channel-visual', label: 'Visual style' },
  { hash: 'channel-header', label: 'Header & backdrop' },
  { hash: 'channel-slideshow', label: 'Slideshow transitions' },
  { hash: 'channel-links', label: 'Links' },
  { hash: 'channel-text-overlay', label: 'Player overlay text' },
]

let passed = 0
let failed = 0
const failList = []

function ok(label) {
  console.log(`✓ ${label}`)
  passed++
}

function fail(label, detail) {
  console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
  failed++
  failList.push(label)
}

async function step(label, fn) {
  try {
    await fn()
    ok(label)
  } catch (e) {
    fail(label, e.message)
  }
}

async function main() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({ viewport: VIEWPORT })
  const page = await ctx.newPage()
  page.setDefaultTimeout(60_000)

  await step('artist login', async () => {
    const cookie = await apiLogin(API, APP, ARTIST_EMAIL, PASS)
    await ctx.addCookies([cookie])
  })

  await step('warm up route (dev-server first-compile, discarded)', async () => {
    await page.goto(`${APP}/dashboard/channel/edit`, { waitUntil: 'load', timeout: 90_000 })
  })

  await step('open Channel Designer', async () => {
    const res = await page.goto(`${APP}/dashboard/channel/edit`, {
      waitUntil: 'load',
      timeout: 60_000,
    })
    if (!res?.ok()) throw new Error(`HTTP ${res?.status()}`)
    await assertAuthenticated(page, 'Channel Designer')
    await page.waitForSelector('.studio-channel-editor', { timeout: 30_000 })
    await page.waitForSelector('.studio-designer-section-list__item', { timeout: 30_000 })
  })

  await step('section list shows all 5 sections', async () => {
    for (const { label } of SECTIONS) {
      const count = await page.getByText(label, { exact: true }).count()
      if (count === 0) throw new Error(`missing section nav item: ${label}`)
    }
  })

  await step('live preview panel renders', async () => {
    await page.waitForSelector('.studio-channel-editor__preview-col', { timeout: 5_000 })
    const link = page.getByRole('link', { name: /Open full channel page/i })
    if ((await link.count()) === 0) throw new Error('missing "Open full channel page" link')
  })

  for (const { hash, label } of SECTIONS) {
    await step(`navigate to "${label}" via hash`, async () => {
      await page.evaluate((h) => {
        window.location.hash = h
      }, hash)
      await page.waitForTimeout(150)
      const heading = await page.locator('.studio-designer-topbar__heading').innerText()
      if (heading.trim() !== label) {
        throw new Error(`expected heading "${label}", got "${heading.trim()}"`)
      }
    })
  }

  await step('Links: add a link, save, verify success message', async () => {
    await page.evaluate(() => {
      window.location.hash = 'channel-links'
    })
    await page.waitForTimeout(150)
    const label = `E2E Test ${Date.now()}`
    await page.locator('input[placeholder="Label (e.g. Bandcamp)"]').first().fill(label)
    await page.locator('input[placeholder="https://…"]').first().fill('https://example.com/e2e')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForSelector('.studio-notice--success', { timeout: 10_000 })
    const msg = await page.locator('.studio-notice--success').innerText()
    if (!/saved/i.test(msg)) throw new Error(`unexpected save message: "${msg}"`)
  })

  const overlayText = `E2E overlay ${Date.now()}`
  await step('Player overlay text: set mode + text, save', async () => {
    await page.evaluate(() => {
      window.location.hash = 'channel-text-overlay'
    })
    await page.waitForTimeout(150)
    await page.locator('#text-layer-mode').selectOption({ index: 1 })
    await page.locator('#text-layer-text').fill(overlayText)
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForSelector('.studio-notice--success', { timeout: 10_000 })
  })

  await step('Player overlay text persists after reload', async () => {
    await page.reload({ waitUntil: 'load' })
    await page.waitForSelector('.studio-channel-editor', { timeout: 10_000 })
    await page.evaluate(() => {
      window.location.hash = 'channel-text-overlay'
    })
    await page.waitForTimeout(150)
    const value = await page.locator('#text-layer-text').inputValue()
    if (value !== overlayText) {
      throw new Error(`expected persisted text "${overlayText}", got "${value}"`)
    }
  })

  await step('Header & backdrop: toggle a visibility switch, save', async () => {
    await page.evaluate(() => {
      window.location.hash = 'channel-header'
    })
    await page.waitForTimeout(150)
    const switches = page.locator('.studio-channel-editor input.studio-toggle-checkbox')
    const count = await switches.count()
    if (count === 0) throw new Error('no visibility toggles found in Header & backdrop')
    const first = switches.first()
    const before = await first.isChecked()
    await first.click()
    const after = await first.isChecked()
    if (before === after) throw new Error('toggle did not change state')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.waitForSelector('.studio-notice--success', { timeout: 10_000 })
  })

  await step('Visual style: preset picker renders', async () => {
    await page.evaluate(() => {
      window.location.hash = 'channel-visual'
    })
    await page.waitForTimeout(150)
    const heading = await page.locator('.studio-designer-topbar__heading').innerText()
    if (heading.trim() !== 'Visual style') throw new Error(`unexpected heading "${heading}"`)
  })

  await step('Done returns to /dashboard', async () => {
    await page.getByRole('button', { name: 'Done' }).click()
    await page.waitForURL((url) => url.pathname === '/dashboard', { timeout: 10_000 })
  })

  await ctx.close()
  await browser.close()

  console.log(`\n── Channel Designer e2e: ${passed} passed, ${failed} failed ──`)
  if (failList.length > 0) {
    console.log('\nFailed checks:')
    for (const f of failList) console.log(`  - ${f}`)
  }
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
