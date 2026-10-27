// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

const { prismaMock, notifyJobOutcome, submitReleaseToRevelator } = vi.hoisted(() => ({
  prismaMock: { release: { findUnique: vi.fn(), update: vi.fn() } },
  notifyJobOutcome: vi.fn(),
  submitReleaseToRevelator: vi.fn(),
}))

vi.mock('@tahti/db', () => ({ prisma: prismaMock, notifyJobOutcome }))
vi.mock('@tahti/revelator', () => ({ submitReleaseToRevelator }))

import { processRevelatorDeliverJob } from './revelator-deliver.js'

const job = () =>
  ({ data: { releaseId: 'r1' }, attemptsMade: 0, opts: { attempts: 1 } }) as unknown as Job

describe('processRevelatorDeliverJob notices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.release.findUnique.mockResolvedValue({
      id: 'r1',
      title: 'Night EP',
      type: 'EP',
      releaseDate: new Date('2026-11-01T00:00:00Z'),
      upc: null,
      pLine: null,
      cLine: null,
      labelImprint: null,
      revelatorStatus: 'queued',
      userId: 'u1',
      user: { username: 'dj', displayName: 'DJ' },
      tracks: [],
    })
    prismaMock.release.update.mockResolvedValue({})
  })

  it('tells the artist the release was sent', async () => {
    submitReleaseToRevelator.mockResolvedValue({ revelatorId: 'rv-1' })
    await processRevelatorDeliverJob(job())
    expect(notifyJobOutcome).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        userId: 'u1',
        outcome: 'done',
        title: '"Night EP" was sent for distribution',
        url: '/studio/releases/r1',
      }),
    )
  })

  it('tells the artist when the final attempt fails', async () => {
    submitReleaseToRevelator.mockRejectedValue(new Error('422'))
    await expect(processRevelatorDeliverJob(job())).rejects.toThrow('422')
    expect(notifyJobOutcome).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        outcome: 'failed',
        title: '"Night EP" could not be sent for distribution',
      }),
    )
  })
})
