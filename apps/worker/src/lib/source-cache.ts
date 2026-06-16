// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'
import { copyFile, mkdir, rm, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { downloadToFile } from './minio.js'

const CACHE_DIR = join(tmpdir(), 'tahti-source-cache')
const MAX_CACHE_ENTRIES = 6
const CACHE_TTL_MS = 45 * 60 * 1000

type CacheEntry = { path: string; lastUsed: number }

const entries = new Map<string, CacheEntry>()

function cachePathFor(sourceKey: string): string {
  const hash = createHash('sha256').update(sourceKey).digest('hex')
  return join(CACHE_DIR, hash)
}

async function evictStale(): Promise<void> {
  const now = Date.now()
  for (const [key, entry] of entries) {
    if (now - entry.lastUsed > CACHE_TTL_MS) {
      entries.delete(key)
      await rm(entry.path, { force: true }).catch(() => {})
    }
  }
  if (entries.size <= MAX_CACHE_ENTRIES) return

  const sorted = [...entries.entries()].sort((a, b) => a[1].lastUsed - b[1].lastUsed)
  while (entries.size > MAX_CACHE_ENTRIES && sorted.length > 0) {
    const [key, entry] = sorted.shift()!
    entries.delete(key)
    await rm(entry.path, { force: true }).catch(() => {})
  }
}

/** PERF-10: reuse MinIO downloads when the same sourceKey is rendered back-to-back. */
export async function downloadSourceCached(sourceKey: string, destPath: string): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true })
  await evictStale()

  const cached = entries.get(sourceKey)
  if (cached) {
    try {
      await stat(cached.path)
      await copyFile(cached.path, destPath)
      cached.lastUsed = Date.now()
      return
    } catch {
      entries.delete(sourceKey)
    }
  }

  await downloadToFile(sourceKey, destPath)
  const cachePath = cachePathFor(sourceKey)
  await copyFile(destPath, cachePath).catch(() => {})
  entries.set(sourceKey, { path: cachePath, lastUsed: Date.now() })
}
