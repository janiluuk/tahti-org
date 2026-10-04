// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { DeleteObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { config } from '../config.js'
import { s3 } from './minio.js'

export interface StoredMediaObject {
  key: string
  sizeBytes: number
  lastModified: Date
}

/** Most objects returned for one listing — generic "my media" uploads are ad
 * hoc images, so a single page is plenty. */
const MAX_LISTED_OBJECTS = 500

/** Objects under a user's `media/<username>/` prefix (the key is the only
 * record of these uploads; there is no DB row). */
export async function listUserMediaObjects(prefix: string): Promise<StoredMediaObject[]> {
  const res = await s3.send(
    new ListObjectsV2Command({
      Bucket: config.minio.bucket,
      Prefix: prefix,
      MaxKeys: MAX_LISTED_OBJECTS,
    }),
  )
  return (res.Contents ?? [])
    .filter((item): item is typeof item & { Key: string } => Boolean(item.Key))
    .map((item) => ({
      key: item.Key,
      sizeBytes: item.Size ?? 0,
      lastModified: item.LastModified ?? new Date(0),
    }))
}

export async function userMediaObjectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: config.minio.bucket, Key: key }))
    return true
  } catch {
    return false
  }
}

export async function deleteUserMediaObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: config.minio.bucket, Key: key }))
}
