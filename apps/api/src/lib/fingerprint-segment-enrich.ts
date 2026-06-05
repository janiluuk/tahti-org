// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { identifyAcrcloudAudioSample, type LiveFingerprintSegment } from '@tahti/shared'
import { config } from '../config.js'

export async function enrichFingerprintSegmentFromAcrcloud(
  segment: Omit<LiveFingerprintSegment, 'capturedAt'>,
  audioSampleBase64?: string,
): Promise<Omit<LiveFingerprintSegment, 'capturedAt'>> {
  if (
    !config.acrcloud.enabled ||
    !config.acrcloud.accessKey ||
    !config.acrcloud.accessSecret ||
    !audioSampleBase64
  )
    return segment

  let sample: Buffer
  try {
    sample = Buffer.from(audioSampleBase64, 'base64')
  } catch {
    return segment
  }

  if (sample.length === 0 || sample.length > 400_000) return segment

  const match = await identifyAcrcloudAudioSample(sample, {
    host: config.acrcloud.host,
    accessKey: config.acrcloud.accessKey,
    accessSecret: config.acrcloud.accessSecret,
  })

  if (!match) return segment

  return {
    ...segment,
    title: match.title,
    ...(match.artist ? { artist: match.artist } : {}),
    identifySource: 'acrcloud',
  }
}
