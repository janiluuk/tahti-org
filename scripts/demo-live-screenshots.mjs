#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Seeds demo data on the running stack, sets the artist channel to LIVE,
 * injects chat messages via Centrifugo, and captures focused screenshots
 * showing a live channel with active chat.
 *
 * Usage:
 *   ./scripts/demo-live-screenshots.mjs
 *   WEB_PORT=17777 API_PORT=15011 CHAT_PORT=18000 node scripts/demo-live-screenshots.mjs
 *   WEB_PORT=17777 API_PORT=15011 CHAT_PORT=18000 SKIP_SEED=1 node scripts/demo-live-screenshots.mjs
 */

import { execSync, spawn } from 'node:child_process'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'docs', 'e2e-screenshots')

const WEB_PORT = process.env.WEB_PORT ?? '17777'
const API_PORT = process.env.API_PORT ?? '15011'
const CHAT_PORT = process.env.CHAT_PORT ?? '18000'
const CENTRIFUGO_API_KEY = process.env.CENTRIFUGO_API_KEY ?? 'dev'
const SKIP_SEED = !!process.env.SKIP_SEED

const APP_URL = process.env.APP_URL ?? `http://localhost:${WEB_PORT}`
const API_URL = process.env.API_URL ?? `http://localhost:${API_PORT}`
const CHAT_API_URL = process.env.CHAT_API_URL ?? `http://localhost:${CHAT_PORT}/api`

const DEMO_CHAT = [
  { handle: 'mikko_h', text: 'amazing set 🔥', countryCode: 'FI', supporter: false },
  { handle: 'jens_rave', text: 'what track is this?', countryCode: 'DE', supporter: false },
  { handle: 'saara_k', text: 'this bassline 😍', countryCode: 'FI', supporter: true },
  { handle: 'nord_beat', text: 'been waiting for this one', countryCode: 'SE', supporter: false },
  { handle: 'toni_v', text: 'top shelf as always', countryCode: 'FI', supporter: true },
]

async function centrifugoPublish(channel, data) {
  const res = await fetch(CHAT_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `apikey ${CENTRIFUGO_API_KEY}`,
    },
    body: JSON.stringify({ method: 'publish', params: { channel, data } }),
  })
  if (!res.ok) throw new Error(`Centrifugo publish failed: ${res.status}`)
}

async function login(email, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
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

async function seedAndActivate() {
  console.log('── Seeding demo data on stack ──')
  const seedJson = execSync(`docker exec tahti-stack-api-1 tsx apps/api/scripts/seed-e2e-screenshots.ts`, {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit'],
  })
  const seed = JSON.parse(seedJson.trim())
  await writeFile(join(OUT, '.seed-output.json'), JSON.stringify(seed, null, 2))
  console.log(`   Artist: @${seed.artist}`)

  console.log('── Setting channel to LIVE ──')
  execSync(`docker cp apps/api/scripts/set-channel-live.ts tahti-stack-api-1:/app/apps/api/scripts/`, {
    encoding: 'utf8',
    cwd: ROOT,
    stdio: 'inherit',
  })
  execSync(`docker exec tahti-stack-api-1 tsx apps/api/scripts/set-channel-live.ts ${seed.artist}`, {
    encoding: 'utf8',
    stdio: 'inherit',
  })

  return seed
}

async function startTunnels() {
  // NEXT_PUBLIC_CENTRIFUGO_WS defaults to ws://localhost:8000 — proxy it to the
  // chat container's published port (CHAT_PORT=18000) so the browser's WS connects.
  console.log(`── Forwarding localhost:8000 → localhost:${CHAT_PORT} (Centrifugo) ──`)
  const proc = spawn('socat', [`TCP-LISTEN:8000,fork,reuseaddr`, `TCP:localhost:${CHAT_PORT}`], {
    stdio: 'ignore',
  })
  await new Promise((r) => setTimeout(r, 500))
  return proc
}

async function captureWithChat(seed) {
  const artist = seed.artist
  const password = seed.password ?? 'screenshot-demo-pass'

  const artistCookie = await login(seed.artistEmail, password)
  const freeCookie = await login(seed.freeEmail, password)

  const browser = await chromium.launch({ headless: true })

  const shots = [
    { role: 'public', id: 'channel-live', path: `/c/${artist}`, label: 'Live channel (public view)', live: true },
    { role: 'artist', id: 'dashboard', path: '/dashboard', label: 'Artist dashboard' },
    { role: 'free', id: 'listen', path: '/listen', label: 'Listen hub' },
    { role: 'public', id: 'listen', path: '/listen', label: 'Listen hub (public)' },
    { role: 'public', id: 'profile', path: `/u/${artist}`, label: 'Artist public profile' },
  ]

  for (const shot of shots) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 })

    if (shot.role === 'artist') await ctx.addCookies([artistCookie])
    if (shot.role === 'free') await ctx.addCookies([freeCookie])

    const page = await ctx.newPage()
    await page.goto(`${APP_URL}${shot.path}`, { waitUntil: 'load', timeout: 45_000 })
    await page.waitForTimeout(1500)

    if (shot.live) {
      // Inject chat messages while browser is subscribed
      const slug = artist
      const channelName = `channel:${slug}`
      for (const msg of DEMO_CHAT) {
        await centrifugoPublish(channelName, { ...msg, ts: Date.now() })
        await new Promise((r) => setTimeout(r, 120))
      }
      // Wait for messages to render
      await page.waitForTimeout(800)
    }

    const dir = join(OUT, shot.role)
    await mkdir(dir, { recursive: true })
    const file = join(dir, `${shot.id}.png`)
    await page.screenshot({ path: file, fullPage: true })
    console.log(`✓ ${shot.role}/${shot.id}.png — ${shot.label}`)

    await page.close()
    await ctx.close()
  }

  await browser.close()
}

async function main() {
  let seed

  if (SKIP_SEED) {
    const raw = await readFile(join(OUT, '.seed-output.json'), 'utf8')
    seed = JSON.parse(raw)
    console.log(`── Using existing seed (@${seed.artist}) ──`)
  } else {
    seed = await seedAndActivate()
  }

  // Verify stack reachable
  const health = await fetch(`${API_URL}/health`).then((r) => r.json()).catch(() => null)
  if (!health || health.status !== 'ok') {
    console.error(`API not reachable at ${API_URL}`)
    process.exit(1)
  }
  console.log(`   Stack healthy (${JSON.stringify(health.checks)})`)

  const tunnels = await startTunnels()

  try {
    await captureWithChat(seed)
  } finally {
    tunnels.kill()
  }

  // Copy key screenshots to web public dir for /for-artists page
  const webPublicDir = join(ROOT, 'apps', 'web', 'public', 'screenshots')
  await mkdir(webPublicDir, { recursive: true })
  const copies = [
    ['public/channel-live.png', 'channel.png'],
    ['artist/dashboard.png', 'dashboard.png'],
    ['public/listen.png', 'listen.png'],
    ['public/profile.png', 'profile.png'],
  ]
  for (const [src, dest] of copies) {
    try {
      const data = await readFile(join(OUT, src))
      await writeFile(join(webPublicDir, dest), data)
      console.log(`   → apps/web/public/screenshots/${dest}`)
    } catch {
      console.warn(`   ! could not copy ${src} (skipping)`)
    }
  }

  console.log('\n── Done ──')
  console.log(`   Screenshots: docs/e2e-screenshots/`)
  console.log(`   Web public:  apps/web/public/screenshots/`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
