// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

const { prismaMock, notifyJobOutcome, uploadTrackToHearthis, PremiumError } = vi.hoisted(() => ({
  prismaMock: { sound: { findUnique: vi.fn(), update: vi.fn() } },
  notifyJobOutcome: vi.fn(),
  uploadTrackToHearthis: vi.fn(),
  PremiumError: class extends Error {},
}))

vi.mock('node:fs/promises', () => ({
  mkdtemp: vi.fn().mockResolvedValue('/tmp/ht'),
  readFile: vi.fn().mockResolvedValue(Buffer.from('audio')),
  rm: vi.fn(),
}))
vi.mock('@tahti/db', () => ({
  prisma: prismaMock,
  notifyJobOutcome,
  getUserIntegrationCredential: vi.fn().mockResolvedValue({ key: 'k', secret: 's' }),
}))
vi.mock('@tahti/hearthis', () => ({
  uploadTrackToHearthis,
  HearthisPremiumRequiredError: PremiumError,
}))
vi.mock('../lib/minio.js', () => ({ downloadToFile: vi.fn() }))

import { processHearthisExportJob } from './hearthis-export.js'

const job = () =>
  ({ data: { soundId: 's1' }, attemptsMade: 0, opts: { attempts: 1 } }) as unknown as Job

describe('processHearthisExportJob notices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.sound.findUnique.mockResolvedValue({
      id: 's1',
      title: 'Friday set',
      rawKey: null,
      flacKey: null,
      mp3Key: 'a.mp3',
      channel: { userId: 'u1' },
    })
    prismaMock.sound.update.mockResolvedValue({})
  })

  it('tells the artist when the track is on hearthis.at', async () => {
    uploadTrackToHearthis.mockResolvedValue({ remoteId: '123' })
    await processHearthisExportJob(job())
    expect(notifyJobOutcome).toHaveBeenCalledWith(prismaMock, {
      userId: 'u1',
      outcome: 'done',
      title: '"Friday set" is on hearthis.at',
      url: '/studio/sounds/s1',
    })
  })

  it('names a lapsed Premium account when that is why it failed', async () => {
    uploadTrackToHearthis.mockRejectedValue(new PremiumError('premium'))
    await expect(processHearthisExportJob(job())).rejects.toThrow()
    expect(notifyJobOutcome).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        outcome: 'failed',
        body: 'hearthis.at needs a Premium account for uploads; check yours, then try again.',
      }),
    )
  })
})
