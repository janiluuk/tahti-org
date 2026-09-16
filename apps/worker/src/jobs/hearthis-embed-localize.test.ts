// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

const { prismaMock, uploadStream, enqueueTranscodeSound, getTrackByUrl } = vi.hoisted(() => ({
  prismaMock: {
    sound: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
  uploadStream: vi.fn(),
  enqueueTranscodeSound: vi.fn(),
  getTrackByUrl: vi.fn(),
}))

vi.mock('@tahti/db', () => ({ prisma: prismaMock }))
vi.mock('../lib/minio.js', () => ({ uploadStream }))
vi.mock('../lib/queue.js', () => ({ enqueueTranscodeSound }))
vi.mock('@tahti/hearthis', () => ({
  createHearthisClient: () => ({ getTrackByUrl }),
}))

import { processHearthisEmbedLocalizationJob } from './hearthis-embed-localize.js'

function jobFor(soundId: string, trackUrl: string): Job {
  return { data: { soundId, trackUrl } } as Job
}

describe('processHearthisEmbedLocalizationJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('downloads audio and clears embed status once localized', async () => {
    prismaMock.sound.findUnique.mockResolvedValue({
      id: 'sound-1',
      source: 'HEARTHIS_EMBED',
      rawKey: null,
      channel: { slug: 'artist-one' },
    })
    getTrackByUrl.mockResolvedValue({
      downloadable: '1',
      download_url: 'https://hearthis.at/dl/track.mp3',
      download_filename: 'track.mp3',
      title: 'Track',
    })
    const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      body: new ReadableStream(),
      headers: new Headers({ 'content-type': 'audio/mpeg', 'content-length': '1234' }),
    }) as unknown as typeof fetch

    await processHearthisEmbedLocalizationJob(
      jobFor('sound-1', 'https://hearthis.at/someone/track/'),
    )

    globalThis.fetch = originalFetch

    expect(uploadStream).toHaveBeenCalled()
    expect(prismaMock.sound.update).toHaveBeenCalledWith({
      where: { id: 'sound-1' },
      data: expect.objectContaining({
        source: 'HEARTHIS',
        status: 'PENDING',
        contentType: 'TRACK',
        embedUri: null,
        embedProvider: null,
        embedSourceUrl: null,
      }),
    })
    expect(enqueueTranscodeSound).toHaveBeenCalledWith('sound-1')
  })

  it('does nothing when the track is not downloadable', async () => {
    prismaMock.sound.findUnique.mockResolvedValue({
      id: 'sound-1',
      source: 'HEARTHIS_EMBED',
      rawKey: null,
      channel: { slug: 'artist-one' },
    })
    getTrackByUrl.mockResolvedValue({ downloadable: '0', download_url: undefined })

    await processHearthisEmbedLocalizationJob(
      jobFor('sound-1', 'https://hearthis.at/someone/track/'),
    )

    expect(uploadStream).not.toHaveBeenCalled()
    expect(prismaMock.sound.update).not.toHaveBeenCalled()
  })

  it('does nothing when the sound already has real audio', async () => {
    prismaMock.sound.findUnique.mockResolvedValue({
      id: 'sound-1',
      source: 'HEARTHIS_EMBED',
      rawKey: 'raw/already-there.mp3',
      channel: { slug: 'artist-one' },
    })

    await processHearthisEmbedLocalizationJob(
      jobFor('sound-1', 'https://hearthis.at/someone/track/'),
    )

    expect(getTrackByUrl).not.toHaveBeenCalled()
    expect(prismaMock.sound.update).not.toHaveBeenCalled()
  })
})
