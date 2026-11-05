// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { GetObjectCommand } from '@aws-sdk/client-s3'
import { config } from '../config.js'
import { s3 } from './minio.js'

/** The first `bytes` bytes of a stored object, or null when it can't be read. */
export async function readObjectPrefix(key: string, bytes: number): Promise<Uint8Array | null> {
  try {
    const res = await s3.send(
      new GetObjectCommand({
        Bucket: config.minio.bucket,
        Key: key,
        Range: `bytes=0-${bytes - 1}`,
      }),
    )
    if (!res.Body) return null
    return await res.Body.transformToByteArray()
  } catch {
    return null
  }
}
