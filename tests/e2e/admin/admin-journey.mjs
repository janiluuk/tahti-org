#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright e2e — board admin journey. Logs in as the seeded board account,
 * tours the admin console (dashboard, users, financial, governance,
 * moderation), and confirms each page renders without a login wall. Captures
 * screenshots in both light and dark color-scheme emulation.
 *
 *   WEB_PORT=17777 API_PORT=15011 node tests/e2e/admin/admin-journey.mjs
 *
 * Requires Docker stack + seed. Screenshots: docs/e2e-screenshots/admin/journey/
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
const OUT = join(__dirname, '../../../docs/e2e-screenshots/admin/journey')
const APP = process.env.APP_URL ?? 'http://localhost:17777'
const API = process.env.API_URL ?? 'http://localhost:15011'
const PASS = process.env.E2E_DEMO_PASS ?? 'screenshot-demo-pass'
const BOARD_EMAIL = process.env.E2E_DEMO_BOARD_EMAIL ?? 'screenshot-board@e2e.tahti.live'

const pages = [
  { path: '/admin/dashboard', file: '02-admin-dashboard.png', label: 'Admin dashboard' },
  { path: '/admin/users', file: '03-admin-users.png', label: 'User directory' },
  {
    path: '/admin/content-reports',
    file: '04-admin-content-reports.png',
    label: 'Content reports',
  },
  { path: '/admin/financial', file: '05-admin-financial.png', label: 'Financial hub' },
  { path: '/admin/governance', file: '06-admin-governance.png', label: 'Governance hub' },
  { path: '/admin/grants', file: '07-admin-grants.png', label: 'Grants overview' },
]

const manifest = [
  { file: '01-login-filled.png', label: 'Login form (board credentials)' },
  ...pages.map(({ file, label }) => ({ file, label })),
]

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }
  ok('API health')

  console.log('\n── Admin journey (Playwright + screenshots) ──')

  await runThemedJourney(
    OUT,
    { width: 3440, height: 1440 },
    async (context, page, theme, outDir) => {
      await page.goto(`${APP}/login`, { waitUntil: 'load', timeout: 45_000 })
      await page.locator('#auth-panel-login input[name="email"]').fill(BOARD_EMAIL)
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
      ok('admin session (UI login)')

      for (const { path, file, label } of pages) {
        await page.goto(`${APP}${path}`, { waitUntil: 'load', timeout: 45_000 })
        await assertAuthenticated(page, label)
        await page.waitForTimeout(800)
        await shot(page, outDir, file, label)
      }
    },
  )

  await writeManifest(OUT, manifest)
  summarize('Admin journey', OUT)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
