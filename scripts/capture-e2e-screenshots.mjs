#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Capture full-page screenshots grouped by role (public, free, member, artist, admin).
 *
 *   ./scripts/e2e-screenshots.sh
 *   WEB_PORT=17777 API_PORT=15011 node scripts/capture-e2e-screenshots.mjs
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'
import { assertAuthenticated, apiLogin } from '../tests/e2e/lib/playwright-auth.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../docs/e2e-screenshots')
const APP = process.env.APP_URL ?? 'http://localhost:3000'
const API = process.env.API_URL ?? 'http://localhost:3001'

/** @typedef {'public' | 'free' | 'member' | 'artist' | 'admin'} AuthRole */

/**
 * @param {object} seed
 * @returns {{ role: AuthRole, id: string, path: string, label: string, waitMs?: number }[]}
 */
function buildPages(seed) {
  const artist = seed.artist ?? 'screenshot-demo'
  const collectionSlug = seed.collectionSlug ?? 'demo-mixes'
  const smartLink = seed.smartLinkSlug ?? 'northern-lights-ep'
  const releaseId = seed.releaseId ?? ''
  const verifyToken = seed.verifyToken ?? process.env.SCREENSHOT_VERIFY_TOKEN ?? 'demo-verify-token'

  /** @type {{ role: AuthRole, id: string, path: string, label: string, waitMs?: number }[]} */
  const pages = [
    // ── Public (unauthenticated) ──────────────────────────────────────────
    { role: 'public', id: 'home', path: '/', label: 'Home' },
    { role: 'public', id: 'join', path: '/join', label: 'Join (register)' },
    { role: 'public', id: 'login', path: '/login', label: 'Login' },
    { role: 'public', id: 'verify', path: '/verify', label: 'Verify email (landing)' },
    {
      role: 'public',
      id: 'verify-token',
      path: `/verify?token=${verifyToken}`,
      label: 'Verify email (with token)',
    },
    { role: 'public', id: 'status', path: '/status', label: 'Platform status' },
    { role: 'public', id: 'listen', path: '/listen', label: 'Listen hub' },
    { role: 'public', id: 'radio', path: '/radio', label: 'Tahti Radio' },
    { role: 'public', id: 'venues', path: '/venues', label: 'Venues calendar' },
    { role: 'public', id: 'apply', path: '/apply', label: 'Beta apply' },
    { role: 'public', id: 'transparency', path: '/transparency', label: 'Transparency dashboard' },
    {
      role: 'public',
      id: 'transparency-methodology',
      path: '/transparency/methodology',
      label: 'Grant methodology',
    },
    {
      role: 'public',
      id: 'channel',
      path: `/c/${artist}`,
      label: 'Channel page',
      waitMs: 2000,
    },
    { role: 'public', id: 'profile', path: `/u/${artist}`, label: 'Artist profile' },
    {
      role: 'public',
      id: 'subscribe',
      path: `/u/${artist}/subscribe`,
      label: 'Fan subscribe',
    },
    {
      role: 'public',
      id: 'collection',
      path: `/u/${artist}/c/${collectionSlug}`,
      label: 'Public collection',
    },
    {
      role: 'public',
      id: 'smart-link',
      path: `/r/${smartLink}`,
      label: 'Smart link',
      waitMs: 1500,
    },
    {
      role: 'public',
      id: 'help-tier-limits',
      path: '/help/tier-limits',
      label: 'Tier limits help',
    },
    { role: 'public', id: 'help-support', path: '/help/support', label: 'Support help' },
    { role: 'public', id: 'help-broadcast', path: '/help/broadcast', label: 'Broadcast help' },
    {
      role: 'public',
      id: 'help-multistream',
      path: '/help/multistream',
      label: 'Multistream help',
    },
    { role: 'public', id: 'help-for-artists', path: '/help/for-artists', label: 'Artist guide' },
    {
      role: 'public',
      id: 'embed-channel',
      path: `/embed/c/${artist}`,
      label: 'Embed channel player',
      waitMs: 1500,
    },
  ]

  if (releaseId) {
    pages.push({
      role: 'public',
      id: 'embed-release',
      path: `/embed/r/${releaseId}`,
      label: 'Embed release player',
      waitMs: 1500,
    })
  }

  // ── Free listener (verified, no membership) ───────────────────────────
  pages.push({
    role: 'free',
    id: 'dashboard',
    path: '/dashboard',
    label: 'Free listener dashboard',
  })

  // ── Member (financial supporter, no channel) ───────────────────────────
  pages.push(
    { role: 'member', id: 'dashboard', path: '/dashboard', label: 'Member dashboard' },
    { role: 'member', id: 'governance', path: '/governance', label: 'Member governance' },
  )

  // ── Artist (channel owner) ───────────────────────────────────────────
  pages.push(
    { role: 'artist', id: 'dashboard', path: '/dashboard', label: 'Artist dashboard' },
    {
      role: 'artist',
      id: 'channel-appearance',
      path: '/dashboard/channel/edit',
      label: 'Channel design editor',
      waitMs: 1200,
    },
    {
      role: 'artist',
      id: 'schedule-programme',
      path: '/dashboard/schedule',
      label: 'Schedule & programme',
      waitMs: 800,
    },
    {
      role: 'artist',
      id: 'broadcast-studio',
      path: '/dashboard/broadcast',
      label: 'Broadcast studio',
      waitMs: 1500,
    },
    { role: 'artist', id: 'stats', path: '/dashboard/stats', label: 'Artist stats' },
    { role: 'artist', id: 'stash', path: '/dashboard/stash', label: 'Stash file manager' },
    { role: 'artist', id: 'editor', path: '/dashboard/editor', label: 'Audio editor' },
  )

  // ── Board admin ───────────────────────────────────────────────────────
  pages.push(
    { role: 'admin', id: 'dashboard', path: '/admin/dashboard', label: 'Admin dashboard' },
    { role: 'admin', id: 'beta', path: '/admin/beta', label: 'Beta applications' },
    { role: 'admin', id: 'users', path: '/admin/users', label: 'User directory' },
    { role: 'admin', id: 'streams', path: '/admin/streams', label: 'Stream manager' },
    { role: 'admin', id: 'support', path: '/admin/support', label: 'Support tickets' },
    { role: 'admin', id: 'financial', path: '/admin/financial', label: 'Financial hub' },
    { role: 'admin', id: 'financial-ledger', path: '/admin/financial/ledger', label: 'Ledger' },
    {
      role: 'admin',
      id: 'financial-fansubs',
      path: '/admin/financial/fansubs',
      label: 'Fan subs & payouts',
    },
    {
      role: 'admin',
      id: 'financial-legacy',
      path: '/admin/financial/legacy-members',
      label: 'Legacy membership queue',
    },
    { role: 'admin', id: 'governance', path: '/admin/governance', label: 'Governance hub' },
    { role: 'admin', id: 'governance-audit', path: '/admin/governance/audit', label: 'Audit log' },
    {
      role: 'admin',
      id: 'governance-resolutions',
      path: '/admin/governance/resolutions',
      label: 'Board resolutions',
    },
    {
      role: 'admin',
      id: 'governance-report',
      path: '/admin/governance/report',
      label: 'Annual report generator',
    },
    { role: 'admin', id: 'status', path: '/admin/status', label: 'Admin status view' },
    { role: 'admin', id: 'venues', path: '/governance/venues', label: 'Venue verification queue' },
  )

  return pages
}

