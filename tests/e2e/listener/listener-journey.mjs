#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright e2e — listener journey. A verified member account (financial
 * supporter, no artist channel) logs in via the UI, lands on the listener
 * dashboard, opens governance, follows a public channel back out, and views
 * an artist's paid fan-tier subscribe page (the buy side of selling content
 * to paid subscribers — see fresh-artist-journey.mjs for the sell side).
 * Captures screenshots in both light and dark color-scheme emulation.
 *
 *   WEB_PORT=17777 API_PORT=15011 node tests/e2e/listener/listener-journey.mjs
 *
 * Requires Docker stack + seed. Screenshots: docs/e2e-screenshots/listener/journey/
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { uiLogin, assertAuthenticated } from '../lib/playwright-auth.mjs'
import {
  ok,
  fail,
  runThemedJourney,
  shot,
  writeManifest,
  summarize,
} from '../lib/journey-capture.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../../../docs/e2e-screenshots/listener/journey')
const APP = process.env.APP_URL ?? 'http://localhost:17777'
const API = process.env.API_URL ?? 'http://localhost:15011'
const PASS = process.env.E2E_DEMO_PASS ?? 'screenshot-demo-pass'
const MEMBER_EMAIL = process.env.E2E_DEMO_MEMBER_EMAIL ?? 'screenshot-fan@e2e.tahti.live'
const ARTIST_USER = process.env.E2E_DEMO_ARTIST_USER ?? 'screenshot-demo'

const manifest = [
  { file: '01-login-filled.png', label: 'Login form (member credentials)' },
  { file: '02-listener-dashboard.png', label: 'Listener dashboard' },
  { file: '03-governance.png', label: 'Member governance' },
  { file: '04-channel-as-listener.png', label: 'Public channel, viewed while signed in' },
  { file: '05-fan-tier-subscribe.png', label: 'Buy side: fan tier subscribe page (paid content)' },
]

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }
  ok('API health')

  console.log('\n── Listener journey (Playwright + screenshots) ──')

  await runThemedJourney(
    OUT,
    { width: 3440, height: 1440 },
    async (context, page, theme, outDir) => {
      await page.goto(`${APP}/login`, { waitUntil: 'load', timeout: 45_000 })
      await page.locator('#auth-panel-login input[name="email"]').fill(MEMBER_EMAIL)
      await page.locator('#auth-panel-login input[name="password"]').fill(PASS)
      await page.screenshot({ path: join(outDir, '01-login-filled.png'), fullPage: true })
      ok('screenshot 01-login-filled.png')
      await page.locator('#auth-panel-login button[type="submit"]').click()
      try {
        await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
      } catch {
        await page.locator('#auth-panel-login button[type="submit"]').click()
        await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 30_000 })
      }
      await assertAuthenticated(page, 'after UI login')
      ok('listener session (UI login)')

      await page.goto(`${APP}/dashboard`, { waitUntil: 'networkidle', timeout: 45_000 })
      await assertAuthenticated(page, 'listener dashboard')
      await shot(page, outDir, '02-listener-dashboard.png', 'listener dashboard')

      await page.goto(`${APP}/dashboard/governance`, { waitUntil: 'load', timeout: 45_000 })
      await assertAuthenticated(page, 'governance')
      await page.waitForTimeout(600)
      await shot(page, outDir, '03-governance.png', 'governance')

      await page.goto(`${APP}/c/${ARTIST_USER}`, { waitUntil: 'load', timeout: 45_000 })
      await page.waitForTimeout(1200)
      await shot(page, outDir, '04-channel-as-listener.png', 'channel as listener')

      // Buy side of paid content: the fan-tier subscribe/paywall page, viewed
      // as a logged-in listener deciding whether to become a paying supporter.
      await page.goto(`${APP}/u/${ARTIST_USER}/subscribe`, { waitUntil: 'load', timeout: 45_000 })
      await page.waitForTimeout(800)
      await shot(page, outDir, '05-fan-tier-subscribe.png', 'fan tier subscribe page')
    },
  )

  await writeManifest(OUT, manifest)
  summarize('Listener journey', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
