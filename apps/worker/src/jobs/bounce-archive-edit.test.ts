// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

const {
  mkdtemp,
  rm,
  stat,
  prismaMock,
  syncActiveVersionToItem,
  downloadToFile,
  uploadFile,
  processTranscodeVersionJob,
  ffmpegChain,
  ffmpegFactory,
} = vi.hoisted(() => {
  const chain: Record<string, unknown> & {
    handlers: Record<string, (...args: unknown[]) => void>
  } = { handlers: {} }
  chain.setStartTime = vi.fn(() => chain)
  chain.setDuration = vi.fn(() => chain)
  chain.audioFilters = vi.fn(() => chain)
  chain.format = vi.fn(() => chain)
  chain.audioCodec = vi.fn(() => chain)
  chain.audioFrequency = vi.fn(() => chain)
  chain.audioChannels = vi.fn(() => chain)
  chain.on = vi.fn((event: string, cb: (...args: unknown[]) => void) => {
    chain.handlers[event] = cb
    return chain
  })
  chain.save = vi.fn(() => {
    chain.handlers.end?.()
  })
  return {
    mkdtemp: vi.fn(),
    rm: vi.fn(),
    stat: vi.fn(),
    prismaMock: {
      archiveItemVersion: {
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    syncActiveVersionToItem: vi.fn(),
    downloadToFile: vi.fn(),
    uploadFile: vi.fn(),
    processTranscodeVersionJob: vi.fn(),
    ffmpegChain: chain,
    ffmpegFactory: vi.fn(() => {
      chain.handlers = {}
      return chain
    }),
  }
})

vi.mock('node:fs/promises', () => ({ mkdtemp, rm, stat }))
vi.mock('fluent-ffmpeg', () => ({ default: ffmpegFactory }))
vi.mock('@tahti/db', () => ({ prisma: prismaMock, syncActiveVersionToItem }))
vi.mock('../lib/minio.js', () => ({ downloadToFile, uploadFile }))
vi.mock('./transcode-version.js', () => ({ processTranscodeVersionJob }))

import { processBounceArchiveEditJob, type BounceArchiveEditPayload } from './bounce-archive-edit.js'

function jobFor(payload: BounceArchiveEditPayload): Job {
  return { data: payload } as Job
}

function basePayload(overrides: Partial<BounceArchiveEditPayload> = {}): BounceArchiveEditPayload {
  return {
    versionId: 'ver-1',
    archiveItemId: 'item-1',
    channelSlug: 'artist-one',
    sourceKey: 'raw/artist-one/source.wav',
    startSec: 5,
    endSec: 65,
    fadeInSec: 1,
    fadeOutSec: 1,
    peakNormalize: false,
    lufsTarget: 'none',
    limiterEnabled: false,
    highPassHz: 0,
    lowPassHz: 0,
    eq: { lowGainDb: 0, midGainDb: 0, highGainDb: 0 },
    compressorEnabled: false,
    activate: false,
    ...overrides,
  }
}

describe('processBounceArchiveEditJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mkdtemp.mockResolvedValue('/tmp/tahti-bounce-xyz')
    rm.mockResolvedValue(undefined)
    stat.mockResolvedValue({ size: 54321 })
    downloadToFile.mockResolvedValue(undefined)
    uploadFile.mockResolvedValue(undefined)
    processTranscodeVersionJob.mockResolvedValue(undefined)
    prismaMock.archiveItemVersion.findUnique.mockResolvedValue({ id: 'ver-1' })
    prismaMock.archiveItemVersion.update.mockResolvedValue({})
    prismaMock.archiveItemVersion.updateMany.mockResolvedValue({})
    prismaMock.$transaction.mockResolvedValue([])
    syncActiveVersionToItem.mockResolvedValue(undefined)
  })

  it('trims, uploads, transcodes and activates the version', async () => {
    const payload = basePayload({ activate: true })

    await processBounceArchiveEditJob(jobFor(payload))

    expect(prismaMock.archiveItemVersion.findUnique).toHaveBeenCalledWith({
      where: { id: 'ver-1' },
    })
    expect(prismaMock.archiveItemVersion.update).toHaveBeenCalledWith({
      where: { id: 'ver-1' },
      data: { status: 'PROCESSING' },
    })
    expect(downloadToFile).toHaveBeenCalledWith(
      'raw/artist-one/source.wav',
      '/tmp/tahti-bounce-xyz/input',
    )
    expect(ffmpegChain.setStartTime).toHaveBeenCalledWith(5)
    expect(ffmpegChain.setDuration).toHaveBeenCalledWith(60)
    expect(uploadFile).toHaveBeenCalledWith(
      expect.stringMatching(/^raw\/artist-one\/.+\.wav$/),
      '/tmp/tahti-bounce-xyz/trimmed.wav',
      'audio/wav',
    )
    expect(processTranscodeVersionJob).toHaveBeenCalledWith({ data: { versionId: 'ver-1' } })
    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(syncActiveVersionToItem).toHaveBeenCalledWith(prismaMock, 'item-1')
    expect(rm).toHaveBeenCalledWith('/tmp/tahti-bounce-xyz', { recursive: true, force: true })
  })

  it('does not activate when activate is false', async () => {
    const payload = basePayload({ activate: false })

    await processBounceArchiveEditJob(jobFor(payload))

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(syncActiveVersionToItem).not.toHaveBeenCalled()
  })

  it('applies EQ, compressor, limiter and loudnorm filters when enabled', async () => {
    const payload = basePayload({
      lufsTarget: 'stream',
      limiterEnabled: true,
      highPassHz: 80,
      lowPassHz: 15000,
      eq: { lowGainDb: 2, midGainDb: -1, highGainDb: 3 },
      compressorEnabled: true,
    })

    await processBounceArchiveEditJob(jobFor(payload))

    const audioFilters = ffmpegChain.audioFilters as ReturnType<typeof vi.fn>
    const filters = audioFilters.mock.calls[0]?.[0] as string
    expect(filters).toContain('highpass=f=80')
    expect(filters).toContain('lowpass=f=15000')
    expect(filters).toContain('bass=g=2:f=200')
    expect(filters).toContain('equalizer=f=1000:width_type=o:width=2:g=-1')
    expect(filters).toContain('treble=g=3:f=4000')
    expect(filters).toContain('acompressor=')
    expect(filters).toContain('loudnorm=I=-14:TP=-1.5')
    expect(filters).toContain('alimiter=')
  })

  it('marks the version as ERROR and rethrows when trimming fails', async () => {
    downloadToFile.mockRejectedValue(new Error('download failed'))
    const payload = basePayload()

    await expect(processBounceArchiveEditJob(jobFor(payload))).rejects.toThrow('download failed')

    expect(prismaMock.archiveItemVersion.update).toHaveBeenCalledWith({
      where: { id: 'ver-1' },
      data: { status: 'ERROR' },
    })
    expect(rm).toHaveBeenCalledWith('/tmp/tahti-bounce-xyz', { recursive: true, force: true })
  })

  it('throws when the version does not exist', async () => {
    prismaMock.archiveItemVersion.findUnique.mockResolvedValue(null)
    const payload = basePayload({ versionId: 'missing' })

    await expect(processBounceArchiveEditJob(jobFor(payload))).rejects.toThrow(
      'ArchiveItemVersion missing not found',
    )
  })
})
