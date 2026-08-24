// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest'
import { prisma } from '@tahti/db'

const minioMock = vi.hoisted(() => ({ downloadToFile: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../lib/minio.js', () => minioMock)

const fingerprintMock = vi.hoisted(() => ({ fingerprintAndIdentify: vi.fn() }))
vi.mock('../lib/track-fingerprint.js', () => fingerprintMock)

const { processFingerprintReleaseTrackJob } = await import('./fingerprint-release-track.js')

const PREFIX = 'fp-job-test-'

function fakeJob(data: unknown): Job {
  return { data } as Job
}

describe('processFingerprintReleaseTrackJob', () => {
  let trackId: string

  beforeAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}user@example.com`,
        username: `${PREFIX}user`,
        displayName: 'FP Job Test',
      },
    })
    const release = await prisma.release.create({
      data: {
        userId: user.id,
        title: 'FP Job Test Release',
        type: 'SINGLE',
        releaseDate: new Date('2026-01-01'),
        smartLinkSlug: `${PREFIX}release`,
        tracks: {
          create: {
            position: 1,
            title: 'Track',
            status: 'READY',
            sourceKey: `${PREFIX}source.mp3`,
            durationSec: 180,
          },
        },
      },
      include: { tracks: true },
    })
    trackId = release.tracks[0]!.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
  })

  beforeEach(() => {
    fingerprintMock.fingerprintAndIdentify.mockReset()
    minioMock.downloadToFile.mockClear()
  })

  it('persists the fingerprint and match when persist is true', async () => {
    fingerprintMock.fingerprintAndIdentify.mockResolvedValue({
      fingerprint: 'AQADtMk...',
      match: { acoustidId: 'abc', score: 0.9, title: 'Song', artist: 'Artist' },
    })

    const result = await processFingerprintReleaseTrackJob(fakeJob({ trackId, persist: true }))

    expect(result.persisted).toBe(true)
    expect(result.fingerprint).toBe('AQADtMk...')
    const updated = await prisma.releaseTrack.findUnique({ where: { id: trackId } })
    expect(updated?.fingerprint).toBe('AQADtMk...')
    expect(updated?.fingerprintMatch).toMatchObject({ acoustidId: 'abc' })
  })

  it('does not persist when persist is false', async () => {
    await prisma.releaseTrack.update({
      where: { id: trackId },
      data: { fingerprint: 'unchanged', fingerprintMatch: { acoustidId: 'unchanged', score: 0 } },
    })
    fingerprintMock.fingerprintAndIdentify.mockResolvedValue({
      fingerprint: 'AQADnewvalue...',
      match: { acoustidId: 'new-match', score: 0.5 },
    })

    const result = await processFingerprintReleaseTrackJob(fakeJob({ trackId, persist: false }))

    expect(result.persisted).toBe(false)
    expect(result.match).toMatchObject({ acoustidId: 'new-match' })
    const untouched = await prisma.releaseTrack.findUnique({ where: { id: trackId } })
    expect(untouched?.fingerprint).toBe('unchanged')
    expect(untouched?.fingerprintMatch).toMatchObject({ acoustidId: 'unchanged' })
  })

  it('throws for an unknown track', async () => {
    await expect(
      processFingerprintReleaseTrackJob(fakeJob({ trackId: 'nonexistent', persist: true })),
    ).rejects.toThrow('not found')
  })

  it('throws when the track has no source audio', async () => {
    const noAudio = await prisma.releaseTrack.create({
      data: {
        releaseId: (await prisma.releaseTrack.findUniqueOrThrow({ where: { id: trackId } }))
          .releaseId,
        position: 2,
        title: 'No Audio',
        status: 'PENDING',
      },
    })
    await expect(
      processFingerprintReleaseTrackJob(fakeJob({ trackId: noAudio.id, persist: true })),
    ).rejects.toThrow('no source audio')
  })
})
