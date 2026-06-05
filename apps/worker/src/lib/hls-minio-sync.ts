// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readdir, stat } from 'node:fs/promises'
import { join, relative } from 'node:path'
import { createReadStream } from 'node:fs'
import { HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from './minio.js'

const HLS_BUCKET = process.env.HLS_MINIO_BUCKET ?? 'hls-live'
const SEGMENT_RE = /\.(ts|m4s|m3u8|aac|opus|mp4)$/i

function contentType(name: string): string {
  if (name.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl'
  if (name.endsWith('.ts') || name.endsWith('.m4s')) return 'video/mp2t'
  return 'application/octet-stream'
}

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  if ('name' in err && err.name === 'NotFound') return true
  if ('$metadata' in err) {
    const meta = (err as { $metadata?: { httpStatusCode?: number } }).$metadata
    return meta?.httpStatusCode === 404
  }
  return false
}

/** True when MinIO already has an object at least as fresh as the local file. */
export async function hlsObjectUpToDate(
  key: string,
  localSize: number,
  localMtimeMs: number,
): Promise<boolean> {
  try {
    const head = await s3.send(new HeadObjectCommand({ Bucket: HLS_BUCKET, Key: key }))
    if (head.ContentLength !== localSize) return false
    const remoteMs = head.LastModified?.getTime() ?? 0
    return remoteMs >= localMtimeMs - 1000
  } catch (err) {
    if (isNotFound(err)) return false
    throw err
  }
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

  for (const rel of files) {
    const key = `${slug}/${rel.replace(/\\/g, '/')}`
    const src = join(channelDir, rel)
    try {
      const st = await stat(src)
      if (await hlsObjectUpToDate(key, st.size, st.mtimeMs)) {
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
          CacheControl: rel.endsWith('.m3u8') ? 'max-age=2' : 'max-age=60',
          ContentLength: st.size,
        }),
      )
      uploaded++
    } catch (err) {
      console.error(`[hls-minio-sync] ${slug}/${rel}:`, err)
      skipped++
    }
  }

  return { uploaded, skipped }
}
