// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { randomBytes } from 'node:crypto'
import { Readable } from 'node:stream'
import { prisma } from '@tahti/db'
import {
  extensionFromDriveFile,
  fetchGoogleDriveFileMetadata,
  fetchGoogleDriveFileStream,
  isAllowedDriveAudioMime,
  refreshGoogleDriveToken,
  titleFromDriveFileName,
} from '@tahti/shared'
import { decryptStreamKey, encryptStreamKey } from '../lib/stream-key-enc.js'
import { uploadStream } from '../lib/minio.js'
import { enqueueTranscodeArchive } from '../lib/queue.js'

const GOOGLE_DRIVE_CLIENT_ID = process.env.GOOGLE_DRIVE_CLIENT_ID ?? ''
const GOOGLE_DRIVE_CLIENT_SECRET = process.env.GOOGLE_DRIVE_CLIENT_SECRET ?? ''

async function getAccessTokenForUser(user: {
  id: string
  googleDriveAccessTokenEnc: string | null
  googleDriveRefreshTokenEnc: string | null
}): Promise<string> {
  if (!user.googleDriveAccessTokenEnc) {
    throw new Error('Google Drive not connected')
  }

  if (!user.googleDriveRefreshTokenEnc) {
    return decryptStreamKey(user.googleDriveAccessTokenEnc)
  }

  const refreshToken = decryptStreamKey(user.googleDriveRefreshTokenEnc)
  const tokenData = await refreshGoogleDriveToken(
    { clientId: GOOGLE_DRIVE_CLIENT_ID, clientSecret: GOOGLE_DRIVE_CLIENT_SECRET },
    refreshToken,
  )

  await prisma.user.update({
    where: { id: user.id },
    data: {
      googleDriveAccessTokenEnc: encryptStreamKey(tokenData.access_token),
      ...(tokenData.refresh_token
        ? { googleDriveRefreshTokenEnc: encryptStreamKey(tokenData.refresh_token) }
        : {}),
    },
  })

  return tokenData.access_token
}

async function driveDownloadWithRetry(
  user: {
    id: string
    googleDriveAccessTokenEnc: string | null
    googleDriveRefreshTokenEnc: string | null
  },
  fileId: string,
): Promise<Response> {
  let accessToken = await getAccessTokenForUser(user)
  try {
    return await fetchGoogleDriveFileStream(accessToken, fileId)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (!message.includes('401') || !user.googleDriveRefreshTokenEnc) throw err
    accessToken = await getAccessTokenForUser(user)
    return fetchGoogleDriveFileStream(accessToken, fileId)
  }
}

export async function processCloudImportGoogleDriveJob(job: Job): Promise<void> {
  const { cloudImportJobId } = job.data as { cloudImportJobId: string }

  const importJob = await prisma.cloudImportJob.findUnique({
    where: { id: cloudImportJobId },
    include: {
      user: {
        select: {
          id: true,
          googleDriveAccessTokenEnc: true,
          googleDriveRefreshTokenEnc: true,
          channel: { select: { id: true, slug: true } },
        },
      },
    },
  })

  if (!importJob) throw new Error(`CloudImportJob ${cloudImportJobId} not found`)
  if (importJob.source !== 'GOOGLE_DRIVE') {
    throw new Error(`Unsupported cloud import source: ${importJob.source}`)
  }

  const channel = importJob.user.channel
  if (!channel) {
    await prisma.cloudImportJob.update({
      where: { id: cloudImportJobId },
      data: { status: 'FAILED', error: 'Channel not found', completedAt: new Date() },
    })
    return
  }

  await prisma.cloudImportJob.update({
    where: { id: cloudImportJobId },
    data: { status: 'DOWNLOADING' },
  })

  try {
    const accessToken = await getAccessTokenForUser(importJob.user)
    let metadata
    try {
      metadata = await fetchGoogleDriveFileMetadata(accessToken, importJob.externalFileId)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('401') && importJob.user.googleDriveRefreshTokenEnc) {
        const refreshed = await getAccessTokenForUser(importJob.user)
        metadata = await fetchGoogleDriveFileMetadata(refreshed, importJob.externalFileId)
      } else {
        throw err
      }
    }

    const fileName = metadata.name || importJob.fileName || 'import'
    if (!isAllowedDriveAudioMime(metadata.mimeType, fileName)) {
      throw new Error('Selected file is not a supported audio format')
    }

    const driveRes = await driveDownloadWithRetry(importJob.user, importJob.externalFileId)
    const ext = extensionFromDriveFile(fileName, metadata.mimeType)
    const rawKey = `raw/${channel.slug}/${randomBytes(8).toString('hex')}.${ext}`
    const contentLength = metadata.size ? Number(metadata.size) : undefined
    const nodeStream = Readable.fromWeb(driveRes.body as ReadableStream<Uint8Array>)

    await uploadStream(
      rawKey,
      nodeStream,
      metadata.mimeType || 'application/octet-stream',
      contentLength,
    )

    const title = titleFromDriveFileName(fileName)
    const archiveItem = await prisma.archiveItem.create({
      data: {
        channelId: channel.id,
        title,
        rawKey,
        fileSizeBytes: BigInt(contentLength ?? 0),
        status: 'PENDING',
        source: 'GOOGLE_DRIVE',
      },
      select: { id: true },
    })

    await prisma.cloudImportJob.update({
      where: { id: cloudImportJobId },
      data: {
        status: 'DONE',
        archiveItemId: archiveItem.id,
        bytesTransferred: contentLength !== undefined ? BigInt(contentLength) : null,
        completedAt: new Date(),
      },
    })

    await enqueueTranscodeArchive(archiveItem.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    const reconnect = /401|403|token|connect/i.test(message)
    await prisma.cloudImportJob.update({
      where: { id: cloudImportJobId },
      data: {
        status: 'FAILED',
        error: reconnect ? `${message} — reconnect Google Drive and retry` : message,
        completedAt: new Date(),
      },
    })
    throw err
  }
}
