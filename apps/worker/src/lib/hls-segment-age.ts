// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { s3 } from './minio.js'

const SEGMENT_RE = /\.(ts|m4s|aac|opus|mp4)$/i

async function newestMtimeInDir(dir: string, depth: number): Promise<number | null> {
  let newest: number | null = null
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return null
  }

  for (const entry of entries) {
    const full = join(dir, entry.name)
    if (entry.isDirectory() && depth > 0) {
      const sub = await newestMtimeInDir(full, depth - 1)
      if (sub !== null && (newest === null || sub > newest)) newest = sub
      continue
    }
    if (!entry.isFile() || !SEGMENT_RE.test(entry.name)) continue
    try {
      const st = await stat(full)
      if (newest === null || st.mtimeMs > newest) newest = st.mtimeMs
    } catch {
      // skip unreadable
    }
  }
  return newest
}

/** Age in seconds of the newest HLS segment on a local mount (STREAM-005). */
export async function hlsSegmentAgeSecFromFs(
  root: string,
  channelId: string,
): Promise<number | null> {
  const mtime = await newestMtimeInDir(join(root, channelId), 2)
  if (mtime === null) return null
  return (Date.now() - mtime) / 1000
}

/** Age in seconds of the newest object under `prefix/` in MinIO (when HLS is on S3). */
export async function hlsSegmentAgeSecFromMinio(
  bucket: string,
  prefix: string,
): Promise<number | null> {
  const keyPrefix = prefix.endsWith('/') ? prefix : `${prefix}/`
  let continuationToken: string | undefined
  let newest: number | null = null

  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: keyPrefix,
        ContinuationToken: continuationToken,
      }),
    )
    for (const obj of res.Contents ?? []) {
      if (!obj.Key || !SEGMENT_RE.test(obj.Key)) continue
      const t = obj.LastModified?.getTime()
      if (t && (newest === null || t > newest)) newest = t
    }
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined
  } while (continuationToken)

  if (newest === null) return null
  return (Date.now() - newest) / 1000
}
