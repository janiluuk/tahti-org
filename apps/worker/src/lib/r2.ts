// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { createReadStream } from 'node:fs'
import { readSecret } from './read-secret.js'

const R2_ENDPOINT = process.env.R2_ENDPOINT ?? ''
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? ''
const R2_SECRET_ACCESS_KEY = readSecret('R2_SECRET_ACCESS_KEY', 'R2_SECRET_ACCESS_KEY_FILE') ?? ''
const R2_BUCKET = process.env.R2_BUCKET ?? 'tahti-user-storage'

export const r2Enabled = Boolean(R2_ENDPOINT && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY)

export const r2 = r2Enabled
  ? new S3Client({
      endpoint: R2_ENDPOINT,
      region: 'auto',
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    })
  : null

/** Long-term lossless mirror — never called unless r2Enabled (callers must check first). */
export async function uploadFileToR2(
  key: string,
  srcPath: string,
  contentType: string,
): Promise<void> {
  if (!r2) throw new Error('R2 is not configured')
  await r2.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: createReadStream(srcPath),
      ContentType: contentType,
    }),
  )
}

export async function deleteFromR2(key: string): Promise<void> {
  if (!r2) return
  await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }))
}
