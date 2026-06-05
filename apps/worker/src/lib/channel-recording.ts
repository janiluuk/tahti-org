// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { access, readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'

/** Predictable path from ffmpeg recorder sidecar (STREAM-004). */
export function broadcastRecordingFileName(broadcastId: string): string {
  return `broadcast-${broadcastId}.wav`
}

/** Prefer ffmpeg sidecar file; fall back to legacy Liquidsoap timestamped WAVs. */
export async function findChannelBroadcastRecording(
  recordingsRoot: string,
  channelId: string,
  broadcastId: string,
  notBefore: Date,
): Promise<string | null> {
  const sidecarPath = join(recordingsRoot, channelId, broadcastRecordingFileName(broadcastId))
  try {
    await access(sidecarPath)
    const st = await stat(sidecarPath)
    if (st.isFile() && st.size > 0) return sidecarPath
  } catch {
    // sidecar not ready yet — scan legacy files
  }

  return findLatestChannelRecording(recordingsRoot, channelId, notBefore)
}

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
    if (!name.endsWith('.wav') || name.startsWith('broadcast-')) continue
    const path = join(dir, name)
    const st = await stat(path)
    if (!st.isFile() || st.mtimeMs < cutoff) continue
    if (!best || st.mtimeMs > best.mtime) {
      best = { path, mtime: st.mtimeMs }
    }
  }

  return best?.path ?? null
}
