// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

const { stat, prismaMock, findLatestChannelRecording, uploadFile, enqueueArchiveBroadcast } =
  vi.hoisted(() => ({
    stat: vi.fn(),
    prismaMock: {
      broadcast: {
        findUnique: vi.fn(),
        update: vi.fn(),
      },
    },
    findLatestChannelRecording: vi.fn(),
    uploadFile: vi.fn(),
    enqueueArchiveBroadcast: vi.fn(),
  }))

vi.mock('node:fs/promises', () => ({ stat }))
vi.mock('@tahti/db', () => ({ prisma: prismaMock }))
vi.mock('../lib/channel-recording.js', () => ({ findLatestChannelRecording }))
vi.mock('../lib/minio.js', () => ({ uploadFile }))
vi.mock('../lib/queue.js', () => ({ enqueueArchiveBroadcast }))

import { processFinalizeBroadcastRecordingJob } from './finalize-broadcast-recording.js'

function jobFor(broadcastId: string): Job {
  return { data: { broadcastId } } as Job
}

describe('processFinalizeBroadcastRecordingJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.BROADCAST_RECORDING_MIN_BYTES = '100'
  })

  it('uploads recording and enqueues archive when WAV is large enough', async () => {
    prismaMock.broadcast.findUnique.mockResolvedValue({
      id: 'bc-1',
      archiveItemId: null,
      recordingKey: null,
      startedAt: new Date('2026-06-01T12:00:00Z'),
      source: 'RTMP',
      channel: { id: 'ch-1', slug: 'artist-one' },
    })
    findLatestChannelRecording.mockResolvedValue('/recordings/ch-1/live.wav')
    stat.mockResolvedValue({ size: 500_000, isFile: () => true })

    await processFinalizeBroadcastRecordingJob(jobFor('bc-1'))

    expect(uploadFile).toHaveBeenCalledWith(
      'recordings/artist-one/broadcast-bc-1.wav',
      '/recordings/ch-1/live.wav',
      'audio/wav',
    )
    expect(enqueueArchiveBroadcast).toHaveBeenCalledWith('bc-1')
  })

  it('skips when archive is already linked', async () => {
    prismaMock.broadcast.findUnique.mockResolvedValue({
      id: 'bc-2',
      archiveItemId: 'item-1',
      recordingKey: null,
      startedAt: new Date(),
      source: 'ICECAST',
      channel: { id: 'ch-1', slug: 'artist-one' },
    })

    await processFinalizeBroadcastRecordingJob(jobFor('bc-2'))

    expect(findLatestChannelRecording).not.toHaveBeenCalled()
  })
})
