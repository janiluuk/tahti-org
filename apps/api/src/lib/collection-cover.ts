// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { config } from '../config.js'
import { presignedGetUrl } from './minio.js'

const COVER_PRESIGN_SEC = 3600

/** Existing rows from before coverKey existed only have a public-style coverUrl —
 * derive the object key from it when it points at our own bucket, so legacy covers
 * still resolve to a presigned URL instead of silently 403ing once the bucket's
 * anonymous-read grant for tahti/collections is removed. */
function keyFromOwnUrl(url: string): string | null {
  const prefix = `${config.minio.publicEndpoint.replace(/\/$/, '')}/${config.minio.bucket}/`
  if (!url.startsWith(prefix)) return null
  return url.slice(prefix.length) || null
}

/** Collection covers aren't gated by isPublic at upload time, so — unlike
 * avatars/press-kit/archive banners — the tahti/collections prefix is NOT
 * publicly readable. Every read path must resolve through here instead of
 * using collection.coverUrl directly. */
export async function resolveCollectionCoverUrl(collection: {
  coverUrl: string | null
  coverKey: string | null
}): Promise<string | null> {
  const key =
    collection.coverKey ?? (collection.coverUrl ? keyFromOwnUrl(collection.coverUrl) : null)
  if (key) return presignedGetUrl(key, COVER_PRESIGN_SEC)
  return collection.coverUrl
}
