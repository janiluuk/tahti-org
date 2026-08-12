// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { createReadStream } from 'node:fs'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from './minio.js'

const HLS_BUCKET = process.env.HLS_MINIO_BUCKET ?? 'hls-live'
const SEGMENT_RE = /\.(ts|m4s|m3u8|aac|opus|mp4)$/i

/** In-process mirror of what we've successfully PUT this process lifetime.
 * Avoids a HeadObject round-trip for every file on every 4s tick — that was
 * saturating MinIO (~90–110% CPU) and delaying syncs long enough for the
 * public ~16s HLS window to run dry, which is what listeners experience as
 * buffering. Keyed by MinIO object key → last uploaded size+mtime. */
const uploadedFingerprint = new Map<string, { size: number; mtimeMs: number }>()

function contentType(name: string): string {
  if (name.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl'
  if (name.endsWith('.ts') || name.endsWith('.m4s')) return 'video/mp2t'
  return 'application/octet-stream'
}

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  if ('name' in err && err.name === 'NotFound') return true
  if ('code' in err && (err as { code?: string }).code === 'ENOENT') return true
  if ('$metadata' in err) {
    const meta = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
    return meta?.httpStatusCode === 404
  }
  return false
}

/** True when this worker already uploaded an identical size+mtime for `key`.
 * Exported for tests; production callers go through syncChannelHlsToMinio. */
export function hlsObjectUpToDate(key: string, localSize: number, localMtimeMs: number): boolean {
  const prev = uploadedFingerprint.get(key)
  if (!prev) return false
  return prev.size === localSize && Math.abs(prev.mtimeMs - localMtimeMs) < 1000
}

/** Test helper — clear the in-process upload cache between cases. */
export function resetHlsUploadCache(): void {
  uploadedFingerprint.clear()
}

async function collectFiles(dir: string, base: string, out: string[]): Promise<void> {
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory()) {
      await collectFiles(full, base, out)
      continue
    }
    if (!SEGMENT_RE.test(entry.name)) continue
    out.push(relative(base, full))
  }
}

/** STREAM-001: mirror Liquidsoap volume output into MinIO for multi-node Caddy. */
export async function syncChannelHlsToMinio(
  root: string,
  channelId: string,
  slug: string,
): Promise<{ uploaded: number; skipped: number }> {
  const channelDir = join(root, channelId)
  const files: string[] = []
  await collectFiles(channelDir, channelDir, files)

  let uploaded = 0
  let skipped = 0

  // Live window is ~16s; anything older than a couple minutes is already off
  // the public playlist. Skipping those on cold start avoids a 20+ object PUT
  // storm that saturates MinIO and delays the next tick (which is what empties
  // the listener buffer). Playlists always sync.
  const freshnessCutoffMs = Date.now() - 120_000

  // Upload segments before playlists so a refreshed .m3u8 never points at a
  // segment that hasn't landed in MinIO yet (which would 404 listeners).
  const ranked = files
    .map((rel) => ({ rel, isPlaylist: rel.endsWith('.m3u8') }))
    .sort((a, b) => Number(a.isPlaylist) - Number(b.isPlaylist))

  for (const { rel, isPlaylist } of ranked) {
    const key = `${slug}/${rel.replace(/\\/g, '/')}`
    const src = join(channelDir, rel)
    try {
      const st = await stat(src)
      if (!isPlaylist && st.mtimeMs < freshnessCutoffMs) {
        skipped++
        continue
      }
      if (hlsObjectUpToDate(key, st.size, st.mtimeMs)) {
        skipped++
        continue
      }
      const body = createReadStream(src)
      await s3.send(
        new PutObjectCommand({
          Bucket: HLS_BUCKET,
          Key: key,
          Body: body,
          ContentType: contentType(rel),
          CacheControl: isPlaylist ? 'max-age=2' : 'max-age=60',
          ContentLength: st.size,
        }),
      )
      uploadedFingerprint.set(key, { size: st.size, mtimeMs: st.mtimeMs })
      uploaded++
    } catch (err) {
      // Liquidsoap rotates segments under us — list→stat races as ENOENT are
      // expected and noisy; anything else is worth logging.
      if (isNotFound(err)) {
        skipped++
        continue
      }
      console.error(`[hls-minio-sync] ${slug}/${rel}:`, err)
      skipped++
    }
  }

  return { uploaded, skipped }
}
