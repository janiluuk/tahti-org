#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright e2e — anonymous visitor journey. No login: home → listen hub →
 * a public channel → an artist profile → transparency → signup. Captures
 * screenshots in both light and dark color-scheme emulation (see
 * ../lib/journey-capture.mjs for why this is the browser's own
 * prefers-color-scheme, not the product's per-artist theme picker).
 *
 *   WEB_PORT=17777 API_PORT=15011 node tests/e2e/anonymous/anonymous-journey.mjs
 *
 * Requires Docker stack + seed. Screenshots: docs/e2e-screenshots/anonymous/journey/
 */
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ok,
  fail,
  runThemedJourney,
  shot,
  writeManifest,
  summarize,
} from '../lib/journey-capture.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../../../docs/e2e-screenshots/anonymous/journey')
const APP = process.env.APP_URL ?? 'http://localhost:17777'
const API = process.env.API_URL ?? 'http://localhost:15011'
const ARTIST_USER = process.env.E2E_DEMO_ARTIST_USER ?? 'screenshot-demo'

const manifest = [
  { file: '01-home.png', label: 'Home (logged out)' },
  { file: '02-listen-hub.png', label: 'Listen hub' },
  { file: '03-channel.png', label: 'Public channel page' },
  { file: '04-artist-profile.png', label: 'Artist profile' },
  { file: '05-transparency.png', label: 'Transparency dashboard' },
  { file: '06-signup.png', label: 'Signup form' },
]

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }
  ok('API health')

  console.log('\n── Anonymous visitor journey (Playwright + screenshots) ──')

  await runThemedJourney(
    OUT,
    { width: 3440, height: 1440 },
    async (context, page, theme, outDir) => {
      await page.goto(`${APP}/`, { waitUntil: 'networkidle', timeout: 45_000 })
      await shot(page, outDir, '01-home.png', 'home')

      await page.goto(`${APP}/listen`, { waitUntil: 'load', timeout: 45_000 })
      await page.waitForTimeout(600)
      await shot(page, outDir, '02-listen-hub.png', 'listen hub')

      await page.goto(`${APP}/c/${ARTIST_USER}`, { waitUntil: 'load', timeout: 45_000 })
      await page.waitForTimeout(1500)
      const collapse = page.locator('.ch-chat-collapse-toggle')
      if ((await collapse.count()) > 0) {
        await collapse
          .first()
          .click()
          .catch(() => {})
        await page.waitForTimeout(300)
      }
      await shot(page, outDir, '03-channel.png', 'channel page')

      await page.goto(`${APP}/u/${ARTIST_USER}`, { waitUntil: 'load', timeout: 45_000 })
      await page.waitForTimeout(600)
      await shot(page, outDir, '04-artist-profile.png', 'artist profile')

      await page.goto(`${APP}/transparency`, { waitUntil: 'load', timeout: 45_000 })
      await page.waitForTimeout(600)
      await shot(page, outDir, '05-transparency.png', 'transparency')

      await page.goto(`${APP}/signup`, { waitUntil: 'load', timeout: 45_000 })
      await page.waitForTimeout(400)
      await shot(page, outDir, '06-signup.png', 'signup')
    },
  )

  await writeManifest(OUT, manifest)
  summarize('Anonymous visitor journey', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
