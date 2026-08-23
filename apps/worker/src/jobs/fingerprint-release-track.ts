// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname } from 'node:path'
import { prisma, Prisma } from '@tahti/db'
import { downloadToFile } from '../lib/minio.js'
import { fingerprintAndIdentify } from '../lib/track-fingerprint.js'

export interface FingerprintReleaseTrackResult {
  fingerprint: string | null
  match: {
    acoustidId: string
    score: number
    recordingId?: string
    title?: string
    artist?: string
  } | null
  persisted: boolean
}

/**
 * Manual (re-)fingerprint for a release track, triggered from the Studio
 * track editor — distinct from the automatic pass in
 * `transcode-release-track` (which runs once on upload). Covers two cases:
 * a listener wants to redo it after replacing the audio outside the normal
 * upload flow, or just wants to check for a match without touching the
 * stored fingerprint (`persist: false`). Returns its result via the job's
 * return value so the triggering API request can await it directly with
 * `waitUntilFinished` instead of polling.
 */
export async function processFingerprintReleaseTrackJob(
  job: Job,
): Promise<FingerprintReleaseTrackResult> {
  const { trackId, persist } = job.data as { trackId: string; persist: boolean }

  const track = await prisma.releaseTrack.findUnique({ where: { id: trackId } })
  if (!track) throw new Error(`ReleaseTrack ${trackId} not found`)
  if (!track.sourceKey) throw new Error(`ReleaseTrack ${trackId} has no source audio`)

  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-fingerprint-'))
  try {
    const ext = extname(track.sourceKey).slice(1) || 'bin'
    const srcPath = join(tmpDir, `source.${ext}`)
    await downloadToFile(track.sourceKey, srcPath)

    const { fingerprint, match } = await fingerprintAndIdentify(
      srcPath,
      track.durationSec ?? 0,
    )

    if (persist) {
      await prisma.releaseTrack.update({
        where: { id: trackId },
        data: { fingerprint, fingerprintMatch: match ?? Prisma.JsonNull },
      })
    }

    return { fingerprint, match, persisted: persist }
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
