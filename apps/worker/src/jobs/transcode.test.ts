// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

const { prismaMock, downloadSourceCached, ffprobe, mkdtemp, rm } = vi.hoisted(() => ({
  prismaMock: {
    sound: { findUnique: vi.fn(), update: vi.fn() },
    soundVersion: { count: vi.fn() },
  },
  downloadSourceCached: vi.fn(),
  ffprobe: vi.fn(),
  mkdtemp: vi.fn(),
  rm: vi.fn(),
}))

vi.mock('node:fs/promises', () => ({ mkdtemp, rm }))
vi.mock('fluent-ffmpeg', () => ({ default: Object.assign(vi.fn(), { ffprobe }) }))
vi.mock('@tahti/db', () => ({
  prisma: prismaMock,
  ensureInitialVersion: vi.fn(),
  Prisma: {},
}))
vi.mock('../lib/source-cache.js', () => ({ downloadSourceCached }))
vi.mock('../lib/minio.js', () => ({ uploadFile: vi.fn() }))
vi.mock('../lib/queue.js', () => ({
  enqueueEncodeStreamingCopy: vi.fn(),
  enqueueWarmSoundFallbackCache: vi.fn(),
}))
vi.mock('../lib/new-track-announcement.js', () => ({
  announceNewPublicTrack: vi.fn(),
  isFirstTranscode: vi.fn().mockResolvedValue(false),
}))
vi.mock('../lib/audio-analysis.js', () => ({
  analyzeAudioAcoustics: vi.fn(),
  prepareAnalysisWav: vi.fn(),
}))
vi.mock('../lib/waveform.js', () => ({ extractWaveformPeaks: vi.fn() }))
vi.mock('../lib/editor-peaks.js', () => ({
  extractAndStoreFinePeaks: vi.fn(),
  extractEditorPeaksPyramid: vi.fn(),
  finePeaksKey: vi.fn(),
}))

import { processTranscodeJob } from './transcode.js'

function jobFor(attemptsMade: number, attempts = 3): Job {
  return { data: { itemId: 'snd-1' }, attemptsMade, opts: { attempts } } as unknown as Job
}

function lastUpdateData(): Record<string, unknown> {
  const calls = prismaMock.sound.update.mock.calls
  return calls[calls.length - 1]![0].data
}

describe('processTranscodeJob failures', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mkdtemp.mockResolvedValue('/tmp/tahti-transcode-xyz')
    rm.mockResolvedValue(undefined)
    prismaMock.sound.findUnique.mockResolvedValue({
      id: 'snd-1',
      rawKey: 'uploads/secret-key',
      status: 'PENDING',
      channelId: 'ch-1',
      channel: { slug: 'dj' },
    })
    prismaMock.sound.update.mockResolvedValue({})
    downloadSourceCached.mockResolvedValue(undefined)
  })

  it('clears an earlier failure reason when processing starts', async () => {
    downloadSourceCached.mockRejectedValue(new Error('NoSuchKey'))
    await expect(processTranscodeJob(jobFor(2))).rejects.toThrow('NoSuchKey')
    expect(prismaMock.sound.update.mock.calls[0]![0].data).toEqual({
      status: 'PROCESSING',
      processingError: null,
    })
  })

  it('stores a plain reason on the final attempt when the file is unreadable', async () => {
    ffprobe.mockImplementation((_path: string, cb: (err: Error) => void) =>
      cb(new Error('/tmp/tahti-transcode-xyz/raw_input: Invalid data found')),
    )
    await expect(processTranscodeJob(jobFor(2))).rejects.toThrow()
    const data = lastUpdateData()
    expect(data.status).toBe('ERROR')
    expect(data.processingError).toBe('The file is not a supported audio format, or it is damaged.')
    expect(String(data.processingError)).not.toContain('/tmp')
  })

  it('reports a missing source on the final attempt', async () => {
    downloadSourceCached.mockRejectedValue(new Error('NoSuchKey: uploads/secret-key'))
    await expect(processTranscodeJob(jobFor(0, 1))).rejects.toThrow()
    const data = lastUpdateData()
    expect(data.status).toBe('ERROR')
    expect(data.processingError).toBe(
      'The uploaded file could not be found. Try uploading it again.',
    )
  })

  it('keeps the sound pending while BullMQ still has attempts left', async () => {
    downloadSourceCached.mockRejectedValue(new Error('timeout'))
    await expect(processTranscodeJob(jobFor(0))).rejects.toThrow('timeout')
    expect(lastUpdateData()).toEqual({ status: 'PENDING' })
  })
})
