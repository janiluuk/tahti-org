// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

const { prismaMock, notifyJobOutcome, uploadToMixcloud } = vi.hoisted(() => ({
  prismaMock: { mixUpload: { findUnique: vi.fn(), update: vi.fn() } },
  notifyJobOutcome: vi.fn(),
  uploadToMixcloud: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({ mkdtemp: vi.fn().mockResolvedValue('/tmp/mc'), rm: vi.fn() }))
vi.mock('@tahti/db', () => ({ prisma: prismaMock, notifyJobOutcome }))
vi.mock('@tahti/mixcloud', () => ({ uploadToMixcloud }))
vi.mock('../lib/minio.js', () => ({ downloadToFile: vi.fn() }))
vi.mock('../lib/stream-key-enc.js', () => ({ decryptStreamKey: () => 'token' }))

import { processMixcloudUploadJob } from './mixcloud-upload.js'

const job = (attemptsMade = 0) =>
  ({ data: { mixUploadId: 'mu-1' }, attemptsMade, opts: { attempts: 1 } }) as unknown as Job

describe('processMixcloudUploadJob notices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.mixUpload.findUnique.mockResolvedValue({
      id: 'mu-1',
      userId: 'u1',
      soundId: 's1',
      user: { mixcloudAccessTokenEnc: 'enc' },
      sound: { title: 'Friday set', mp3Key: 'a.mp3', flacKey: null, rawKey: null },
    })
    prismaMock.mixUpload.update.mockResolvedValue({})
  })

  it('tells the artist when the mix is on Mixcloud', async () => {
    uploadToMixcloud.mockResolvedValue({
      key: '/dj/friday/',
      url: 'https://mixcloud.com/dj/friday/',
    })
    await processMixcloudUploadJob(job())
    expect(notifyJobOutcome).toHaveBeenCalledWith(prismaMock, {
      userId: 'u1',
      outcome: 'done',
      title: '"Friday set" is on Mixcloud',
      url: '/studio/sounds/s1',
    })
  })

  it('tells the artist when the final attempt fails', async () => {
    uploadToMixcloud.mockRejectedValue(new Error('401'))
    await expect(processMixcloudUploadJob(job())).rejects.toThrow('401')
    expect(notifyJobOutcome).toHaveBeenCalledWith(
      prismaMock,
      expect.objectContaining({
        outcome: 'failed',
        title: '"Friday set" could not be uploaded to Mixcloud',
      }),
    )
  })
})
