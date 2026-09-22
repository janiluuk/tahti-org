// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Shared helpers for the 4 category journey scripts (anonymous/listener/artist/admin).
 *
 * Screenshots are captured under two Playwright `colorScheme` emulations —
 * 'light' and 'dark' — using the browser's standard prefers-color-scheme
 * media feature. This is deliberately NOT the product's own channel/dashboard
 * theme picker (`/admin/themes`, `/dashboard/channel/edit` visual presets):
 * those are per-artist branding, not a platform-wide light/dark mode. See
 * docs/todo/e2e-journey-audit.md — the web app does not currently style
 * itself differently for prefers-color-scheme: light, so light-mode captures
 * are expected to look the same as dark until that's implemented.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Best-effort — clears login rate-limit buckets between theme runs so a
 * light+dark pass never trips the same limiter a human wouldn't hit. Works
 * whether Redis is reachable via the Docker stack or a bare `redis-cli`. */
function flushRateLimits() {
  for (const composeFile of ['docker-compose.stack.yml', 'docker-compose.dev.yml']) {
    const result = spawnSync(
      'docker',
      [
        'compose',
        '-f',
        join(__dirname, '../../../infra', composeFile),
        'exec',
        '-T',
        'redis',
        'redis-cli',
        'FLUSHDB',
      ],
      { encoding: 'utf8' },
    )
    if (result.status === 0) return
  }
  spawnSync('redis-cli', ['-p', process.env.REDIS_PORT ?? '6379', 'FLUSHDB'], {
    encoding: 'utf8',
  })
}

export const THEMES = (process.env.SCREENSHOT_THEMES ?? 'light,dark')
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean)

let passed = 0
let failed = 0

export function ok(label) {
  console.log(`✓ ${label}`)
  passed++
}

export function fail(label, err) {
  console.error(`✗ ${label}${err ? ` — ${err}` : ''}`)
  failed++
}

export function counts() {
  return { passed, failed }
}

/** Run `fn(context, page, theme, outDir)` once per requested color scheme. */
export async function runThemedJourney(outRoot, viewport, fn) {
  await mkdir(outRoot, { recursive: true })
  const browser = await chromium.launch({ headless: true })
  try {
    for (const theme of THEMES) {
      flushRateLimits()
      const outDir = join(outRoot, theme)
      await mkdir(outDir, { recursive: true })
      const context = await browser.newContext({ viewport, colorScheme: theme })
      const page = await context.newPage()
      console.log(`\n── theme: ${theme} ──`)
      try {
        await fn(context, page, theme, outDir)
      } catch (e) {
        fail(`journey (${theme})`, e.message)
      }
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

export async function shot(page, outDir, file, label) {
  await page.screenshot({ path: join(outDir, file), fullPage: true })
  ok(`screenshot ${file}`)
}

export async function writeManifest(outRoot, entries) {
  for (const theme of THEMES) {
    await writeFile(join(outRoot, theme, 'manifest.json'), JSON.stringify(entries, null, 2) + '\n')
  }
}

export function summarize(name, outRoot) {
  const { passed: p, failed: f } = counts()
  console.log(`\n── ${name}: ${p} passed, ${f} failed ──`)
  console.log(`   Screenshots: ${outRoot} (${THEMES.join(', ')})`)
  if (f > 0) process.exitCode = 1
}
