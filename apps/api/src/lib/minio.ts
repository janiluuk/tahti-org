// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

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

// Presigned URLs are handed to browsers/listeners, so they must be signed against the
// publicly-reachable endpoint — not the internal one (e.g. docker-compose's `minio:9000`
// service name, unresolvable outside the network). Most deployments leave these equal;
// only local/dev stacks where MinIO sits behind an internal-only hostname need the split.
const presigningS3 =
  config.minio.publicEndpoint === config.minio.endpoint
    ? s3
    : new S3Client({
        endpoint: config.minio.publicEndpoint,
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
  return getSignedUrl(presigningS3, command, { expiresIn: expiresInSec })
}

export async function presignedGetUrl(key: string, expiresInSec = 3600): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: config.minio.bucket,
    Key: key,
  })
  return getSignedUrl(presigningS3, command, { expiresIn: expiresInSec })
}

export async function getObjectStream(key: string): Promise<{
  body: NodeJS.ReadableStream
  contentType: string
  contentLength: number | undefined
}> {
  const res = await s3.send(
    new GetObjectCommand({
      Bucket: config.minio.bucket,
      Key: key,
    }),
  )
  if (!res.Body) throw new Error(`Object not found: ${key}`)
  return {
    body: res.Body as NodeJS.ReadableStream,
    contentType: res.ContentType ?? 'application/octet-stream',
    contentLength: res.ContentLength,
  }
}

export async function putObjectText(key: string, body: string, contentType: string): Promise<void> {
  await s3.send(
    new PutObjectCommand({
      Bucket: config.minio.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  )
}
