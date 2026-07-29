// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, r2Mock, statMock } = vi.hoisted(() => ({
  prismaMock: {
    userStorageQuota: { upsert: vi.fn() },
    releaseTrackVersion: { findMany: vi.fn(), update: vi.fn() },
  },
  r2Mock: {
    r2Enabled: true,
    uploadFileToR2: vi.fn(),
    deleteFromR2: vi.fn(),
  },
  statMock: vi.fn(),
}))

vi.mock('@tahti/db', () => ({ prisma: prismaMock }))
vi.mock('./r2.js', () => r2Mock)
vi.mock('node:fs/promises', () => ({ stat: statMock }))

const { writeThroughToR2, pruneOldR2VersionsForTrack } = await import('./release-r2-sync.js')

describe('writeThroughToR2', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    r2Mock.r2Enabled = true
  })

  it('uploads and records usage when R2 is enabled', async () => {
    statMock.mockResolvedValue({ size: 5_000_000 })

    const result = await writeThroughToR2(
      '/tmp/x',
      'releases/u/r/t/original.wav',
      'audio/wav',
      'user-1',
    )

    expect(result).toEqual({ r2Key: 'releases/u/r/t/original.wav', sizeBytes: 5_000_000 })
    expect(r2Mock.uploadFileToR2).toHaveBeenCalledWith(
      'releases/u/r/t/original.wav',
      '/tmp/x',
      'audio/wav',
    )
    expect(prismaMock.userStorageQuota.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } }),
    )
  })

  it('is a no-op when R2 is not configured', async () => {
    r2Mock.r2Enabled = false

    const result = await writeThroughToR2('/tmp/x', 'key', 'audio/wav', 'user-1')

    expect(result).toBeNull()
    expect(r2Mock.uploadFileToR2).not.toHaveBeenCalled()
  })
})

describe('pruneOldR2VersionsForTrack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the 4 most recent R2-backed versions and purges the rest', async () => {
    prismaMock.releaseTrackVersion.findMany.mockResolvedValue([
      { id: 'v6', r2Key: 'k6', r2SizeBytes: 100 },
      { id: 'v5', r2Key: 'k5', r2SizeBytes: 100 },
      { id: 'v4', r2Key: 'k4', r2SizeBytes: 100 },
      { id: 'v3', r2Key: 'k3', r2SizeBytes: 100 },
      { id: 'v2', r2Key: 'k2', r2SizeBytes: 50 },
      { id: 'v1', r2Key: 'k1', r2SizeBytes: 50 },
    ])

    await pruneOldR2VersionsForTrack('track-1', 'user-1')

    expect(r2Mock.deleteFromR2).toHaveBeenCalledTimes(2)
    expect(r2Mock.deleteFromR2).toHaveBeenCalledWith('k2')
    expect(r2Mock.deleteFromR2).toHaveBeenCalledWith('k1')
    expect(prismaMock.releaseTrackVersion.update).toHaveBeenCalledTimes(2)
    expect(prismaMock.releaseTrackVersion.update).toHaveBeenCalledWith({
      where: { id: 'v2' },
      data: { r2Key: null, r2SizeBytes: null },
    })
  })

  it('does nothing when there are 4 or fewer R2-backed versions', async () => {
    prismaMock.releaseTrackVersion.findMany.mockResolvedValue([
      { id: 'v2', r2Key: 'k2', r2SizeBytes: 100 },
      { id: 'v1', r2Key: 'k1', r2SizeBytes: 100 },
    ])

    await pruneOldR2VersionsForTrack('track-1', 'user-1')

    expect(r2Mock.deleteFromR2).not.toHaveBeenCalled()
    expect(prismaMock.releaseTrackVersion.update).not.toHaveBeenCalled()
  })
})
