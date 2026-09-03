#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/**
 * Capture full-page screenshots at a mobile viewport for the artist dashboard
 * (`/dashboard/*`) and admin (`/admin/*`) routes, for a mobile UX sweep.
 *
 * Reuses buildPages()/auth helpers from capture-e2e-screenshots.mjs but only
 * captures role === 'artist' || role === 'admin' pages, at 390x844
 * (iPhone 12/13/14) with deviceScaleFactor 2. Desktop script is untouched.
 *
 *   ./scripts/stack-up.sh --seed
 *   WEB_PORT=17777 API_PORT=15011 node scripts/capture-mobile-screenshots.mjs
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'
import { assertAuthenticated, apiLogin } from '../tests/e2e/lib/playwright-auth.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '../docs/e2e-screenshots-mobile')
const APP = process.env.APP_URL ?? 'http://localhost:3000'
const API = process.env.API_URL ?? 'http://localhost:3001'

const MOBILE_VIEWPORT = { width: 390, height: 844 }
const MOBILE_DEVICE_SCALE_FACTOR = 2

/**
 * Same page inventory as capture-e2e-screenshots.mjs's buildPages() (kept in
 * sync manually — that script is not modified/exported from, per the mobile
 * sweep task, so the relevant subset is duplicated here). Only artist/admin
 * entries are used by main() below.
 *
 * @param {object} seed
 * @returns {{ role: 'artist' | 'admin', id: string, path: string, label: string, waitMs?: number }[]}
 */
function buildPages(seed) {
  /** @type {{ role: 'artist' | 'admin', id: string, path: string, label: string, waitMs?: number }[]} */
  const pages = []

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
    { role: 'artist', id: 'stats-detail', path: '/dashboard/stats/detail', label: 'Stats detail' },
    { role: 'artist', id: 'stash', path: '/dashboard/stash', label: 'Stash file manager' },
    { role: 'artist', id: 'editor', path: '/dashboard/editor', label: 'Audio editor' },
    { role: 'artist', id: 'revenue', path: '/dashboard/revenue', label: 'Revenue' },
    { role: 'artist', id: 'upload', path: '/dashboard/upload', label: 'Upload' },
    {
      role: 'artist',
      id: 'newsletter-compose',
      path: '/dashboard/newsletter/compose',
      label: 'Newsletter compose',
    },
    { role: 'artist', id: 'venues', path: '/dashboard/venues', label: 'Venue bookings' },
    { role: 'artist', id: 'releases', path: '/dashboard/releases', label: 'Releases catalog' },
    { role: 'artist', id: 'collections', path: '/dashboard/collections', label: 'Collections' },
    {
      role: 'artist',
      id: 'collections-new',
      path: '/dashboard/collections/new',
      label: 'New collection',
    },
    { role: 'artist', id: 'archive', path: '/dashboard/archive', label: 'Archive history' },
    {
      role: 'artist',
      id: 'settings-account',
      path: '/dashboard/settings/account',
      label: 'Settings — account',
    },
    {
      role: 'artist',
      id: 'settings-artist-info',
      path: '/dashboard/settings/artist-info',
      label: 'Settings — artist info',
    },
    {
      role: 'artist',
      id: 'settings-connections',
      path: '/dashboard/settings/connections',
      label: 'Settings — connections',
    },
    {
      role: 'artist',
      id: 'settings-distribution',
      path: '/dashboard/settings/distribution',
      label: 'Settings — distribution',
    },
    {
      role: 'artist',
      id: 'settings-domain',
      path: '/dashboard/settings/domain',
      label: 'Settings — custom domain',
    },
    {
      role: 'artist',
      id: 'settings-fan-subs',
      path: '/dashboard/settings/fan-subs',
      label: 'Settings — fan subs',
    },
    {
      role: 'artist',
      id: 'settings-mentions',
      path: '/dashboard/settings/mentions',
      label: 'Settings — mentions',
    },
    {
      role: 'artist',
      id: 'settings-moderators',
      path: '/dashboard/settings/moderators',
      label: 'Settings — moderators',
    },
    {
      role: 'artist',
      id: 'settings-multistream',
      path: '/dashboard/settings/multistream',
      label: 'Settings — multistream',
    },
    {
      role: 'artist',
      id: 'settings-notifications',
      path: '/dashboard/settings/notifications',
      label: 'Settings — notifications',
    },
  )

  if (seed.releaseId) {
    pages.push({
      role: 'artist',
      id: 'release-detail',
      path: `/dashboard/releases/${seed.releaseId}`,
      label: 'Release detail',
    })
  }
  if (seed.collectionSlug) {
    pages.push({
      role: 'artist',
      id: 'collection-editor',
      path: `/dashboard/collections/${seed.collectionSlug}`,
      label: 'Collection editor',
    })
  }
  if (seed.archiveItemId) {
    pages.push(
      {
        role: 'artist',
        id: 'archive-item',
        path: `/dashboard/archive/${seed.archiveItemId}`,
        label: 'Archive item preview',
      },
      {
        role: 'artist',
        id: 'archive-item-editor',
        path: `/dashboard/archive/${seed.archiveItemId}/editor`,
        label: 'Archive item — audio editor',
        waitMs: 1500,
      },
    )
  }
  if (seed.editorProjectId) {
    pages.push({
      role: 'artist',
      id: 'editor-project',
      path: `/dashboard/editor/${seed.editorProjectId}`,
      label: 'Editor project',
      waitMs: 1500,
    })
  }

  // ── Board admin ───────────────────────────────────────────────────────
  pages.push(
    { role: 'admin', id: 'dashboard', path: '/admin/dashboard', label: 'Admin dashboard' },
    { role: 'admin', id: 'beta', path: '/admin/beta', label: 'Beta applications' },
    { role: 'admin', id: 'users', path: '/admin/users', label: 'User directory' },
    { role: 'admin', id: 'streams', path: '/admin/streams', label: 'Stream manager' },
    { role: 'admin', id: 'support', path: '/admin/support', label: 'Support tickets' },
    { role: 'admin', id: 'news', path: '/admin/news', label: 'Site news' },
    {
      role: 'admin',
      id: 'announcements',
      path: '/admin/announcements',
      label: 'Announcement clips',
    },
    {
      role: 'admin',
      id: 'radio-submissions',
      path: '/admin/radio-submissions',
      label: 'Radio submissions',
    },
    { role: 'admin', id: 'missed-shows', path: '/admin/missed-shows', label: 'Missed shows' },
    { role: 'admin', id: 'top-lists', path: '/admin/top-lists', label: 'Top lists' },
    { role: 'admin', id: 'addons', path: '/admin/addons', label: 'Addons' },
    { role: 'admin', id: 'themes', path: '/admin/themes', label: 'Interface themes' },
    {
      role: 'admin',
      id: 'internet-radio',
      path: '/admin/internet-radio',
      label: 'Internet radio',
    },
    { role: 'admin', id: 'storage', path: '/admin/storage', label: 'Storage overview' },
    { role: 'admin', id: 'files', path: '/admin/files', label: 'File browser' },
    {
      role: 'admin',
      id: 'content-reports',
      path: '/admin/content-reports',
      label: 'Content reports',
    },
    {
      role: 'admin',
      id: 'feature-requests',
      path: '/admin/feature-requests',
      label: 'Feature requests',
    },
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
    { role: 'admin', id: 'grants', path: '/admin/grants', label: 'Grants overview' },
    { role: 'admin', id: 'agm', path: '/admin/agm', label: 'AGM' },
    { role: 'admin', id: 'radio', path: '/admin/radio', label: 'Tahti Radio admin' },
    {
      role: 'admin',
      id: 'settings-vendors',
      path: '/admin/settings/vendors',
      label: 'Vendor settings',
    },
    {
      role: 'admin',
      id: 'tahti-selects',
      path: '/admin/tahti-selects',
      label: 'Tahti Selects admin',
    },
  )

  return pages
}

