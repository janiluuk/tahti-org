// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'
import { createDefaultEditList } from '@tahti/audio-edit'

const {
  mkdtemp,
  rm,
  stat,
  prismaMock,
  syncActiveVersionToItem,
  downloadToFile,
  uploadFile,
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

import {
  processRenderArchiveEditJob,
  type RenderArchiveEditPayload,
} from './render-archive-edit.js'

function jobFor(payload: RenderArchiveEditPayload): Job {
  return { data: payload } as Job
}

describe('processRenderArchiveEditJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mkdtemp.mockResolvedValue('/tmp/tahti-render-edit-xyz')
    rm.mockResolvedValue(undefined)
    stat.mockResolvedValue({ size: 12345 })
    downloadToFile.mockResolvedValue(undefined)
    uploadFile.mockResolvedValue(undefined)
    processTranscodeVersionJob.mockResolvedValue(undefined)
    prismaMock.archiveItemVersion.findUnique.mockResolvedValue({ id: 'ver-1' })
    prismaMock.archiveItemVersion.update.mockResolvedValue({})
    prismaMock.archiveItemVersion.updateMany.mockResolvedValue({})
    prismaMock.$transaction.mockResolvedValue([])
    syncActiveVersionToItem.mockResolvedValue(undefined)
  })

  it('renders, uploads, transcodes and activates the version', async () => {
    const payload: RenderArchiveEditPayload = {
      versionId: 'ver-1',
      archiveItemId: 'item-1',
      channelSlug: 'artist-one',
      sourceKey: 'raw/artist-one/source.flac',
      editList: createDefaultEditList(120),
      format: 'flac',
      activate: true,
    }

    await processRenderArchiveEditJob(jobFor(payload))

    expect(prismaMock.archiveItemVersion.findUnique).toHaveBeenCalledWith({
      where: { id: 'ver-1' },
    })
    expect(prismaMock.archiveItemVersion.update).toHaveBeenCalledWith({
      where: { id: 'ver-1' },
      data: { status: 'PROCESSING' },
    })
    expect(downloadToFile).toHaveBeenCalledWith(
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
    const payload: RenderArchiveEditPayload = {
      versionId: 'ver-1',
      archiveItemId: 'item-1',
      channelSlug: 'artist-one',
      sourceKey: 'raw/artist-one/source.flac',
      editList: createDefaultEditList(120),
      format: 'wav',
      activate: false,
    }

    await processRenderArchiveEditJob(jobFor(payload))

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(syncActiveVersionToItem).not.toHaveBeenCalled()
  })

  it('rejects an invalid edit list before touching the database', async () => {
    const invalidEdit = { ...createDefaultEditList(120), cuts: [{ start: 0, end: 120 }] }
    const payload: RenderArchiveEditPayload = {
      versionId: 'ver-1',
      archiveItemId: 'item-1',
      channelSlug: 'artist-one',
      sourceKey: 'raw/artist-one/source.flac',
      editList: invalidEdit,
      format: 'flac',
      activate: false,
    }

    await expect(processRenderArchiveEditJob(jobFor(payload))).rejects.toThrow()

    expect(prismaMock.archiveItemVersion.findUnique).not.toHaveBeenCalled()
    expect(downloadToFile).not.toHaveBeenCalled()
  })

  it('marks the version as ERROR and rethrows when rendering fails', async () => {
    downloadToFile.mockRejectedValue(new Error('download failed'))
    const payload: RenderArchiveEditPayload = {
      versionId: 'ver-1',
      archiveItemId: 'item-1',
      channelSlug: 'artist-one',
      sourceKey: 'raw/artist-one/source.flac',
      editList: createDefaultEditList(120),
      format: 'flac',
      activate: false,
    }

    await expect(processRenderArchiveEditJob(jobFor(payload))).rejects.toThrow('download failed')

    expect(prismaMock.archiveItemVersion.update).toHaveBeenCalledWith({
      where: { id: 'ver-1' },
      data: { status: 'ERROR' },
    })
    expect(rm).toHaveBeenCalledWith('/tmp/tahti-render-edit-xyz', { recursive: true, force: true })
  })

  it('throws when the version does not exist', async () => {
    prismaMock.archiveItemVersion.findUnique.mockResolvedValue(null)
    const payload: RenderArchiveEditPayload = {
      versionId: 'missing',
      archiveItemId: 'item-1',
      channelSlug: 'artist-one',
      sourceKey: 'raw/artist-one/source.flac',
      editList: createDefaultEditList(120),
      format: 'flac',
      activate: false,
    }

    await expect(processRenderArchiveEditJob(jobFor(payload))).rejects.toThrow(
      'ArchiveItemVersion missing not found',
    )
  })
})
