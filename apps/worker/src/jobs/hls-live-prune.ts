// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { s3 } from '../lib/minio.js'

const HLS_BUCKET = process.env.HLS_MINIO_BUCKET ?? 'hls-live'
// The public live window is ~16s (see hls-minio-sync.ts); anything older than
// a few hours is dead weight. Well short of the bucket's 1-day MinIO ILM
// expiry (minio-lifecycle.ts) — this is a backstop in case ILM lags or the
// policy was never applied (confirmed live: it wasn't, for 6+ weeks, which
// grew hls-live to 3.7M objects / ~600GB and filled the host disk to 92%).
const STALE_MS = 6 * 60 * 60 * 1000
const DELETE_BATCH_SIZE = 1000

export async function processHlsLivePruneJob(
  _job: Job,
): Promise<{ scanned: number; deleted: number }> {
  const cutoff = Date.now() - STALE_MS
  let scanned = 0
  let deleted = 0
  let continuationToken: string | undefined

  do {
    const page = await s3.send(
      new ListObjectsV2Command({
        Bucket: HLS_BUCKET,
        ContinuationToken: continuationToken,
      }),
    )
    const stale = (page.Contents ?? []).filter(
      (obj) => obj.Key && obj.LastModified && obj.LastModified.getTime() < cutoff,
    )
    scanned += page.Contents?.length ?? 0

    for (let i = 0; i < stale.length; i += DELETE_BATCH_SIZE) {
      const batch = stale.slice(i, i + DELETE_BATCH_SIZE)
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: HLS_BUCKET,
          Delete: { Objects: batch.map((obj) => ({ Key: obj.Key! })) },
        }),
      )
      deleted += batch.length
    }

    continuationToken = page.IsTruncated ? page.NextContinuationToken : undefined
  } while (continuationToken)

  if (deleted > 0) {
    console.log(`[hls-live-prune] scanned=${scanned} deleted=${deleted}`)
  }
  return { scanned, deleted }
}
