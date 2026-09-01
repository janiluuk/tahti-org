// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Genuine end-to-end check that a lossless upload's compressed streaming
// copy gets encoded — runs the REAL job function against a REAL Postgres
// and REAL ffmpeg (a tiny generated silent WAV). Only MinIO is mocked,
// same as transcode-release-track.e2e.test.ts.

import type { Job } from 'bullmq'
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prisma } from '@tahti/db'

const execFileAsync = promisify(execFile)

const minioMock = vi.hoisted(() => ({
  downloadToFile: vi.fn(),
  uploadFile: vi.fn(),
}))
vi.mock('../lib/minio.js', () => minioMock)

const { processEncodeStreamingCopyJob } = await import('./encode-streaming-copy.js')

const PREFIX = 'e2e-streaming-copy-'

function fakeJob(itemId: string): Job {
  return { data: { itemId }, updateProgress: vi.fn() } as unknown as Job
}

describe('processEncodeStreamingCopyJob (e2e)', () => {
  let fixtureDir: string
  let fixtureWavPath: string
  let userId: string
  let channelId: string
  let itemId: string

  beforeAll(async () => {
    fixtureDir = await mkdtemp(join(tmpdir(), 'tahti-e2e-streaming-copy-'))
    fixtureWavPath = join(fixtureDir, 'tone.wav')
    // A real (quiet) tone, not pure digital silence — true zero-amplitude
    // input crashes libmp3lame's psymodel under the loudnorm filter
    // (upstream ffmpeg/lame bug: "Assertion `el >= 0' failed" in
    // psymodel.c), which no genuine upload would ever trigger.
    await execFileAsync('ffmpeg', [
      '-f',
      'lavfi',
      '-i',
      'sine=frequency=440:sample_rate=44100:duration=2',
      '-ac',
      '2',
      '-y',
      fixtureWavPath,
    ])

    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}artist@example.com`,
        username: `${PREFIX}artist`,
        displayName: 'E2E Streaming Copy Artist',
        channel: {
          create: {
            slug: `${PREFIX}artist`,
            liveSourceMount: `/live/${PREFIX}artist`,
            liveSourcePass: 'x',
            liveSourcePassHash: 'x',
            rtmpStreamKey: `${PREFIX}artist__testkey`,
            rtmpStreamKeyHash: 'x',
          },
        },
      },
    })
    userId = user.id
    const channel = await prisma.channel.findUniqueOrThrow({ where: { userId: user.id } })
    channelId = channel.id

    const item = await prisma.archiveItem.create({
      data: {
        channelId,
        title: 'E2E Streaming Copy Track',
        rawKey: `raw/${PREFIX}artist/track.wav`,
        status: 'READY',
        streamingCopyStatus: 'PENDING',
      },
    })
    itemId = item.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await rm(fixtureDir, { recursive: true, force: true })
  })

  it('encodes an mp3 streaming copy, marks it READY, and notifies the artist', async () => {
    minioMock.downloadToFile.mockImplementation(async (_key: string, destPath: string) => {
      await writeFile(destPath, await readFile(fixtureWavPath))
    })
    minioMock.uploadFile.mockResolvedValue(undefined)

    await processEncodeStreamingCopyJob(fakeJob(itemId))

    const item = await prisma.archiveItem.findUniqueOrThrow({ where: { id: itemId } })
    expect(item.streamingCopyStatus).toBe('READY')
    expect(item.mp3Key).toBe(`mp3/${PREFIX}artist/${itemId}.mp3`)

    expect(minioMock.uploadFile).toHaveBeenCalledWith(
      `mp3/${PREFIX}artist/${itemId}.mp3`,
      expect.any(String),
      'audio/mpeg',
    )

    const notification = await prisma.notification.findFirstOrThrow({
      where: { userId, type: 'STREAMING_COPY_READY' },
    })
    expect(notification.url).toBe(`/dashboard/archive/${itemId}`)
  }, 20_000)

  it('marks the item ERROR if downloading the source fails', async () => {
    const failItem = await prisma.archiveItem.create({
      data: {
        channelId,
        title: 'E2E Streaming Copy Failure',
        rawKey: `raw/${PREFIX}artist/missing.wav`,
        status: 'READY',
        streamingCopyStatus: 'PENDING',
      },
    })
    minioMock.downloadToFile.mockRejectedValueOnce(new Error('object not found'))

    await expect(processEncodeStreamingCopyJob(fakeJob(failItem.id))).rejects.toThrow()

    const item = await prisma.archiveItem.findUniqueOrThrow({ where: { id: failItem.id } })
    expect(item.streamingCopyStatus).toBe('ERROR')
  })
})
