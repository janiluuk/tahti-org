// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { identifyAcrcloudAudioSample, type LiveFingerprintSegment } from '@tahti/shared'
import { getUserIntegrationCredential, type PrismaClient } from '@tahti/db'
import {
  recordAcrcloudIdentifyMatch,
  recordAcrcloudIdentifyMiss,
  recordAcrcloudIdentifyRequest,
} from './acrcloud-metrics.js'
import { config } from '../config.js'

/** The broadcasting channel owner's installed ACRCloud project, if any — else the global fallback. */
async function resolveAcrcloudCredential(
  prisma?: PrismaClient,
  userId?: string,
): Promise<{ host: string; accessKey: string; accessSecret: string } | null> {
  if (prisma && userId) {
    const fields = await getUserIntegrationCredential(prisma, userId, 'acrcloud')
    if (fields?.host && fields?.accessKey && fields?.accessSecret) {
      return { host: fields.host, accessKey: fields.accessKey, accessSecret: fields.accessSecret }
    }
  }
  if (config.acrcloud.enabled && config.acrcloud.accessKey && config.acrcloud.accessSecret) {
    return {
      host: config.acrcloud.host,
      accessKey: config.acrcloud.accessKey,
      accessSecret: config.acrcloud.accessSecret,
    }
  }
  return null
}

export async function enrichFingerprintSegmentFromAcrcloud(
  segment: Omit<LiveFingerprintSegment, 'capturedAt'>,
  audioSampleBase64?: string,
  prisma?: PrismaClient,
  userId?: string,
): Promise<Omit<LiveFingerprintSegment, 'capturedAt'>> {
  if (!audioSampleBase64) return segment

  const credential = await resolveAcrcloudCredential(prisma, userId)
  if (!credential) return segment

  let sample: Buffer
  try {
    sample = Buffer.from(audioSampleBase64, 'base64')
  } catch {
    return segment
  }

  if (sample.length === 0 || sample.length > 400_000) return segment

  recordAcrcloudIdentifyRequest()
  const match = await identifyAcrcloudAudioSample(sample, credential)

  if (!match) {
    recordAcrcloudIdentifyMiss()
    return segment
  }

  recordAcrcloudIdentifyMatch()

  return {
    ...segment,
    title: match.title,
    ...(match.artist ? { artist: match.artist } : {}),
    identifySource: 'acrcloud',
  }
}
