#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright + API e2e — Tahti Radio live-show arc:
 *
 *   1. /radio plays (HLS advances when Liquidsoap is up)
 *   2. DJ Icecast connect → go-live (UI)
 *   3. ~1 minute stream (backdated on the Broadcast row — no wall-clock wait)
 *   4. Radio chat announcement is visible to listeners
 *   5. DJ disconnects; radio stays on; show continues
 *
 * Self-seeding via apps/api/scripts/seed-e2e-radio-live-show.ts.
 *
 *   DATABASE_URL=postgresql://tahti:tahti_dev@localhost:5432/tahti \
 *   API_URL=http://localhost:3001 APP_URL=http://localhost:3010 \
 *     node tests/e2e/radio-live-show.mjs
 *
 * Optional: E2E_REQUIRE_AUDIO=1 fails if HLS playback does not advance
 * (default: soft-skip audio when the stack has no Liquidsoap).
 */

import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'
import { uiLogin, assertAuthenticated } from './lib/playwright-auth.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const API_DIR = join(__dirname, '../../apps/api')

const APP = process.env.APP_URL ?? 'http://localhost:3010'
const API = process.env.API_URL ?? 'http://localhost:3001'
const DATABASE_URL = process.env.DATABASE_URL ?? 'postgresql://tahti:tahti_dev@localhost:5432/tahti'
const REQUIRE_AUDIO = process.env.E2E_REQUIRE_AUDIO === '1'
const LIVE_MS = 60_000

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

function soft(label, err) {
  console.warn(`~ ${label}${err ? ` — ${err}` : ''} (soft)`)
}

function seed(...args) {
  const res = spawnSync('npx', ['tsx', 'scripts/seed-e2e-radio-live-show.ts', ...args], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL },
    encoding: 'utf8',
  })
  if (res.status !== 0) {
    throw new Error(`seed ${args.join(' ') || '(default)'} failed: ${res.stderr || res.stdout}`)
  }
  const lastLine = res.stdout.trim().split('\n').pop()
  return JSON.parse(lastLine)
}

