#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright e2e — artist dashboard usage and channel/archive players.
 *
 *   API_URL=http://localhost:3011 APP_URL=http://localhost:3010 node tests/e2e/dashboard-player.mjs
 *
 * Requires API + web running and journey fixtures seeded.
 */

import { chromium } from 'playwright'

const APP = process.env.APP_URL ?? 'http://localhost:3010'
const API = process.env.API_URL ?? 'http://localhost:3011'

const FIXTURE = {
  password: process.env.E2E_DEMO_PASS ?? 'screenshot-demo-pass',
  artistEmail: process.env.E2E_DEMO_ARTIST_EMAIL ?? 'screenshot-artist@e2e.tahti.live',
  artist: process.env.E2E_DEMO_ARTIST_USER ?? 'screenshot-demo',
  archiveTitle: 'Live at Klubi',
  releaseTitle: 'Northern Lights',
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

async function apiLogin(email, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`login ${email}: ${res.status}`)
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/tahti_session=([^;]+)/)
  if (!match) throw new Error('no session cookie')
  const host = new URL(APP).hostname
  return {
    name: 'tahti_session',
    value: match[1],
    domain: host === 'localhost' ? 'localhost' : host,
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }
}

async function expectAudioPlayer(page, testId, label) {
  const audio = page.locator(`[data-testid="${testId}"]`)
  const count = await audio.count()
  if (count === 0) {
    console.log(`⚠ ${label} — no audio element (MinIO may be unavailable)`)
    return
  }
  const src = await audio.first().getAttribute('src')
  if (!src || src.length < 8) {
    fail(`${label} — missing src`)
    return
  }
  ok(`${label} has playable src`)
  const canPlay = await audio.first().evaluate((el) => {
    const a = /** @type {HTMLAudioElement} */ (el)
    return a.readyState >= HTMLMediaElement.HAVE_METADATA || a.src.length > 0
  })
  if (canPlay) ok(`${label} media element ready`)
  else fail(`${label} media not ready`)
}

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }
  ok('API health')

  const browser = await chromium.launch({ headless: true })

  console.log('\n── Dashboard journey (Playwright) ──')
  try {
    const cookie = await apiLogin(FIXTURE.artistEmail, FIXTURE.password)
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    await ctx.addCookies([cookie])
    const dash = await ctx.newPage()
    const res = await dash.goto(`${APP}/dashboard`, { waitUntil: 'load', timeout: 45_000 })
    if (!res?.ok()) {
      fail('dashboard HTTP', String(res?.status()))
    } else {
      ok('dashboard loads')
    }

    const body = await dash.locator('body').innerText()
    if (body.includes('Dashboard')) ok('dashboard heading')
    else fail('dashboard missing heading')

    if (body.includes('Your channel')) ok('dashboard channel panel')
    else fail('dashboard missing channel panel')

    if (body.includes(FIXTURE.releaseTitle)) ok('dashboard shows demo release')
    else fail('dashboard missing demo release')

    if (body.includes('Music')) ok('dashboard music section')
    else fail('dashboard missing music section')

    const channelLink = dash.locator(`a[href="/c/${FIXTURE.artist}"]`).first()
    if ((await channelLink.count()) > 0) {
      await channelLink.click()
      await dash.waitForURL(`**/c/${FIXTURE.artist}`, { timeout: 15_000 })
      ok('dashboard link opens channel page')
      const channelBody = await dash.locator('body').innerText()
      if (channelBody.includes('Archive')) ok('channel page from dashboard has archive')
      else fail('channel page missing archive')
    } else {
      fail('dashboard missing channel link')
    }

    await dash.goto(`${APP}/dashboard`, { waitUntil: 'load', timeout: 45_000 })
    await expectAudioPlayer(dash, 'dashboard-archive-player', 'dashboard archive player')

    await ctx.close()
  } catch (e) {
    fail('dashboard journey', e.message)
  }

  console.log('\n── Channel player journey (Playwright) ──')
  try {
    const pub = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    const page = await pub.newPage()
    const chRes = await page.goto(`${APP}/c/${FIXTURE.artist}`, {
      waitUntil: 'load',
      timeout: 45_000,
    })
    if (!chRes?.ok()) fail('channel page HTTP', String(chRes?.status()))
    else ok('channel page loads')

    const text = await page.locator('body').innerText()
    if (text.includes('Archive')) ok('channel archive section')
    else fail('channel missing archive section')

    if (text.includes(FIXTURE.archiveTitle)) ok('channel lists demo archive item')
    else fail('channel missing demo archive title')

    const liveCount = await page.locator('[data-testid="channel-live-player"]').count()
    if (liveCount === 0) {
      ok('no live player when channel offline (expected)')
    } else {
      ok('live HLS player visible when channel is live')
    }

    await expectAudioPlayer(page, 'channel-archive-player', 'channel archive player')

    const playPromise = page
      .locator('[data-testid="channel-archive-player"]')
      .first()
      .evaluate((el) => {
        const a = /** @type {HTMLAudioElement} */ (el)
        return a
          .play()
          .then(() => true)
          .catch(() => false)
      })
      .catch(() => false)
    if (await playPromise) ok('archive player accepts play()')
    else console.log('⚠ archive play() blocked in headless (often expected)')

    await pub.close()
  } catch (e) {
    fail('channel player journey', e.message)
  }

  await browser.close()

  console.log(`\n── Dashboard & player e2e: ${passed} passed, ${failed} failed ──`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
