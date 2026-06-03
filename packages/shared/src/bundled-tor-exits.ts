// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseTorBulkExitList } from './tor-exit-list.js'

const dataPath = join(dirname(fileURLToPath(import.meta.url)), '../data/tor-exit-cidrs.txt')

let cache: string[] | null = null

/** Bundled Tor exits (refreshed via `scripts/sync-tor-exit-list.mjs`). */
export function loadBundledTorExitCidrs(): string[] {
  if (cache) return cache
  if (!existsSync(dataPath)) {
    cache = []
    return cache
  }
  cache = parseTorBulkExitList(readFileSync(dataPath, 'utf8'))
  return cache
}
