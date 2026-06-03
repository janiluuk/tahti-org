#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Capture full-page screenshots of all web routes.
 * Prerequisites: API + web running, fixtures seeded.
 *
 *   ./scripts/e2e-screenshots.sh
 *   # or after stack-up --seed: node scripts/capture-e2e-screenshots.mjs
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../docs/e2e-screenshots')
const APP = process.env.APP_URL ?? 'http://localhost:3000'
const API = process.env.API_URL ?? 'http://localhost:3001'

const FIXTURE = {
  password: 'screenshot-demo-pass',
  artist: 'screenshot-demo',
  fanEmail: 'screenshot-fan@e2e.tahti.live',
  artistEmail: 'screenshot-artist@e2e.tahti.live',
  smartLinkSlug: 'northern-lights-ep',
  verifyToken: process.env.SCREENSHOT_VERIFY_TOKEN ?? 'demo-verify-token',
}

async function login(email, password) {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`login failed for ${email}: ${res.status}`)
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/tahti_session=([^;]+)/)
  if (!match) throw new Error('no session cookie')
  return {
    name: 'tahti_session',
    value: match[1],
    domain: 'localhost',
    path: '/',
    httpOnly: true,
    sameSite: 'Lax',
  }
}

/** @type {{ id: string, path: string, label: string, auth?: 'artist' | 'fan', waitMs?: number }[]} */
const PAGES = [
  { id: '01-home', path: '/', label: 'Home' },
  { id: '02-join', path: '/join', label: 'Join (register)' },
  { id: '03-login', path: '/login', label: 'Login' },
  { id: '04-verify', path: '/verify', label: 'Verify email (landing)' },
  {
    id: '05-verify-token',
    path: `/verify?token=${FIXTURE.verifyToken}`,
    label: 'Verify email (with token)',
  },
  { id: '06-transparency', path: '/transparency', label: 'Transparency dashboard' },
  {
    id: '07-transparency-methodology',
    path: '/transparency/methodology',
    label: 'Grant methodology',
  },
  { id: '08-channel', path: `/c/${FIXTURE.artist}`, label: 'Channel (artist)', waitMs: 2000 },
  { id: '09-profile', path: `/u/${FIXTURE.artist}`, label: 'Public profile' },
  {
    id: '10-subscribe',
    path: `/u/${FIXTURE.artist}/subscribe`,
    label: 'Fan subscribe',
  },
  {
    id: '11-smart-link',
    path: `/r/${FIXTURE.smartLinkSlug}`,
    label: 'Smart link redirect',
    waitMs: 1500,
  },
  { id: '12-dashboard', path: '/dashboard', label: 'Artist dashboard', auth: 'artist' },
  { id: '13-governance', path: '/governance', label: 'Member governance', auth: 'fan' },
]

async function main() {
  await mkdir(OUT, { recursive: true })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  })

  const artistCookie = await login(FIXTURE.artistEmail, FIXTURE.password)
  const fanCookie = await login(FIXTURE.fanEmail, FIXTURE.password)

  const manifest = []

  for (const page of PAGES) {
    const ctx =
      page.auth === 'artist'
        ? await browser.newContext({ viewport: { width: 1280, height: 800 } })
        : page.auth === 'fan'
          ? await browser.newContext({ viewport: { width: 1280, height: 800 } })
          : context

    if (page.auth === 'artist') await ctx.addCookies([artistCookie])
    if (page.auth === 'fan') await ctx.addCookies([fanCookie])

    const tab = await ctx.newPage()
    const url = `${APP}${page.path}`
    // Chat/WS pages never reach networkidle; load + optional settle is enough for screenshots.
    await tab.goto(url, { waitUntil: 'load', timeout: 45_000 })
    if (page.waitMs) await tab.waitForTimeout(page.waitMs)
    const file = `${page.id}.png`
    await tab.screenshot({ path: join(OUT, file), fullPage: true })
    manifest.push({
      id: page.id,
      file,
      url: page.path,
      label: page.label,
      auth: page.auth ?? 'public',
    })
    await tab.close()
    if (page.auth) await ctx.close()
    console.log(`✓ ${file} — ${page.label}`)
  }

  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
  await browser.close()
  console.log(`\nScreenshots saved to ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
