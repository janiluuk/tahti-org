// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '../config.js'

// R2 is S3-API-compatible, so this mirrors lib/minio.ts's client shape exactly —
// only the endpoint/credentials/bucket differ. Long-term store only: hot reads
// for processing/preview/streaming stay on the MinIO client in minio.ts.
export const r2 = config.r2.enabled
  ? new S3Client({
      endpoint: config.r2.endpoint,
      region: 'auto',
      credentials: {
        accessKeyId: config.r2.accessKeyId,
        secretAccessKey: config.r2.secretAccessKey,
      },
    })
  : null

function requireR2(): S3Client {
  if (!r2) {
    throw new Error(
      'R2 is not configured (R2_ENDPOINT/R2_ACCESS_KEY_ID/R2_SECRET_ACCESS_KEY missing)',
    )
  }
  return r2
}

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  await requireR2().send(
    new PutObjectCommand({
      Bucket: config.r2.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}

export async function r2PresignedGetUrl(
  key: string,
  expiresInSec = 3600,
  downloadFilename?: string,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.r2.bucket,
    Key: key,
    ...(downloadFilename != null
      ? { ResponseContentDisposition: `attachment; filename="${downloadFilename}"` }
      : {}),
  })
  return getSignedUrl(requireR2(), command, { expiresIn: expiresInSec })
}

export async function r2ObjectSize(key: string): Promise<number | null> {
  try {
    const res = await requireR2().send(
      new HeadObjectCommand({ Bucket: config.r2.bucket, Key: key }),
    )
    return res.ContentLength ?? null
  } catch {
    return null
  }
}
