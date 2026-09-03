// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'
import { createDefaultEditList, editListFromV0Trim } from '@tahti/audio-edit'

const {
  mkdtemp,
  rm,
  stat,
  prismaMock,
  syncActiveVersionToItem,
  downloadSourceCached,
  uploadFile,
  deleteObject,
  processTranscodeVersionJob,
  ffmpegFactory,
} = vi.hoisted(() => {
  const chain: Record<string, unknown> & {
    handlers: Record<string, (...args: unknown[]) => void>
  } = { handlers: {} }
  chain.outputOptions = vi.fn(() => chain)
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
      soundVersion: {
        findUnique: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      $transaction: vi.fn(),
    },
    syncActiveVersionToItem: vi.fn(),
    downloadSourceCached: vi.fn(),
    uploadFile: vi.fn(),
    deleteObject: vi.fn(),
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
vi.mock('../lib/source-cache.js', () => ({ downloadSourceCached }))
vi.mock('../lib/minio.js', () => ({ uploadFile, deleteObject }))
vi.mock('./transcode-version.js', () => ({ processTranscodeVersionJob }))

import { processRenderSoundEditJob, type RenderSoundEditPayload } from './render-sound-edit.js'

function jobFor(payload: RenderSoundEditPayload): Job {
  return { data: payload, updateProgress: vi.fn().mockResolvedValue(undefined) } as unknown as Job
}

describe('processRenderSoundEditJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mkdtemp.mockResolvedValue('/tmp/tahti-render-edit-xyz')
    rm.mockResolvedValue(undefined)
    stat.mockResolvedValue({ size: 12345 })
    downloadSourceCached.mockResolvedValue(undefined)
    uploadFile.mockResolvedValue(undefined)
    processTranscodeVersionJob.mockResolvedValue(undefined)
    prismaMock.soundVersion.findUnique.mockResolvedValue({ id: 'ver-1' })
    prismaMock.soundVersion.findMany.mockResolvedValue([])
    prismaMock.soundVersion.update.mockResolvedValue({})
    prismaMock.soundVersion.updateMany.mockResolvedValue({})
    prismaMock.soundVersion.delete.mockResolvedValue({})
    prismaMock.$transaction.mockResolvedValue([])
    syncActiveVersionToItem.mockResolvedValue(undefined)
  })

  it('renders, uploads, transcodes and activates the version', async () => {
    const payload: RenderSoundEditPayload = {
      versionId: 'ver-1',
      soundId: 'item-1',
      channelSlug: 'artist-one',
      sourceKey: 'raw/artist-one/source.flac',
      editList: createDefaultEditList(120),
      format: 'flac',
      activate: true,
    }

    await processRenderSoundEditJob(jobFor(payload))

    expect(prismaMock.soundVersion.findUnique).toHaveBeenCalledWith({
      where: { id: 'ver-1' },
    })
    expect(prismaMock.soundVersion.update).toHaveBeenCalledWith({
      where: { id: 'ver-1' },
      data: { status: 'PROCESSING' },
    })
    expect(downloadSourceCached).toHaveBeenCalledWith(
      'raw/artist-one/source.flac',
      '/tmp/tahti-render-edit-xyz/input',
    )
    expect(uploadFile).toHaveBeenCalled()
    expect(processTranscodeVersionJob).toHaveBeenCalledWith({ data: { versionId: 'ver-1' } })
    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(syncActiveVersionToItem).toHaveBeenCalledWith(prismaMock, 'item-1')
    expect(rm).toHaveBeenCalledWith('/tmp/tahti-render-edit-xyz', { recursive: true, force: true })
  })

  it('does not activate when activate is false', async () => {
    const payload: RenderSoundEditPayload = {
      versionId: 'ver-1',
      soundId: 'item-1',
      channelSlug: 'artist-one',
      sourceKey: 'raw/artist-one/source.flac',
      editList: createDefaultEditList(120),
      format: 'wav',
      activate: false,
    }

    await processRenderSoundEditJob(jobFor(payload))

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(syncActiveVersionToItem).not.toHaveBeenCalled()
  })

  it('rejects an invalid edit list before touching the database', async () => {
    const invalidEdit = { ...createDefaultEditList(120), cuts: [{ start: 0, end: 120 }] }
    const payload: RenderSoundEditPayload = {
      versionId: 'ver-1',
      soundId: 'item-1',
      channelSlug: 'artist-one',
      sourceKey: 'raw/artist-one/source.flac',
      editList: invalidEdit,
      format: 'flac',
      activate: false,
    }

    await expect(processRenderSoundEditJob(jobFor(payload))).rejects.toThrow()

    expect(prismaMock.soundVersion.findUnique).not.toHaveBeenCalled()
    expect(downloadSourceCached).not.toHaveBeenCalled()
  })

  it('marks the version as ERROR and rethrows when rendering fails', async () => {
    downloadSourceCached.mockRejectedValue(new Error('download failed'))
    const payload: RenderSoundEditPayload = {
      versionId: 'ver-1',
      soundId: 'item-1',
      channelSlug: 'artist-one',
      sourceKey: 'raw/artist-one/source.flac',
      editList: createDefaultEditList(120),
      format: 'flac',
      activate: false,
    }

    await expect(processRenderSoundEditJob(jobFor(payload))).rejects.toThrow('download failed')

    expect(prismaMock.soundVersion.update).toHaveBeenCalledWith({
      where: { id: 'ver-1' },
      data: { status: 'ERROR' },
    })
    expect(rm).toHaveBeenCalledWith('/tmp/tahti-render-edit-xyz', { recursive: true, force: true })
  })

  it('throws when the version does not exist', async () => {
    prismaMock.soundVersion.findUnique.mockResolvedValue(null)
    const payload: RenderSoundEditPayload = {
      versionId: 'missing',
      soundId: 'item-1',
      channelSlug: 'artist-one',
      sourceKey: 'raw/artist-one/source.flac',
      editList: createDefaultEditList(120),
      format: 'flac',
      activate: false,
    }

    await expect(processRenderSoundEditJob(jobFor(payload))).rejects.toThrow(
      'SoundVersion missing not found',
    )
  })

  it('skips version transcode when sampleOnly is true', async () => {
    const payload: RenderSoundEditPayload = {
      versionId: 'ver-1',
      soundId: 'item-1',
      channelSlug: 'artist-one',
      sourceKey: 'raw/artist-one/source.flac',
      editList: createDefaultEditList(120),
      format: 'mp3',
      activate: false,
      maxDurationSec: 30,
      sampleOnly: true,
    }

    await processRenderSoundEditJob(jobFor(payload))

    expect(processTranscodeVersionJob).not.toHaveBeenCalled()
    expect(prismaMock.soundVersion.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'ver-1' },
        data: expect.objectContaining({ status: 'READY' }),
      }),
    )
  })

  it('accepts edit lists converted from v0 trim params', async () => {
    const editList = editListFromV0Trim({
      sourceDuration: 120,
      startSec: 10,
      endSec: 40,
      fadeInSec: 1,
      fadeOutSec: 2,
      peakNormalize: false,
      lufsTarget: 'stream',
      limiterEnabled: true,
      highPassHz: 80,
      lowPassHz: 16000,
      eq: { lowGainDb: 2, midGainDb: 0, highGainDb: -1 },
      compressorEnabled: true,
    })
    const payload: RenderSoundEditPayload = {
      versionId: 'ver-1',
      soundId: 'item-1',
      channelSlug: 'artist-one',
      sourceKey: 'raw/artist-one/source.flac',
      editList,
      format: 'wav',
      activate: false,
    }

    await processRenderSoundEditJob(jobFor(payload))

    expect(downloadSourceCached).toHaveBeenCalled()
    expect(uploadFile).toHaveBeenCalled()
  })
})