async function main() {
  const seedPath = join(OUT, '.seed-output.json')
  const seedRaw = await readFile(seedPath, 'utf8')
  const seed = JSON.parse(seedRaw)
  const password = seed.password ?? 'screenshot-demo-pass'

  try {
    spawnSync(
      'docker',
      [
        'compose',
        '-f',
        join(__dirname, '../infra/docker-compose.stack.yml'),
        'exec',
        '-T',
        'redis',
        'redis-cli',
        'FLUSHDB',
      ],
      {
        encoding: 'utf8',
      },
    )
  } catch {
    /* optional — clears rate-limit buckets before a long capture run */
  }

  const roleAccounts = {
    free: { email: seed.freeEmail ?? 'screenshot-free@e2e.tahti.live', password },
    member: { email: seed.memberEmail ?? 'screenshot-fan@e2e.tahti.live', password },
    artist: { email: seed.artistEmail ?? 'screenshot-artist@e2e.tahti.live', password },
    admin: { email: seed.boardEmail ?? 'screenshot-board@e2e.tahti.live', password },
  }

  const pages = buildPages(seed)
  const roles = ['public', 'free', 'member', 'artist', 'admin']
  for (const role of roles) {
    await mkdir(join(OUT, role), { recursive: true })
  }

  const browser = await chromium.launch({ headless: true })
  const publicContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  })

  /** @type {Map<AuthRole, import('playwright').BrowserContext>} */
  const roleContexts = new Map()

  async function contextForRole(role) {
    if (role === 'public') return publicContext
    if (roleContexts.has(role)) return roleContexts.get(role)
    const account = roleAccounts[role]
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      deviceScaleFactor: 1,
    })
    const cookie = await apiLogin(API, APP, account.email, account.password)
    await ctx.addCookies([cookie])
    roleContexts.set(role, ctx)
    return ctx
  }

  const manifest = []

  for (const page of pages) {
    const ctx = await contextForRole(page.role)
    const tab = await ctx.newPage()
    const url = `${APP}${page.path}`
    await tab.goto(url, { waitUntil: 'load', timeout: 45_000 })
    if (page.waitMs) await tab.waitForTimeout(page.waitMs)
    if (page.role === 'admin') await tab.waitForTimeout(2000)
    if (page.prepare) await page.prepare(tab)
    if (page.role !== 'public') {
      await assertAuthenticated(tab, `${page.role}/${page.id}`)
    }

    const file = `${page.role}/${page.id}.png`
    await tab.screenshot({ path: join(OUT, file), fullPage: true })
    manifest.push({
      role: page.role,
      id: page.id,
      file,
      url: page.path,
      label: page.label,
    })
    await tab.close()
    console.log(`✓ ${file} — ${page.label}`)
  }

  await publicContext.close()
  for (const ctx of roleContexts.values()) {
    await ctx.close()
  }
  await writeFile(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))
  await browser.close()
  console.log(`\n${manifest.length} screenshots saved under ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
