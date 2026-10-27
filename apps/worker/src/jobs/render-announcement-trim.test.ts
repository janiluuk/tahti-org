// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Job } from 'bullmq'

const db = vi.hoisted(() => ({ updateMany: vi.fn() }))
vi.mock('@tahti/db', () => ({ prisma: { announcementClip: db } }))
vi.mock('../lib/minio.js', () => ({ downloadToFile: vi.fn(), uploadFile: vi.fn() }))
import {
  processRenderAnnouncementTrimJob,
  renderAnnouncementAudio,
} from './render-announcement-trim.js'
const run = promisify(execFile)
let dir: string
const settings = {
  clipId: 'clip',
  sourceKey: 'source',
  outputKeyPrefix: 'announcements/own/a',
  startSec: 0.25,
  endSec: 1.75,
  fadeInSec: 0.02,
  fadeOutSec: 0.02,
  normalize: true,
  removeRumble: true,
  compress: true,
  deEss: true,
  warmth: true,
  clarity: true,
}

beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), 'clip-render-test-'))
  await run('ffmpeg', [
    '-f',
    'lavfi',
    '-i',
    'sine=frequency=440:sample_rate=48000:duration=2',
    '-c:a',
    'pcm_s24le',
    join(dir, 'original.wav'),
  ])
})
afterAll(async () => {
  await rm(dir, { recursive: true, force: true })
})
describe('lossless clip renders', () => {
  it('renders the complete vocal chain as lossless PCM at the source sample rate, leaving original bytes unchanged', async () => {
    const before = await readFile(join(dir, 'original.wav'))
    await renderAnnouncementAudio(join(dir, 'original.wav'), join(dir, 'processed.wav'), settings)
    const { stdout } = await run('ffprobe', [
      '-v',
      'quiet',
      '-show_streams',
      '-show_format',
      '-of',
      'json',
      join(dir, 'processed.wav'),
    ])
    const info = JSON.parse(stdout)
    expect(info.streams[0]).toMatchObject({ codec_name: 'pcm_f32le', sample_rate: '48000' })
    expect(Number(info.format.duration)).toBeCloseTo(1.5, 2)
    expect(await readFile(join(dir, 'original.wav'))).toEqual(before)
  })
  it('rejects trimming outside the real source duration', async () => {
    await expect(
      renderAnnouncementAudio(join(dir, 'original.wav'), join(dir, 'bad.wav'), {
        ...settings,
        endSec: 20,
      }),
    ).rejects.toThrow('outside')
  })
  it('ignores superseded or deleted preview jobs', async () => {
    db.updateMany.mockResolvedValue({ count: 0 })
    await processRenderAnnouncementTrimJob({
      data: { ...settings, editorToken: 'old-token' },
    } as Job)
    expect(db.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'clip', renderToken: 'old-token' } }),
    )
    expect(db.updateMany).toHaveBeenCalledTimes(1)
  })
})
