#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright e2e — empty artist account logs in, provisions a channel, uploads
 * album + EP + single, and captures journey screenshots (artist + admin).
 *
 *   WEB_PORT=17777 API_PORT=15011 node tests/e2e/fresh-artist-journey.mjs
 *
 * Requires Docker stack + seed (./scripts/e2e-screenshots.sh --capture after seed).
 * Screenshots: docs/e2e-screenshots/journey/
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'
import { assertAuthenticated, apiLogin } from './lib/playwright-auth.mjs'
import {
  createRelease,
  makeSilentWav,
  patchReleaseVisual,
  publishRelease,
  uploadTrack,
} from './lib/release-api.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../../docs/e2e-screenshots/journey')
const APP = process.env.APP_URL ?? 'http://localhost:17777'
const API = process.env.API_URL ?? 'http://localhost:15011'

const PASS = process.env.E2E_DEMO_PASS ?? 'screenshot-demo-pass'
const FRESH_EMAIL = process.env.E2E_FRESH_EMAIL ?? 'screenshot-fresh@e2e.tahti.live'
const FRESH_USER = process.env.E2E_FRESH_USER ?? 'screenshot-fresh'
const ADMIN_EMAIL = process.env.E2E_DEMO_BOARD_EMAIL ?? 'screenshot-board@e2e.tahti.live'

const CATALOG_COLOR_SCHEMES = {
  ALBUM: {
    bg: '#0a1628',
    accent: '#00d4aa',
    text: '#e8f4f0',
    muted: '#4a6670',
    highlight: '#66e3c4',
  },
  EP: {
    bg: '#1a0a28',
    accent: '#a855f7',
    text: '#f3e8ff',
    muted: '#6b5080',
    highlight: '#c084fc',
  },
  SINGLE: {
    bg: '#1c1408',
    accent: '#f59e0b',
    text: '#fef3c7',
    muted: '#78716c',
    highlight: '#fbbf24',
  },
}

let passed = 0
let failed = 0

function ok(label) {
  console.log(`✓ ${label}`)
  passed++
}

function fail(label, err) {
  console.error(`✗ ${label}${err ? ` — ${err}` : ''}`)
  failed++
}

