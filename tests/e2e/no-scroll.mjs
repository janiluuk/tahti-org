#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * docs/design/ground-rules.md Rule 1 — no scrolling unless it's the last option.
 * Every dashboard/admin task view must fit a 1440x900 viewport without scrolling.
 *
 *   API_URL=http://localhost:15011 APP_URL=http://localhost:17777 node tests/e2e/no-scroll.mjs
 *
 * Requires API + web running and journey fixtures seeded. Mechanical first pass per
 * the brief: this produces the fail list, it does not fix anything.
 */

import { chromium } from 'playwright'

const APP = process.env.APP_URL ?? 'http://localhost:3010'
const API = process.env.API_URL ?? 'http://localhost:3011'
const PASS = process.env.E2E_DEMO_PASS ?? 'screenshot-demo-pass'
const ARTIST_EMAIL = process.env.E2E_DEMO_ARTIST_EMAIL ?? 'screenshot-artist@e2e.tahti.live'
const BOARD_EMAIL = process.env.E2E_DEMO_BOARD_EMAIL ?? 'screenshot-board@e2e.tahti.live'

const VIEWPORT = { width: 1440, height: 900 }

// Routes explicitly exempted in docs/design/ground-rules.md ("Allowed exceptions" table).
const EXEMPT = new Set([
  '/dashboard/archive', // paginated history view — header + first rows must fit, list itself may scroll
  '/dashboard/editor', // full-bleed audio editor instrument — renders tall, not scrolling
  '/admin/grants', // per-year allocation tables paginate
  '/', // marketing homepage — scroll allowed but discouraged
  '/dashboard/stats/detail', // plays chart + listener world map — shrinking the map to fit would make it illegible
])

const ARTIST_ROUTES = [
  '/dashboard',
  '/dashboard/broadcast?step=1',
  '/dashboard/broadcast?step=2',
  '/dashboard/broadcast?step=3',
  '/dashboard/broadcast?step=4',
  '/dashboard/channel',
  '/dashboard/collections',
  '/dashboard/collections/new',
  '/dashboard/releases',
  '/dashboard/revenue',
  '/dashboard/schedule',
  '/dashboard/settings',
  '/dashboard/settings/account',
  '/dashboard/settings/connections',
  '/dashboard/settings/distribution',
  '/dashboard/settings/domain',
  '/dashboard/settings/fan-subs',
  '/dashboard/settings/mentions',
  '/dashboard/settings/moderators',
  '/dashboard/settings/multistream',
  '/dashboard/setup-channel',
  '/dashboard/stash',
  '/dashboard/stats',
  '/dashboard/stats/detail',
  '/dashboard/upload',
  '/dashboard/venues',
  '/dashboard/archive',
]

const BOARD_ROUTES = [
  '/admin',
  '/admin/agm',
  '/admin/beta',
  '/admin/dashboard',
  '/admin/financial',
  '/admin/financial/fansubs',
  '/admin/financial/ledger',
  '/admin/financial/legacy-members',
  '/admin/governance',
  '/admin/governance/audit',
  '/admin/governance/report',
  '/admin/governance/resolutions',
  '/admin/grants',
  '/admin/radio',
  '/admin/settings/vendors',
  '/admin/status',
  '/admin/streams',
  '/admin/support',
  '/admin/tahti-selects',
  '/admin/users',
]

const PUBLIC_ROUTES = ['/signup', '/transparency', '/governance']

let passed = 0
let failed = 0
const failList = []

function ok(label) {
  console.log(`✓ ${label}`)
  passed++
}

function fail(label, detail) {
  console.error(`✗ ${label}${detail ? ` — ${detail}` : ''}`)
  failed++
  failList.push(label)
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

async function checkRoute(page, route) {
  const label = `${route} fits 1440x900 without scrolling`
  try {
    const res = await page.goto(`${APP}${route}`, { waitUntil: 'load', timeout: 30_000 })
    if (!res?.ok()) {
      fail(label, `HTTP ${res?.status()}`)
      return
    }
    await page.waitForTimeout(200)
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight)
    const clientHeight = await page.evaluate(() => document.documentElement.clientHeight)

    if (EXEMPT.has(route)) {
      console.log(`○ ${route} — exempt (scrollHeight ${scrollHeight}, viewport ${clientHeight})`)
      return
    }

    if (scrollHeight <= clientHeight) {
      ok(`${label} (scrollHeight ${scrollHeight})`)
    } else {
      fail(label, `scrollHeight ${scrollHeight} > clientHeight ${clientHeight}`)
    }
  } catch (e) {
    fail(label, e.message)
  }
}

async function main() {
  const health = await fetch(`${API}/health`)
  if (!health.ok) {
    console.error(`API not healthy at ${API}`)
    process.exit(1)
  }

  const browser = await chromium.launch({ headless: true })

  console.log('\n── Artist dashboard routes ──')
  try {
    const cookie = await apiLogin(ARTIST_EMAIL, PASS)
    const ctx = await browser.newContext({ viewport: VIEWPORT })
    await ctx.addCookies([cookie])
    const page = await ctx.newPage()
    for (const route of ARTIST_ROUTES) {
      await checkRoute(page, route)
    }
    await ctx.close()
  } catch (e) {
    fail('artist login', e.message)
  }

  console.log('\n── Board/admin routes ──')
  try {
    const cookie = await apiLogin(BOARD_EMAIL, PASS)
    const ctx = await browser.newContext({ viewport: VIEWPORT })
    await ctx.addCookies([cookie])
    const page = await ctx.newPage()
    for (const route of BOARD_ROUTES) {
      await checkRoute(page, route)
    }
    await ctx.close()
  } catch (e) {
    fail('board login', e.message)
  }

  console.log('\n── Public routes ──')
  {
    const ctx = await browser.newContext({ viewport: VIEWPORT })
    const page = await ctx.newPage()
    for (const route of PUBLIC_ROUTES) {
      await checkRoute(page, route)
    }
    await ctx.close()
  }

  await browser.close()

  console.log(`\n── No-scroll audit: ${passed} passed, ${failed} failed ──`)
  if (failList.length > 0) {
    console.log('\nFail list (ground-rules.md Rule 1 work queue):')
    for (const f of failList) console.log(`  - ${f}`)
  }
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
