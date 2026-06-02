// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { createWriteStream, createReadStream } from 'node:fs'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT ?? 'http://localhost:9000'
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY ?? 'tahti'
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY ?? 'tahti_dev_secret'
const MINIO_BUCKET = process.env.MINIO_BUCKET ?? 'tahti'

export const s3 = new S3Client({
  endpoint: MINIO_ENDPOINT,
  region: 'auto',
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
  forcePathStyle: true,
})

export async function downloadToFile(key: string, destPath: string): Promise<void> {
  const command = new GetObjectCommand({ Bucket: MINIO_BUCKET, Key: key })
  const response = await s3.send(command)
  const stream = response.Body as Readable
  await pipeline(stream, createWriteStream(destPath))
}

export async function uploadFile(key: string, srcPath: string, contentType: string): Promise<void> {
  const body = createReadStream(srcPath)
  const command = new PutObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType,
  })
  await s3.send(command)
}
