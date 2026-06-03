#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Playwright user-journey e2e — listener, artist, member (docs/guides).
 *
 *   API_URL=http://localhost:3011 APP_URL=http://localhost:3010 node tests/e2e/user-journeys.mjs
 *
 * Requires API + web running and journey fixtures seeded.
 */

import { chromium } from 'playwright'

const APP = process.env.APP_URL ?? 'http://localhost:3010'
const API = process.env.API_URL ?? 'http://localhost:3011'

const FIXTURE = {
  password: process.env.E2E_DEMO_PASS ?? 'screenshot-demo-pass',
  artistEmail: process.env.E2E_DEMO_ARTIST_EMAIL ?? 'screenshot-artist@e2e.tahti.live',
  memberEmail: process.env.E2E_DEMO_MEMBER_EMAIL ?? 'screenshot-fan@e2e.tahti.live',
  artist: process.env.E2E_DEMO_ARTIST_USER ?? 'screenshot-demo',
  smartLinkSlug: process.env.E2E_DEMO_SMART_SLUG ?? 'northern-lights-ep',
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

async function pageLoads(page, path, label, { text, timeout = 45_000 } = {}) {
  const res = await page.goto(`${APP}${path}`, { waitUntil: 'load', timeout })
  if (!res || !res.ok()) {
    fail(`${label} HTTP ${res?.status()}`)
    return false
  }
  if (text) {
    const body = await page.locator('body').innerText()
    if (!body.includes(text)) {
      fail(`${label} — missing text: ${text}`)
      return false
    }
  }
  ok(label)
  return true
}

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }
  ok('API health')

  const browser = await chromium.launch({ headless: true })

  // ── Listener journey ───────────────────────────────────────────────────────
  console.log('\n── Listener journey (Playwright) ──')
  const pub = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  const pubPage = await pub.newPage()

  await pageLoads(pubPage, `/c/${FIXTURE.artist}`, 'channel page', { text: 'Chat' })
  const channelArchive = pubPage.locator('[data-testid="channel-archive-player"]')
  if ((await channelArchive.count()) > 0) {
    const src = await channelArchive.first().getAttribute('src')
    if (src && src.length > 8) ok('channel archive player src')
    else fail('channel archive player missing src')
  } else {
    console.log('⚠ channel archive player skipped (no audioUrl / MinIO)')
  }
  if ((await pubPage.locator('[data-testid="channel-live-player"]').count()) === 0) {
    ok('no live player when channel offline')
  }
  await pageLoads(pubPage, `/u/${FIXTURE.artist}`, 'public profile')
  await pageLoads(pubPage, `/u/${FIXTURE.artist}/subscribe`, 'subscribe page', {
    text: 'Subscribe',
  })
  await pageLoads(pubPage, `/r/${FIXTURE.smartLinkSlug}`, 'smart link', {
    text: 'Northern Lights',
  })
  await pageLoads(pubPage, '/transparency', 'transparency')
  await pageLoads(pubPage, '/help/multistream', 'multistream help', { text: 'Multistream' })

  await pub.close()

  // ── Artist journey ─────────────────────────────────────────────────────────
  console.log('\n── Artist journey (Playwright) ──')
  try {
    const artistCookie = await apiLogin(FIXTURE.artistEmail, FIXTURE.password)
    const artistCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    await artistCtx.addCookies([artistCookie])
    const dash = await artistCtx.newPage()
    await pageLoads(dash, '/dashboard', 'artist dashboard', { text: 'Dashboard' })
    const body = await dash.locator('body').innerText()
    if (body.includes('Go Live') || body.includes('Stream settings') || body.includes('Releases')) {
      ok('dashboard shows studio sections')
    } else {
      fail('dashboard missing studio sections')
    }
    if (body.includes('Your channel')) ok('dashboard channel panel')
    else fail('dashboard missing channel panel')
    if (body.includes(FIXTURE.releaseTitle)) ok('dashboard lists demo release')
    if (body.includes('Archive')) ok('dashboard archive section')
    const dashPlayer = dash.locator('[data-testid="dashboard-archive-player"]')
    if ((await dashPlayer.count()) > 0) {
      const src = await dashPlayer.first().getAttribute('src')
      if (src && src.length > 8) ok('dashboard archive player src')
      else fail('dashboard archive player missing src')
    } else {
      console.log('⚠ dashboard archive player skipped (no audioUrl / MinIO)')
    }
    const channelLink = dash.locator(`a[href="/c/${FIXTURE.artist}"]`).first()
    if ((await channelLink.count()) > 0) {
      await channelLink.click()
      await dash.waitForURL(`**/c/${FIXTURE.artist}`, { timeout: 15_000 })
      ok('dashboard opens channel from Your channel link')
    }
    await artistCtx.close()
  } catch (e) {
    fail('artist journey', e.message)
  }

  // ── Streamer journey ───────────────────────────────────────────────────────
  console.log('\n── Streamer journey (Playwright) ──')
  try {
    const artistCookie = await apiLogin(FIXTURE.artistEmail, FIXTURE.password)
    const streamCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    await streamCtx.addCookies([artistCookie])
    const streamPage = await streamCtx.newPage()
    await streamPage.goto(`${APP}/dashboard`, { waitUntil: 'load', timeout: 45_000 })
    const text = await streamPage.locator('body').innerText()
    if (text.includes('Multistream') || text.includes('simulcast')) {
      ok('dashboard multistream section')
    } else {
      fail('dashboard missing multistream')
    }
    if (text.includes('Icecast') || text.includes('Mixxx') || text.includes('OBS')) {
      ok('dashboard ingest options (RTMP + Icecast)')
    } else {
      fail('dashboard missing ingest copy')
    }
    await streamCtx.close()
  } catch (e) {
    fail('streamer journey', e.message)
  }

  // ── Member journey ─────────────────────────────────────────────────────────
  console.log('\n── Member journey (Playwright) ──')
  try {
    const memberCookie = await apiLogin(FIXTURE.memberEmail, FIXTURE.password)
    const memberCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
    await memberCtx.addCookies([memberCookie])
    const govPage = await memberCtx.newPage()
    await pageLoads(govPage, '/governance', 'governance page', { text: 'Member governance' })
    await memberCtx.close()
  } catch (e) {
    fail('member journey', e.message)
  }

  await browser.close()

  console.log(`\n── Playwright journeys: ${passed} passed, ${failed} failed ──`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