async function main() {
  const seedPath = join(__dirname, '../docs/e2e-screenshots/.seed-output.json')
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
    artist: { email: seed.artistEmail ?? 'screenshot-artist@e2e.tahti.live', password },
    admin: { email: seed.boardEmail ?? 'screenshot-board@e2e.tahti.live', password },
  }

  const pages = buildPages(seed)
  const roles = ['artist', 'admin']
  for (const role of roles) {
    await mkdir(join(OUT, role), { recursive: true })
  }

  const browser = await chromium.launch({ headless: true })

  /** @type {Map<string, import('playwright').BrowserContext>} */
  const roleContexts = new Map()

  async function contextForRole(role) {
    if (roleContexts.has(role)) return roleContexts.get(role)
    const account = roleAccounts[role]
    const ctx = await browser.newContext({
      viewport: MOBILE_VIEWPORT,
      deviceScaleFactor: MOBILE_DEVICE_SCALE_FACTOR,
      isMobile: true,
      hasTouch: true,
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
    await assertAuthenticated(tab, `${page.role}/${page.id}`)

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

  for (const ctx of roleContexts.values()) {
    await ctx.close()
  }
  const manifestPath = join(OUT, 'manifest.json')
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2))
  // Plain JSON.stringify output doesn't match the repo's prettier config —
  // format in place so `pnpm format:check` never flags a freshly-captured
  // manifest (see the api-client schema.d.ts generator for the same fix).
  spawnSync('pnpm', ['exec', 'prettier', '--write', manifestPath], {
    cwd: join(__dirname, '..'),
    stdio: 'ignore',
  })
  await browser.close()
  console.log(`\n${manifest.length} screenshots saved under ${OUT}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
