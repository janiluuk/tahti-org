// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Job } from 'bullmq'
import { writeFile } from 'node:fs/promises'
import AdmZip from 'adm-zip'

const { prismaMock, minioMock } = vi.hoisted(() => ({
  prismaMock: {
    sound: { findUnique: vi.fn() },
    soundStemJob: { update: vi.fn() },
  },
  minioMock: {
    downloadToFile: vi.fn(),
    uploadFile: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@tahti/db', () => ({ prisma: prismaMock }))
vi.mock('../lib/minio.js', () => minioMock)

const { processSeparateStemsJob } = await import('./separate-stems.js')

function buildStemsZip(entries: Record<string, string>): Buffer {
  const zip = new AdmZip()
  for (const [name, content] of Object.entries(entries)) {
    zip.addFile(name, Buffer.from(content))
  }
  return zip.toBuffer()
}

describe('processSeparateStemsJob', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.sound.findUnique.mockResolvedValue({
      channel: { slug: 'test-artist' },
    })
    minioMock.downloadToFile.mockImplementation(async (_key: string, destPath: string) => {
      await writeFile(destPath, 'fake-source-audio')
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
  })

  it('uploads matched stems and marks the job READY', async () => {
    const zipBuffer = buildStemsZip({
      'source_(Vocals).flac': 'vocals-audio',
      'source_(Instrumental).flac': 'instrumental-audio',
    })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () =>
        zipBuffer.buffer.slice(zipBuffer.byteOffset, zipBuffer.byteOffset + zipBuffer.byteLength),
    }) as unknown as typeof fetch

    await processSeparateStemsJob({
      data: {
        stemJobId: 'job-1',
        soundId: 'item-1',
        sourceKey: 'raw/test-artist/track.wav',
        stemSet: 'TWO_STEM',
      },
    } as unknown as Job)

    expect(minioMock.uploadFile).toHaveBeenCalledTimes(2)
    const readyCall = prismaMock.soundStemJob.update.mock.calls.find(
      (call: unknown[]) => (call[0] as { data: { status?: string } }).data.status === 'READY',
    )
    expect(readyCall).toBeDefined()
    const data = readyCall![0].data
    expect(data.vocalsKey).toContain('stems/test-artist/item-1/job-1')
    expect(data.instrumentalKey).toContain('stems/test-artist/item-1/job-1')
    expect(data.expiresAt).toBeInstanceOf(Date)
  })

  it('marks the job ERROR when the stem-separator call fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => 'boom',
    }) as unknown as typeof fetch

    await expect(
      processSeparateStemsJob({
        data: {
          stemJobId: 'job-2',
          soundId: 'item-1',
          sourceKey: 'raw/test-artist/track.wav',
          stemSet: 'FOUR_STEM',
        },
      } as unknown as Job),
    ).rejects.toThrow()

    const errorCall = prismaMock.soundStemJob.update.mock.calls.find(
      (call: unknown[]) => (call[0] as { data: { status?: string } }).data.status === 'ERROR',
    )
    expect(errorCall).toBeDefined()
  })
})