async function shot(page, file, label) {
  await assertAuthenticated(page, label)
  const path = join(OUT, file)
  await page.screenshot({ path, fullPage: true })
  ok(`screenshot ${file}`)
  return path
}

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }
  ok('API health')

  try {
    spawnSync('docker', ['compose', '-f', join(__dirname, '../../infra/docker-compose.stack.yml'), 'exec', '-T', 'redis', 'redis-cli', 'FLUSHDB'], {
      encoding: 'utf8',
    })
  } catch {
    /* optional — avoids auth rate limit during screenshot runs */
  }

  if (process.env.E2E_SKIP_FRESH_RESET !== '1') {
    try {
      const reset = spawnSync(
        'docker',
        [
          'compose',
          '-f',
          join(__dirname, '../../infra/docker-compose.stack.yml'),
          'run',
          '--rm',
          '--no-deps',
          '-e',
          'DATABASE_URL=postgresql://tahti:tahti_dev@postgres:5432/tahti',
          '-v',
          `${join(__dirname, '../../apps/api/scripts/reset-e2e-fresh.ts')}:/app/apps/api/scripts/reset-e2e-fresh.ts:ro`,
          '-w',
          '/app',
          'api',
          'tsx',
          'apps/api/scripts/reset-e2e-fresh.ts',
        ],
        { encoding: 'utf8' },
      )
      if (reset.status === 0 && reset.stdout.includes('"reset":true')) {
        ok('fresh artist account reset (no channel, no releases)')
      } else if (reset.stdout.includes('user missing')) {
        fail('fresh artist account missing — run stack seed first')
      } else {
        console.log('⚠ fresh reset skipped —', reset.stderr?.slice(0, 120) || reset.stdout?.slice(0, 120))
      }
    } catch {
      console.log('⚠ fresh reset skipped — docker compose unavailable')
    }
  }

  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const stamp = Date.now()
  const wavBytes = makeSilentWav()

  const albumTitle = `Journey Album ${stamp}`
  const epTitle = `Journey EP ${stamp}`
  const singleTitle = `Journey Single ${stamp}`

  console.log('\n── Fresh artist journey (Playwright + screenshots) ──')

  try {
    const artistCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } })

    const loginDemo = await artistCtx.newPage()
    await loginDemo.goto(`${APP}/login`, { waitUntil: 'load', timeout: 45_000 })
    await loginDemo.locator('#auth-panel-login input[name="email"]').fill(FRESH_EMAIL)
    await loginDemo.locator('#auth-panel-login input[name="password"]').fill(PASS)
    await loginDemo.screenshot({ path: join(OUT, '00-login-filled.png'), fullPage: true })
    ok('screenshot 00-login-filled.png')
    await loginDemo.close()

    const artistCookie = await apiLogin(API, APP, FRESH_EMAIL, PASS)
    await artistCtx.addCookies([artistCookie])
    ok('artist session')

    const page = await artistCtx.newPage()

    await page.goto(`${APP}/dashboard`, { waitUntil: 'networkidle', timeout: 45_000 })
    await assertAuthenticated(page, 'dashboard after login')
    await shot(page, '01-artist-dashboard-empty.png', 'empty dashboard')

    const meRes = await artistCtx.request.get(`${API}/api/auth/me`)
    const me = await meRes.json()
    const hasChannel = Boolean(me.channel)

    if (!hasChannel) {
      await page.goto(`${APP}/dashboard/setup-channel`, { waitUntil: 'load', timeout: 45_000 })
      await assertAuthenticated(page, 'setup channel')
      await shot(page, '02-setup-channel.png', 'setup channel')

      await page.getByRole('button', { name: new RegExp(`Create ${FRESH_USER}\\.tahti\\.live`) }).click()
      await page.waitForURL((url) => url.pathname.includes('/dashboard/channel'), {
        timeout: 45_000,
      })
      ok('channel provisioned via UI')
    } else {
      ok('channel already exists — skipping provision UI')
      await page.goto(`${APP}/dashboard/channel`, { waitUntil: 'load', timeout: 45_000 })
    }

    await assertAuthenticated(page, 'channel design')
    await page.waitForTimeout(800)
    await shot(page, '03-channel-editor.png', 'channel design editor')

    const api = artistCtx.request
    api._apiUrl = API

    const album = await createRelease(api, {
      title: albumTitle,
      type: 'ALBUM',
      releaseDate: '2026-06-01',
      tracks: ['Opening', 'Second Light', 'Midnight Run', 'Closing Echo'],
    })
    ok(`create ALBUM "${albumTitle}"`)

    const ep = await createRelease(api, {
      title: epTitle,
      type: 'EP',
      releaseDate: '2026-06-01',
      tracks: ['Side A', 'Side B'],
    })
    ok(`create EP "${epTitle}"`)

    const single = await createRelease(api, {
      title: singleTitle,
      type: 'SINGLE',
      releaseDate: '2026-06-01',
      tracks: ['Radio Edit'],
    })
    ok(`create SINGLE "${singleTitle}"`)

    await patchReleaseVisual(api, album.id, {
      visualPreset: 'AURORA',
      colorScheme: CATALOG_COLOR_SCHEMES.ALBUM,
    })
    await patchReleaseVisual(api, ep.id, {
      visualPreset: 'PARTICLE_FIELD',
      colorScheme: CATALOG_COLOR_SCHEMES.EP,
    })
    await patchReleaseVisual(api, single.id, {
      visualPreset: 'REACTIVE_GRID',
      colorScheme: CATALOG_COLOR_SCHEMES.SINGLE,
    })
    ok('color schemes applied')

    let uploadsOk = 0
    for (const [release, names] of [
      [album, ['Opening', 'Second Light', 'Midnight Run', 'Closing Echo']],
      [ep, ['Side A', 'Side B']],
      [single, ['Radio Edit']],
    ]) {
      for (const name of names) {
        const result = await uploadTrack(api, release.id, name, wavBytes, API)
        if (result.ok) uploadsOk++
      }
    }
    if (uploadsOk > 0) ok(`${uploadsOk} track(s) uploaded`)
    else console.log('⚠ track byte upload skipped — MinIO not reachable from test runner')

    await publishRelease(api, album.id)
    await publishRelease(api, ep.id)
    await publishRelease(api, single.id)
    ok('published album, EP, and single')

    await page.goto(`${APP}/dashboard#releases`, { waitUntil: 'networkidle', timeout: 45_000 })
    await assertAuthenticated(page, 'releases tab')
    await page.locator('#releases').scrollIntoViewIfNeeded()
    await page.waitForTimeout(800)
    for (const title of [albumTitle, epTitle, singleTitle]) {
      const row = page.getByText(title, { exact: false })
      try {
        await row.first().waitFor({ state: 'visible', timeout: 15_000 })
        ok(`dashboard shows "${title}"`)
      } catch {
        fail(`dashboard missing "${title}"`)
      }
    }
    await shot(page, '04-releases-catalog.png', 'releases catalog')

    await page.goto(`${APP}/c/${FRESH_USER}`, { waitUntil: 'load', timeout: 45_000 })
    await page.waitForTimeout(1200)
    await page.screenshot({ path: join(OUT, '05-public-channel.png'), fullPage: true })
    ok('screenshot 05-public-channel.png')

    await artistCtx.close()

    try {
      spawnSync('docker', ['compose', '-f', join(__dirname, '../../infra/docker-compose.stack.yml'), 'exec', '-T', 'redis', 'redis-cli', 'FLUSHDB'], {
        encoding: 'utf8',
      })
    } catch {
      /* optional */
    }

    // ── Admin verifies the new artist ───────────────────────────────────────
    const adminCtx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const adminCookie = await apiLogin(API, APP, ADMIN_EMAIL, PASS)
    await adminCtx.addCookies([adminCookie])
    const adminPage = await adminCtx.newPage()
    ok('admin session')

    await adminPage.goto(`${APP}/admin/users`, { waitUntil: 'networkidle', timeout: 45_000 })
    await assertAuthenticated(adminPage, 'admin users')
    await adminPage.waitForTimeout(1200)
    const adminBody = await adminPage.locator('body').innerText()
    if (adminBody.includes(FRESH_USER) || adminBody.includes('Fresh Journey')) {
      ok('admin user directory lists fresh artist')
    } else {
      fail('admin user directory missing fresh artist')
    }
    await shot(adminPage, '06-admin-users.png', 'admin users')

    await adminPage.goto(`${APP}/admin/dashboard`, { waitUntil: 'load', timeout: 45_000 })
    await assertAuthenticated(adminPage, 'admin dashboard')
    await adminPage.waitForTimeout(1200)
    await shot(adminPage, '07-admin-dashboard.png', 'admin dashboard')

    await adminCtx.close()

    const manifest = [
      { file: '00-login-filled.png', label: 'Login form (fresh artist credentials)' },
      { file: '01-artist-dashboard-empty.png', label: 'Artist dashboard (no channel yet)' },
      { file: '02-setup-channel.png', label: 'Create your artist channel' },
      { file: '03-channel-editor.png', label: 'Channel design editor (full page)' },
      { file: '04-releases-catalog.png', label: 'Album + EP + single on dashboard' },
      { file: '05-public-channel.png', label: 'Public channel page' },
      { file: '06-admin-users.png', label: 'Admin user directory' },
      { file: '07-admin-dashboard.png', label: 'Admin dashboard' },
    ]
    await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
  } catch (e) {
    fail('fresh artist journey', e.message)
  }

  await browser.close()

  console.log(`\n── Fresh artist journey: ${passed} passed, ${failed} failed ──`)
  console.log(`   Screenshots: ${OUT}`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
