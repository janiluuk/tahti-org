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

/** Channel/radio pages default to the chat rail open (ChannelPageLayout) — click
 * the existing "Hide chat" toggle (.ch-chat-collapse-toggle) so the capture shows
 * the actual page content instead of an open chat log + input, matching what a
 * fresh visitor with no chat history sees most of the time anyway. */
async function collapseChat(tab) {
  const toggle = tab.locator('.ch-chat-collapse-toggle')
  if ((await toggle.count()) > 0) {
    await toggle
      .first()
      .click({ trial: false })
      .catch(() => {})
    await tab.waitForTimeout(400)
  }
}

/** Add a compact, visible annotation layer to screenshots intended for review.
 * The layer is injected only into the temporary Playwright page and is never
 * part of the product UI. */
async function annotateAdminScreenshot(tab, page) {
  await tab.evaluate(
    ({ label, path }) => {
      const style = document.createElement('style')
      style.dataset.tahtiScreenshotAnnotation = 'true'
      style.textContent = `
      [data-tahti-screenshot-annotation] { font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
      [data-tahti-screenshot-annotation="banner"] {
        position: fixed; z-index: 2147483647; top: 16px; right: 16px;
        max-width: min(420px, calc(100vw - 32px)); padding: 12px 16px;
        color: #fff; background: rgba(10, 15, 30, .94); border: 2px solid #22d3ee;
        border-radius: 10px; box-shadow: 0 8px 30px rgba(0,0,0,.35);
        font-size: 13px; line-height: 1.35; pointer-events: none;
      }
      [data-tahti-screenshot-annotation="banner"] strong { display: block; color: #22d3ee; letter-spacing: .08em; text-transform: uppercase; font-size: 11px; }
      [data-tahti-screenshot-annotation="banner"] span { display: block; margin-top: 3px; }
      [data-tahti-screenshot-annotation="marker"] {
        position: absolute; z-index: 2147483646; padding: 3px 7px; color: #061018;
        background: #22d3ee; border-radius: 999px; font: 700 11px/1 Inter, ui-sans-serif, system-ui, sans-serif;
        box-shadow: 0 2px 8px rgba(0,0,0,.3); pointer-events: none;
      }
      [data-tahti-screenshot-outline] { outline: 2px dashed #22d3ee !important; outline-offset: 4px !important; }
    `
      document.head.appendChild(style)

      const banner = document.createElement('div')
      banner.dataset.tahtiScreenshotAnnotation = 'banner'
      banner.innerHTML = `<strong>Annotated admin capture</strong><span>${label}</span><span>${path}</span>`
      document.body.appendChild(banner)

      const targets = [
        ['nav', '1 Admin navigation'],
        ['main', '2 Main workspace'],
        ['h1, h2', '3 Page heading'],
      ]
      for (const [selector, text] of targets) {
        const target = document.querySelector(selector)
        if (!target) continue
        target.dataset.tahtiScreenshotOutline = 'true'
        const marker = document.createElement('div')
        marker.dataset.tahtiScreenshotAnnotation = 'marker'
        marker.textContent = text
        const rect = target.getBoundingClientRect()
        marker.style.left = `${Math.max(8, window.scrollX + rect.left)}px`
        marker.style.top = `${Math.max(8, window.scrollY + rect.top - 10)}px`
        document.body.appendChild(marker)
      }
    },
    { label: page.label, path: page.path },
  )
  await tab.waitForTimeout(250)
}

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
    { role: 'public', id: 'signup', path: '/signup', label: 'Signup (register)' },
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
    { role: 'public', id: 'radio', path: '/radio', label: 'Tahti Radio', prepare: collapseChat },
    { role: 'public', id: 'venues', path: '/venues', label: 'Venues calendar' },
    { role: 'public', id: 'beta-apply', path: '/signup', label: 'Beta apply (signup closed)' },
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
      prepare: collapseChat,
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
    { role: 'public', id: 'help-index', path: '/help', label: 'Help center index' },
    { role: 'public', id: 'about', path: '/about', label: 'About' },
    { role: 'public', id: 'agpl', path: '/agpl', label: 'AGPL source' },
    { role: 'public', id: 'privacy', path: '/privacy', label: 'Privacy policy' },
    { role: 'public', id: 'terms', path: '/terms', label: 'Terms' },
    { role: 'public', id: 'signup', path: '/signup', label: 'Signup' },
    {
      role: 'public',
      id: 'venues-register',
      path: '/venues/register',
      label: 'Venue registration',
    },
    { role: 'public', id: 'how-it-works', path: '/how-it-works', label: 'How Tahti works' },
    {
      role: 'public',
      id: 'help-for-listeners',
      path: '/help/for-listeners',
      label: 'Listener guide',
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
      id: 'governance',
      path: '/dashboard/governance',
      label: 'Governance (dashboard)',
    },
    {
      role: 'artist',
      id: 'governance-motions',
      path: '/dashboard/governance/motions',
      label: 'Governance — motions (dashboard)',
    },
    {
      role: 'artist',
      id: 'governance-feature-requests',
      path: '/dashboard/governance/feature-requests',
      label: 'Governance — topics (dashboard)',
    },
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
  const requestedRoles = (process.env.SCREENSHOT_ROLES ?? 'public,free,member,artist,admin')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean)
  const selectedPages = pages.filter((page) => requestedRoles.includes(page.role))
  const annotateAdmin = process.env.ANNOTATE_ADMIN_SCREENSHOTS === '1'
  const roles = [...new Set(selectedPages.map((page) => page.role))]
  for (const role of roles) {
    await mkdir(join(OUT, role), { recursive: true })
  }

  // --disable-gpu and reducedMotion are defensive: the channel page's
  // WebGL background canvas already falls back to a static image cleanly
  // when no WebGL context is available (see bg-canvas.tsx), confirmed
  // working in a real browser — console shows "[bg-canvas] WebGL context
  // creation failed, using static fallback". Neither flag fixes the
  // occasional headless-only "Protocol error: Unable to capture
  // screenshot" GPU-process crash on that page (root cause still open —
  // see the worklog), but both are harmless and reduce flakiness
  // generally, so left in. The per-page try/catch below means one page
  // crashing no longer takes the rest of the run down with it.
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu'] })
  const publicContext = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
    reducedMotion: 'reduce',
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
      reducedMotion: 'reduce',
    })
    const cookie = await apiLogin(API, APP, account.email, account.password)
    await ctx.addCookies([cookie])
    roleContexts.set(role, ctx)
    return ctx
  }

  const manifest = []
  const failures = []

  for (const page of selectedPages) {
    const ctx = await contextForRole(page.role)
    const tab = await ctx.newPage()
    const file = `${page.role}/${page.id}.png`
    try {
      const url = `${APP}${page.path}`
      await tab.goto(url, { waitUntil: 'load', timeout: 45_000 })
      if (page.waitMs) await tab.waitForTimeout(page.waitMs)
      if (page.role === 'admin') await tab.waitForTimeout(2000)
      if (page.prepare) await page.prepare(tab)
      if (page.role !== 'public') {
        await assertAuthenticated(tab, `${page.role}/${page.id}`)
      }
      if (annotateAdmin && page.role === 'admin') await annotateAdminScreenshot(tab, page)

      await tab.screenshot({ path: join(OUT, file), fullPage: true })
      manifest.push({
        role: page.role,
        id: page.id,
        file,
        url: page.path,
        label: page.label,
      })
      console.log(`✓ ${file} — ${page.label}`)
    } catch (err) {
      // One page's browser/render failure (e.g. the channel page's
      // occasional headless GPU-process crash — see the comment above
      // the browser launch) shouldn't take the other ~40 screenshots
      // down with it. Keep going and report every failure at the end.
      failures.push({ file, label: page.label, error: err })
      console.error(`✗ ${file} — ${page.label}: ${err.message.split('\n')[0]}`)
    } finally {
      await tab.close().catch(() => {})
    }
  }

  await publicContext.close()
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
  if (failures.length > 0) {
    console.error(`\n${failures.length} page(s) failed to capture:`)
    for (const f of failures) console.error(`  - ${f.file} (${f.label})`)
    process.exitCode = 1
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
