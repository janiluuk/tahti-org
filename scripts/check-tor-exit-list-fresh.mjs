#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
//
// M18: fail CI when bundled Tor exit list is empty or stale.
// Refresh with: node scripts/sync-tor-exit-list.mjs

import { readFileSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const listPath = join(root, 'packages/shared/data/tor-exit-cidrs.txt')
const maxAgeDays = Number(process.env.TOR_EXIT_LIST_MAX_AGE_DAYS ?? '30')

let stat
try {
  stat = statSync(listPath)
} catch {
  console.error(`Missing ${listPath} — run: node scripts/sync-tor-exit-list.mjs`)
  process.exit(1)
}

const body = readFileSync(listPath, 'utf8')
const lines = body.split('\n').filter((l) => l.trim() && !l.startsWith('#'))
if (lines.length === 0) {
  console.error('Tor exit list is empty — run: node scripts/sync-tor-exit-list.mjs')
  process.exit(1)
}

const ageDays = (Date.now() - stat.mtimeMs) / 86_400_000
if (ageDays > maxAgeDays) {
  console.error(
    `Tor exit list is ${ageDays.toFixed(0)} days old (max ${maxAgeDays}) — run sync-tor-exit-list.mjs`,
  )
  process.exit(1)
}

console.log(`Tor exit list OK (${lines.length} IPs, ${ageDays.toFixed(1)} days old)`)
