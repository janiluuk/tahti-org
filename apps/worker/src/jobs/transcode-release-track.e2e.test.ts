// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Genuine end-to-end check that a brand-new user's upload gets its lossless
// source mirrored to R2 and quota-tracked. Runs the REAL job function
// against a REAL Postgres and REAL ffmpeg (a tiny generated silent WAV) — the
// only mocked boundaries are MinIO and R2 themselves, since hitting a shared
// MinIO bucket from an automated test isn't appropriate, and no live R2
// credentials are staged in this environment yet.

import type { Job } from 'bullmq'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, writeFile, readFile, stat } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prisma } from '@tahti/db'

const execFileAsync = promisify(execFile)

const minioMock = vi.hoisted(() => ({
  downloadToFile: vi.fn(),
  uploadFile: vi.fn(),
}))
vi.mock('../lib/minio.js', () => minioMock)

const r2Mock = vi.hoisted(() => ({
  r2Enabled: true,
  uploadFileToR2: vi.fn(),
  deleteFromR2: vi.fn(),
}))
vi.mock('../lib/r2.js', () => r2Mock)

const { processTranscodeReleaseTrackJob } = await import('./transcode-release-track.js')

const PREFIX = 'e2e-r2-track-'

describe('processTranscodeReleaseTrackJob — R2 write-through (e2e)', () => {
  let fixtureDir: string
  let fixtureWavPath: string
  let fixtureSize: number
  let userId: string
  let releaseId: string
  let trackId: string

  beforeAll(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'tahti-e2e-fixture-'))
    fixtureWavPath = join(fixtureDir, 'silence.wav')
    await execFileAsync('ffmpeg', [
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=44100:cl=stereo',
      '-t',
      '2',
      '-y',
      fixtureWavPath,
    ])
    fixtureSize = (await stat(fixtureWavPath)).size

    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}user@example.com`,
        username: `${PREFIX}user`,
        displayName: 'E2E Test Artist',
      },
    })
    userId = user.id

    const release = await prisma.release.create({
      data: {
        userId,
        title: 'E2E Test Single',
        type: 'SINGLE',
        releaseDate: new Date(),
        smartLinkSlug: `${PREFIX}single`,
      },
    })
    releaseId = release.id

    const track = await prisma.releaseTrack.create({
      data: {
        releaseId,
        position: 0,
        title: 'E2E Test Track',
        sourceKey: `raw/${PREFIX}user/track.wav`,
      },
    })
    trackId = track.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await rm(fixtureDir, { recursive: true, force: true })
  })

  it('writes the lossless source through to R2 and tracks quota usage for a brand-new user', async () => {
    minioMock.downloadToFile.mockImplementation(async (_key: string, destPath: string) => {
      await writeFile(destPath, await readFile(fixtureWavPath))
    })
    minioMock.uploadFile.mockResolvedValue(undefined)

    await processTranscodeReleaseTrackJob({ data: { trackId } } as unknown as Job)

    const track = await prisma.releaseTrack.findUniqueOrThrow({ where: { id: trackId } })
    expect(track.status).toBe('READY')
    expect(track.streamKey).toBe(`releases/${userId}/${releaseId}/${trackId}/stream.ogg`)
    expect(track.r2Key).toBe(`releases/${userId}/${releaseId}/${trackId}/original.wav`)
    expect(track.r2SizeBytes).toBe(fixtureSize)

    expect(r2Mock.uploadFileToR2).toHaveBeenCalledWith(
      `releases/${userId}/${releaseId}/${trackId}/original.wav`,
      expect.any(String),
      'audio/wav',
    )

    const quota = await prisma.userStorageQuota.findUniqueOrThrow({ where: { userId } })
    expect(Number(quota.usedBytes)).toBe(fixtureSize)
    expect(Number(quota.quotaBytes)).toBe(500 * 1024 * 1024)
  })
})
