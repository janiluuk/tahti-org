// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@tahti/db'
import { deleteObject } from './minio.js'
import { SOUND_REVISION_RETENTION, pruneSoundRevisions } from './sound-version-retention.js'

vi.mock('./minio.js', () => ({ deleteObject: vi.fn().mockResolvedValue(undefined) }))

describe('pruneSoundRevisions', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('keeps the original and ten newest revisions', async () => {
    const revisions = Array.from({ length: SOUND_REVISION_RETENTION + 2 }, (_, index) => ({
      id: `version-${index + 2}`,
      rawKey: `raw-${index + 2}`,
      mp3Key: `mp3-${index + 2}`,
      flacKey: null,
      isActive: false,
    })).reverse()
    const remove = vi.fn().mockResolvedValue(undefined)
    const prisma = {
      soundVersion: {
        findMany: vi.fn().mockResolvedValue(revisions),
        delete: remove,
      },
    } as unknown as PrismaClient

    await pruneSoundRevisions(prisma, 'sound-1')

    expect(remove).toHaveBeenCalledTimes(2)
    expect(remove).toHaveBeenCalledWith({ where: { id: 'version-3' } })
    expect(remove).toHaveBeenCalledWith({ where: { id: 'version-2' } })
    expect(deleteObject).toHaveBeenCalledTimes(4)
  })

  it('never deletes an active older revision', async () => {
    const revisions = Array.from({ length: SOUND_REVISION_RETENTION + 1 }, (_, index) => ({
      id: `version-${index}`,
      rawKey: `raw-${index}`,
      mp3Key: null,
      flacKey: null,
      isActive: index === SOUND_REVISION_RETENTION,
    }))
    const remove = vi.fn().mockResolvedValue(undefined)
    const prisma = {
      soundVersion: {
        findMany: vi.fn().mockResolvedValue(revisions),
        delete: remove,
      },
    } as unknown as PrismaClient

    await pruneSoundRevisions(prisma, 'sound-1')

    expect(remove).not.toHaveBeenCalled()
  })
})
