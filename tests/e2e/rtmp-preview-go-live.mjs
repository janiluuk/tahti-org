#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright + API e2e — RTMP connect puts a channel into private PREVIEW
 * automatically (no manual step), and the dashboard's one-click "Go live now"
 * then promotes it to public LIVE (also no navigation required — the header
 * pill itself performs the action once already in PREVIEW).
 *
 * Drives the real running API's /internal/rtmp/on_publish exactly as
 * nginx-rtmp calls it (form-encoded `name=<streamKey>`, see
 * apps/api/src/routes/internal/rtmp.ts and its own ingest.test.ts) rather than
 * pushing a real RTMP stream via ffmpeg — the actual RTMP socket/nginx layer
 * is nginx-rtmp's job, already exercised by its own test suite; what this
 * journey needs to verify is Tahti's own state-machine and dashboard UI.
 *
 * Self-seeding via apps/api/scripts/seed-e2e-golive.ts (direct DB access),
 * then drives the real running API + web over HTTP/browser.
 *
 *   DATABASE_URL=postgresql://tahti:tahti_dev@localhost:5432/tahti \
 *   API_URL=http://localhost:3001 APP_URL=http://localhost:3010 \
 *     node tests/e2e/rtmp-preview-go-live.mjs
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

function seed() {
  const res = spawnSync('npx', ['tsx', 'scripts/seed-e2e-golive.ts'], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL },
    encoding: 'utf8',
  })
  if (res.status !== 0) {
    throw new Error(`seed failed: ${res.stderr || res.stdout}`)
  }
  const lastLine = res.stdout.trim().split('\n').pop()
  return JSON.parse(lastLine)
}

async function main() {
  const artist = seed()
  console.log(`seeded ${artist.username} (rtmp key ${artist.rtmpStreamKey})`)

  // ── Connecting via RTMP alone must flip to PREVIEW, nothing more ──────────
  const publishRes = await fetch(`${API}/internal/rtmp/on_publish`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `name=${encodeURIComponent(artist.rtmpStreamKey)}`,
  })
  if (publishRes.status === 200) ok('on_publish accepts valid RTMP credentials')
  else fail('on_publish accepts valid RTMP credentials', `status ${publishRes.status}`)

  const afterPublish = await fetch(`${API}/api/channels/${artist.username}`).then((r) => r.json())
  if (afterPublish.state === 'PREVIEW') ok('channel auto-entered PREVIEW on RTMP connect')
  else fail('channel auto-entered PREVIEW on RTMP connect', `state=${afterPublish.state}`)
  if (afterPublish.state === 'LIVE')
    fail('channel must NOT be publicly LIVE from RTMP connect alone')

  // ── Public channel page must not show this as publicly live yet ───────────
  const publicPreview = await fetch(`${API}/api/channels/${artist.username}`).then((r) => r.json())
  if (publicPreview.state !== 'LIVE') ok('public channel API does not report LIVE during PREVIEW')
  else fail('public channel API does not report LIVE during PREVIEW', 'reported LIVE')

  // ── Dashboard: the header pill must be a one-click action, not a link to
  // another page, once already in PREVIEW ──────────────────────────────────
  const browser = await chromium.launch()
  const page = await browser.newPage()

  await uiLogin(page, APP, artist.email, artist.password)
  await assertAuthenticated(page, 'dashboard login')

  const pill = page.locator('.db-go-live-btn')
  await pill.waitFor({ state: 'visible', timeout: 15_000 })
  const pillTag = await pill.evaluate((el) => el.tagName.toLowerCase())
  if (pillTag === 'button') ok('go-live pill is a one-click button while in PREVIEW (not a link)')
  else fail('go-live pill is a one-click button while in PREVIEW (not a link)', `tag=${pillTag}`)

  const pillText = (await pill.textContent())?.trim() ?? ''
  if (/go live/i.test(pillText)) ok(`go-live pill labeled clearly ("${pillText}")`)
  else fail('go-live pill labeled clearly', `got "${pillText}"`)

  await pill.click()
  await page.waitForFunction(
    () => document.querySelector('.db-go-live-btn')?.textContent?.includes('On air'),
    { timeout: 15_000 },
  )
  ok('one click promoted the channel to on-air')

  const afterGoLive = await fetch(`${API}/api/channels/${artist.username}`).then((r) => r.json())
  if (afterGoLive.state === 'LIVE') ok('channel state is LIVE after the one-click action')
  else fail('channel state is LIVE after the one-click action', `state=${afterGoLive.state}`)

  // ── Public channel page now reflects it ────────────────────────────────
  await page.goto(`${APP}/c/${artist.username}`, { waitUntil: 'networkidle' })
  const liveBadge = page.locator('.ch-live')
  const liveBadgeVisible = await liveBadge.isVisible().catch(() => false)
  if (liveBadgeVisible) ok('public channel page shows LIVE after go-live')
  else fail('public channel page shows LIVE after go-live', 'no .ch-live badge found')

  await browser.close()

  // ── Cleanup: end the session so the fixture channel doesn't linger LIVE ──
  await fetch(`${API}/internal/rtmp/on_done`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: `name=${encodeURIComponent(artist.rtmpStreamKey)}`,
  })

  console.log(`\n${passed} passed, ${failed} failed`)
  if (failed > 0) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