async function assertRadioPlayback(page) {
  const playButton = page.locator('#live-player').getByRole('button', { name: /^Play$/ })
  if ((await playButton.count()) === 0) {
    if (REQUIRE_AUDIO) fail('no Play button on radio player')
    else soft('no Play button on radio player — Liquidsoap may be down')
    return false
  }
  await playButton.click()
  ok('clicked Play on Tahti Radio')

  const audio = page.locator('[data-testid="channel-live-player"]')
  try {
    await audio.waitFor({ state: 'attached', timeout: 15_000 })
    ok('live audio element is present')
  } catch {
    if (REQUIRE_AUDIO) fail('live audio element never appeared')
    else soft('live audio element never appeared')
    return false
  }

  await page.waitForTimeout(4000)
  const t1 = await audio.evaluate((el) => el.currentTime).catch(() => null)
  await page.waitForTimeout(4000)
  const t2 = await audio.evaluate((el) => el.currentTime).catch(() => null)
  if (typeof t1 === 'number' && typeof t2 === 'number' && t2 > t1) {
    ok(`radio playback advancing (${t1.toFixed(1)}s → ${t2.toFixed(1)}s)`)
    return true
  }
  if (REQUIRE_AUDIO) fail('radio playback did not advance', `${t1} → ${t2}`)
  else soft('radio playback did not advance', `${t1} → ${t2}`)
  return false
}

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }
  ok('API health')

  const fixture = seed()
  ok(`seeded DJ ${fixture.username} with active radio slot`)

  const browser = await chromium.launch({ headless: true })

  console.log('\n── 1. Tahti Radio plays a track ──')
  const listener = await browser.newContext({ viewport: { width: 1280, height: 900 } })
  const radioPage = await listener.newPage()
  const radioRes = await radioPage.goto(`${APP}/radio`, { waitUntil: 'load', timeout: 45_000 })
  if (radioRes?.ok()) ok('radio page loads')
  else fail('radio page HTTP', String(radioRes?.status()))

  const offline = await radioPage.locator('text=Tahti Radio is temporarily offline').count()
  if (offline === 0) ok('radio is not showing the offline placeholder')
  else if (REQUIRE_AUDIO) fail('radio shows temporarily offline')
  else soft('radio shows temporarily offline')

  await assertRadioPlayback(radioPage)

  const liveBanner = radioPage.locator('.ch-radio-live-now')
  try {
    await liveBanner.waitFor({ state: 'visible', timeout: 10_000 })
    const bannerText = (await liveBanner.innerText()).trim()
    if (bannerText.includes(fixture.displayName)) {
      ok(`Live now banner names the DJ ("${bannerText}")`)
    } else {
      fail('Live now banner missing DJ name', bannerText)
    }
  } catch {
    soft('Live now banner not visible before go-live (slot may need refresh)')
  }

  console.log('\n── 2. DJ goes live ──')
  const connectRes = await fetch(`${API}/internal/icecast/on_connect`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      mount: `/live/${fixture.username}`,
      pass: fixture.liveSourcePass,
    }),
  })
  if (connectRes.status === 200) ok('Icecast on_connect accepted')
  else fail('Icecast on_connect', `status ${connectRes.status}`)

  const afterConnect = await fetch(`${API}/api/channels/${fixture.username}`).then((r) => r.json())
  if (afterConnect.state === 'PREVIEW') ok('DJ channel entered PREVIEW')
  else fail('DJ channel entered PREVIEW', `state=${afterConnect.state}`)

  const dash = await browser.newPage()
  await uiLogin(dash, APP, fixture.email, fixture.password)
  await assertAuthenticated(dash, 'DJ dashboard login')

  const pill = dash.locator('.db-go-live-btn')
  await pill.waitFor({ state: 'visible', timeout: 15_000 })
  await pill.click()
  await dash.waitForFunction(
    () => document.querySelector('.db-go-live-btn')?.textContent?.includes('On air'),
    { timeout: 15_000 },
  )
  ok('DJ one-click go-live → On air')

  const afterLive = await fetch(`${API}/api/channels/${fixture.username}`).then((r) => r.json())
  if (afterLive.state === 'LIVE') ok('DJ channel state is LIVE')
  else fail('DJ channel state is LIVE', `state=${afterLive.state}`)

  await radioPage.reload({ waitUntil: 'load' })
  try {
    await radioPage.locator('.ch-radio-live-now').waitFor({ state: 'visible', timeout: 10_000 })
    ok('radio page shows Live now after go-live')
  } catch {
    fail('radio page Live now banner missing after go-live')
  }

  console.log('\n── 3. Stream ~1 minute (backdated) ──')
  const backdated = seed('backdate', String(LIVE_MS))
  if (backdated.ok) ok(`broadcast backdated to ${LIVE_MS / 1000}s on air`)
  else fail('no open broadcast to backdate', backdated.reason)

  console.log('\n── 4. Announcement ──')
  const pinned = seed('announce')
  if (pinned.ok) ok('posted radio chat announcement')
  else fail('seed chat announcement')

  await radioPage.reload({ waitUntil: 'load' })
  const bodyText = await radioPage.locator('body').innerText()
  if (bodyText.includes(fixture.chatAnnounceBody)) {
    ok('listener sees the announcement on /radio')
  } else {
    const ann = await fetch(`${API}/api/chat/tahti-radio/announcements`).then((r) => r.json())
    if (Array.isArray(ann) && ann.some((a) => a.body?.includes(fixture.chatAnnounceBody))) {
      ok('announcement present via chat API (UI may still be hydrating)')
    } else {
      fail('announcement not visible to listener')
    }
  }

  console.log('\n── 5. Show continues after live ends ──')
  const disconnectRes = await fetch(`${API}/internal/icecast/on_disconnect`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ mount: `/live/${fixture.username}` }),
  })
  if (disconnectRes.status === 200) ok('Icecast on_disconnect accepted')
  else fail('Icecast on_disconnect', `status ${disconnectRes.status}`)

  const afterOff = await fetch(`${API}/api/channels/${fixture.username}`).then((r) => r.json())
  if (afterOff.state === 'OFFLINE') ok('DJ channel returned to OFFLINE')
  else fail('DJ channel returned to OFFLINE', `state=${afterOff.state}`)

  seed('clear')
  ok('cleared slot override + fixture live state')

  await radioPage.reload({ waitUntil: 'load' })
  const radioApi = await fetch(`${API}/api/channels/tahti-radio`).then((r) => r.json())
  if (radioApi.state === 'LIVE') ok('Tahti Radio channel still LIVE — show continues')
  else if (REQUIRE_AUDIO) fail('Tahti Radio not LIVE after show', `state=${radioApi.state}`)
  else soft('Tahti Radio not LIVE after show', `state=${radioApi.state}`)

  const stillOfflineCard = await radioPage
    .locator('text=Tahti Radio is temporarily offline')
    .count()
  if (stillOfflineCard === 0) ok('radio page still has a player surface')
  else soft('radio page shows offline after clear')

  await assertRadioPlayback(radioPage)

  await listener.close()
  await browser.close()

  console.log(`\n── Tahti Radio live-show e2e: ${passed} passed, ${failed} failed ──`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
