// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Job } from 'bullmq'

const { prismaMock, notifyJobOutcome } = vi.hoisted(() => ({
  prismaMock: { cloudImportJob: { findUnique: vi.fn(), update: vi.fn() } },
  notifyJobOutcome: vi.fn(),
}))

vi.mock('@tahti/db', () => ({ prisma: prismaMock, notifyJobOutcome, soundOwnerDefaults: vi.fn() }))
vi.mock('../lib/stream-key-enc.js', () => ({ decryptStreamKey: () => 'token' }))
vi.mock('../lib/minio.js', () => ({ uploadStream: vi.fn() }))
vi.mock('../lib/queue.js', () => ({ enqueueTranscodeSound: vi.fn() }))

import { processSoundcloudImportJob } from './soundcloud-import.js'

const job = (attemptsMade: number) =>
  ({ data: { cloudImportJobId: 'ci-1' }, attemptsMade, opts: { attempts: 2 } }) as unknown as Job

describe('processSoundcloudImportJob failure notice', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.cloudImportJob.findUnique.mockResolvedValue({
      id: 'ci-1',
      source: 'SOUNDCLOUD',
      userId: 'u1',
      fileName: null,
      externalFileId: '42',
      user: { id: 'u1', soundcloudAccessTokenEnc: 'enc', channel: { id: 'ch', slug: 'dj' } },
    })
    prismaMock.cloudImportJob.update.mockResolvedValue({})
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 }) as unknown as typeof fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('tells the artist only once the last attempt fails', async () => {
    await expect(processSoundcloudImportJob(job(0))).rejects.toThrow()
    expect(notifyJobOutcome).not.toHaveBeenCalled()
    await expect(processSoundcloudImportJob(job(1))).rejects.toThrow()
    expect(notifyJobOutcome).toHaveBeenCalledWith(prismaMock, {
      userId: 'u1',
      outcome: 'failed',
      title: 'A track could not be imported from SoundCloud',
      body: 'See why on Upload, then try the import again.',
      url: '/studio/upload',
    })
  })
})
