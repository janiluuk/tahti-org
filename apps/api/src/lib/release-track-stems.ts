// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReleaseStemRole, TrackStatus } from '@tahti/db'
import { presignedGetUrl } from './minio.js'

export type ReleaseTrackStemRow = {
  id: string
  role: ReleaseStemRole
  status: TrackStatus
  durationSec: number | null
  sourceKey: string
  streamKey: string | null
  createdAt: Date
}

export async function serializeReleaseTrackStem(
  stem: ReleaseTrackStemRow,
  opts: { includeAudioUrl?: boolean } = {},
) {
  const includeAudioUrl = opts.includeAudioUrl !== false
  const key = stem.streamKey ?? stem.sourceKey
  const ready = stem.status === 'READY'
  return {
    id: stem.id,
    role: stem.role,
    status: stem.status,
    durationSec: stem.durationSec,
    audioUrl: includeAudioUrl && ready && key ? await presignedGetUrl(key, 60 * 60) : null,
    createdAt: stem.createdAt.toISOString(),
  }
}

export async function serializePublicReleaseTrackStem(
  stem: Pick<
    ReleaseTrackStemRow,
    'id' | 'role' | 'status' | 'durationSec' | 'sourceKey' | 'streamKey'
  >,
  allowed: boolean,
) {
  const key = stem.streamKey ?? stem.sourceKey
  const ready = stem.status === 'READY'
  const url = allowed && ready && key ? await presignedGetUrl(key, 60 * 60) : null
  return {
    id: stem.id,
    role: stem.role,
    durationSec: stem.durationSec,
    audioUrl: url,
    playUrl: url,
  }
}
