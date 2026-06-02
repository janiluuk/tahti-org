// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { config } from '../config.js'

export const s3 = new S3Client({
  endpoint: config.minio.endpoint,
  region: 'auto',
  credentials: {
    accessKeyId: config.minio.accessKey,
    secretAccessKey: config.minio.secretKey,
  },
  forcePathStyle: true,
})

export async function presignedPutUrl(
  key: string,
  contentType: string,
  expiresInSec = 900,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: config.minio.bucket,
    Key: key,
    ContentType: contentType,
  })
  return getSignedUrl(s3, command, { expiresIn: expiresInSec })
}

export async function presignedGetUrl(key: string, expiresInSec = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.minio.bucket,
    Key: key,
  })
  return getSignedUrl(s3, command, { expiresIn: expiresInSec })
}
