// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

/** Newest Liquidsoap WAV under recordings/<channelId>/ modified at or after broadcast start. */
export async function findLatestChannelRecording(
  recordingsRoot: string,
  channelId: string,
  notBefore: Date,
): Promise<string | null> {
  const dir = join(recordingsRoot, channelId)
  let entries: string[]
  try {
    entries = await readdir(dir)
  } catch {
    return null
  }

  const cutoff = notBefore.getTime() - 5000
  let best: { path: string; mtime: number } | null = null

  for (const name of entries) {
    if (!name.endsWith('.wav')) continue
    const path = join(dir, name)
    const st = await stat(path)
    if (!st.isFile() || st.mtimeMs < cutoff) continue
    if (!best || st.mtimeMs > best.mtime) {
      best = { path, mtime: st.mtimeMs }
    }
  }

  return best?.path ?? null
}
