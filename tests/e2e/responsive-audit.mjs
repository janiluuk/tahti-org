#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Responsive audit — unlike no-scroll.mjs (desktop, vertical scroll forbidden), vertical
 * scrolling is expected and fine at mobile/tablet widths. What's NOT fine at any width is
 * horizontal overflow (a fixed-width element forcing the page wider than the viewport) —
 * that's always a real bug, never intentional. This script checks horizontal overflow
 * across every known route at three breakpoints, then screenshots a representative sample
 * for manual visual-consistency review (nav patterns, spacing, text truncation).
 *
 *   API_URL=http://localhost:3001 APP_URL=http://localhost:3010 node tests/e2e/responsive-audit.mjs
 */

import { chromium } from 'playwright'

const APP = process.env.APP_URL ?? 'http://localhost:3010'
const API = process.env.API_URL ?? 'http://localhost:3001'
const PASS = process.env.E2E_DEMO_PASS ?? 'screenshot-demo-pass'
const ARTIST_EMAIL = process.env.E2E_DEMO_ARTIST_EMAIL ?? 'screenshot-artist@e2e.tahti.live'
const BOARD_EMAIL = process.env.E2E_DEMO_BOARD_EMAIL ?? 'screenshot-board@e2e.tahti.live'
const CHANNEL_SLUG = process.env.E2E_DEMO_CHANNEL_SLUG ?? 'screenshot-demo'
const SHOT_DIR =
  process.env.SHOT_DIR ??
  '/tmp/claude-1000/-home-jani-workspace-tahti/5aff7049-06fa-4bab-80a9-9e994d3ce131/scratchpad/responsive'

const BREAKPOINTS = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'narrow-desktop', width: 1024, height: 768 },
]

const PUBLIC_ROUTES = [
  '/',
  '/listen',
  '/radio',
  '/venues',
  '/help',
  '/governance',
  '/transparency',
  '/login',
  '/signup',
  '/join',
  `/c/${CHANNEL_SLUG}`,
  `/u/${CHANNEL_SLUG}`,
]

const ARTIST_ROUTES = [
  '/dashboard',
  '/dashboard/broadcast?step=1',
  '/dashboard/channel/edit',
  '/dashboard/upload',
  '/dashboard/archive',
  '/dashboard/collections',
  '/dashboard/stats',
  '/dashboard/settings',
  '/dashboard/settings/account',
  '/dashboard/settings/artist-info',
  '/dashboard/venues',
  '/dashboard/stash',
]

const BOARD_ROUTES = ['/admin', '/admin/dashboard', '/admin/financial', '/admin/governance']

let checked = 0
let overflowing = 0
const overflowList = []

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

async function checkRoute(page, route, bp) {
  checked++
  const label = `[${bp.name} ${bp.width}px] ${route}`
  try {
    const res = await page.goto(`${APP}${route}`, { waitUntil: 'load', timeout: 30_000 })
    if (!res?.ok()) {
      console.error(`✗ ${label} — HTTP ${res?.status()}`)
      return
    }
    await page.waitForTimeout(250)
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }))
    if (scrollWidth > clientWidth + 1) {
      // +1px tolerance for subpixel rounding
      overflowing++
      overflowList.push(`${label} — scrollWidth ${scrollWidth} > clientWidth ${clientWidth}`)
      console.error(`✗ ${label} — horizontal overflow: ${scrollWidth} > ${clientWidth}`)
    } else {
      console.log(`✓ ${label} — no horizontal overflow`)
    }
  } catch (e) {
    console.error(`✗ ${label} — ${e.message}`)
  }
}

async function screenshotSample(browser, cookie) {
  const fs = await import('node:fs/promises')
  await fs.mkdir(SHOT_DIR, { recursive: true })

  for (const bp of BREAKPOINTS) {
    const ctx = await browser.newContext({ viewport: { width: bp.width, height: bp.height } })
    if (cookie) await ctx.addCookies([cookie])
    const page = await ctx.newPage()
    const samples = ['/', `/c/${CHANNEL_SLUG}`, '/login', '/dashboard', '/dashboard/upload']
    for (const route of samples) {
      try {
        await page.goto(`${APP}${route}`, { waitUntil: 'load', timeout: 30_000 })
        await page.waitForTimeout(300)
        const safeName = route.replace(/[^a-z0-9]+/gi, '-') || 'home'
        await page.screenshot({
          path: `${SHOT_DIR}/${bp.name}${safeName}.png`,
          fullPage: true,
        })
      } catch (e) {
        console.error(`screenshot failed for ${bp.name} ${route}: ${e.message}`)
      }
    }
    await ctx.close()
  }
}

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }

  const browser = await chromium.launch({ headless: true })

  // Log in once per role and reuse the cookie across all breakpoints — logging in
  // per-breakpoint burns through the 10/60s auth rate limit for no reason.
  let artistCookie = null
  try {
    artistCookie = await apiLogin(ARTIST_EMAIL, PASS)
  } catch (e) {
    console.error(`artist login failed: ${e.message}`)
  }
  let boardCookie = null
  try {
    boardCookie = await apiLogin(BOARD_EMAIL, PASS)
  } catch (e) {
    console.error(`board login failed: ${e.message}`)
  }

  for (const bp of BREAKPOINTS) {
    console.log(`\n── Public routes @ ${bp.name} (${bp.width}px) ──`)
    const ctx = await browser.newContext({ viewport: { width: bp.width, height: bp.height } })
    const page = await ctx.newPage()
    for (const route of PUBLIC_ROUTES) await checkRoute(page, route, bp)
    await ctx.close()

    console.log(`\n── Artist dashboard routes @ ${bp.name} (${bp.width}px) ──`)
    if (artistCookie) {
      const actx = await browser.newContext({ viewport: { width: bp.width, height: bp.height } })
      await actx.addCookies([artistCookie])
      const apage = await actx.newPage()
      for (const route of ARTIST_ROUTES) await checkRoute(apage, route, bp)
      await actx.close()
    } else {
      console.error('skipped — no artist cookie')
    }

    console.log(`\n── Board/admin routes @ ${bp.name} (${bp.width}px) ──`)
    if (boardCookie) {
      const bctx = await browser.newContext({ viewport: { width: bp.width, height: bp.height } })
      await bctx.addCookies([boardCookie])
      const bpage = await bctx.newPage()
      for (const route of BOARD_ROUTES) await checkRoute(bpage, route, bp)
      await bctx.close()
    } else {
      console.error('skipped — no board cookie')
    }
  }

  console.log('\n── Taking sample screenshots for visual review ──')
  await screenshotSample(browser, artistCookie)

  await browser.close()

  console.log(`\n── Responsive audit: ${checked} checked, ${overflowing} with horizontal overflow ──`)
  if (overflowList.length > 0) {
    console.log('\nHorizontal overflow list:')
    for (const f of overflowList) console.log(`  - ${f}`)
  }
  console.log(`\nScreenshots written to ${SHOT_DIR}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
