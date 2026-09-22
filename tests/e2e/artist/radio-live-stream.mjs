#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright e2e — Tahti Radio (radio.tahti.live / APP_URL/radio) plays the
 * real 24/7 Liquidsoap stream, never a YouTube placeholder, and produces
 * actual advancing audio, not just a player that renders.
 *
 *   APP_URL=https://radio.tahti.live node tests/e2e/radio-live-stream.mjs
 *   APP_URL=http://localhost:3010 node tests/e2e/radio-live-stream.mjs   # local dev
 *
 * No login, no seeding — this is a pure black-box check of the public page.
 */

import { chromium } from 'playwright'

const APP = process.env.APP_URL ?? 'https://radio.tahti.live'
const RADIO_PATH = APP.includes('radio.') ? '/' : '/radio'

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

async function main() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

  const segmentRequests = []
  page.on('response', (res) => {
    const url = res.url()
    if (url.endsWith('.m3u8') || url.includes('.ts?') || /\.ts$/.test(url.split('?')[0])) {
      segmentRequests.push({ url, status: res.status() })
    }
  })

  console.log(`\n── Tahti Radio live stream journey (${APP}) ──`)

  try {
    const res = await page.goto(`${APP}${RADIO_PATH}`, { waitUntil: 'load', timeout: 45_000 })
    if (res?.ok()) ok('radio page loads')
    else fail('radio page HTTP', String(res?.status()))

    await page.waitForTimeout(1000)

    // The whole point of this fix: no YouTube anywhere on the page.
    const youtubeIframes = await page.locator('iframe[src*="youtube"]').count()
    if (youtubeIframes === 0) ok('no YouTube iframe anywhere on the page')
    else fail('YouTube iframe found on radio page', `${youtubeIframes} iframe(s)`)

    const youtubeText = await page.locator('body').innerText()
    if (!/youtube/i.test(youtubeText)) ok('no "YouTube" text visible anywhere on the page')
    else fail('page mentions YouTube somewhere')

    // The "temporarily offline" empty state means the real stream isn't up —
    // that's the exact bug being fixed here, so this must not be showing.
    const offlineCard = await page.locator('text=Tahti Radio is temporarily offline').count()
    if (offlineCard === 0) ok('does not show the "temporarily offline" placeholder')
    else fail('radio page shows "temporarily offline" — the real stream is not live')

    // Start playback — audio autoplay needs a real user gesture.
    const playButton = page.locator('#live-player').getByRole('button', { name: /^Play$/ })
    if ((await playButton.count()) === 0) {
      fail('no Play button found in the live player')
    } else {
      await playButton.click()
      ok('clicked Play on the live player')
    }

    const audio = page.locator('[data-testid="channel-live-player"]')
    try {
      await audio.waitFor({ state: 'attached', timeout: 15_000 })
      ok('live audio element is present')
    } catch {
      fail('live audio element never appeared')
    }

    const src = await audio.getAttribute('src').catch(() => null)
    if (src) ok(`audio element has a playable src (${new URL(src).pathname})`)
    else fail('audio element has no src')

    // Real playback evidence: currentTime must actually advance, not just exist.
    await page.waitForTimeout(4000)
    const t1 = await audio.evaluate((el) => el.currentTime).catch(() => null)
    const paused1 = await audio.evaluate((el) => el.paused).catch(() => null)
    await page.waitForTimeout(4000)
    const t2 = await audio.evaluate((el) => el.currentTime).catch(() => null)
    const readyState = await audio.evaluate((el) => el.readyState).catch(() => -1)

    if (paused1 === false) ok('audio element is not paused')
    else fail('audio element is paused', String(paused1))

    if (readyState >= 2) ok(`audio has real decoded data (readyState=${readyState})`)
    else fail('audio readyState too low — no real data decoded', String(readyState))

    if (typeof t1 === 'number' && typeof t2 === 'number' && t2 > t1) {
      ok(`playback position is advancing (${t1.toFixed(1)}s → ${t2.toFixed(1)}s)`)
    } else {
      fail('playback position did not advance — audio is not actually playing', `${t1} → ${t2}`)
    }

    // Corroborate via the network: real HLS segments actually being fetched, not 404ing.
    const okSegments = segmentRequests.filter((r) => r.status >= 200 && r.status < 300)
    if (okSegments.length > 0) {
      ok(`${okSegments.length} HLS segment/manifest request(s) succeeded over the network`)
    } else {
      fail(
        'no successful HLS segment/manifest requests observed',
        JSON.stringify(segmentRequests.slice(0, 5)),
      )
    }
  } catch (e) {
    fail('radio live stream journey', e.message)
  }

  await browser.close()

  console.log(`\n── Tahti Radio live stream e2e: ${passed} passed, ${failed} failed ──`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
