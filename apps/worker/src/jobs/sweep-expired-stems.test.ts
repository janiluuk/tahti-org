// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { prismaMock, minioMock } = vi.hoisted(() => ({
  prismaMock: {
    soundStemJob: { findMany: vi.fn(), deleteMany: vi.fn() },
  },
  minioMock: {
    deleteObject: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@tahti/db', () => ({ prisma: prismaMock }))
vi.mock('../lib/minio.js', () => minioMock)

const { processSweepExpiredStemsJob } = await import('./sweep-expired-stems.js')

describe('processSweepExpiredStemsJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('deletes storage objects and rows for expired READY jobs', async () => {
    prismaMock.soundStemJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        vocalsKey: 'stems/a/1/vocals.flac',
        instrumentalKey: 'stems/a/1/instrumental.flac',
        drumsKey: null,
        bassKey: null,
        otherKey: null,
      },
    ])

    const result = await processSweepExpiredStemsJob()

    expect(result).toEqual({ deleted: 1 })
    expect(minioMock.deleteObject).toHaveBeenCalledWith('stems/a/1/vocals.flac')
    expect(minioMock.deleteObject).toHaveBeenCalledWith('stems/a/1/instrumental.flac')
    expect(prismaMock.soundStemJob.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ['job-1'] } },
    })
  })

  it('is a no-op when nothing is expired', async () => {
    prismaMock.soundStemJob.findMany.mockResolvedValue([])

    const result = await processSweepExpiredStemsJob()

    expect(result).toEqual({ deleted: 0 })
    expect(minioMock.deleteObject).not.toHaveBeenCalled()
    expect(prismaMock.soundStemJob.deleteMany).not.toHaveBeenCalled()
  })
})
