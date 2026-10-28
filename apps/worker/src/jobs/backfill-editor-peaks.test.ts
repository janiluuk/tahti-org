// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Job } from 'bullmq'

const { prismaMock, download, pyramid, rowPeaks } = vi.hoisted(() => ({
  prismaMock: { sound: { findUnique: vi.fn(), update: vi.fn() } },
  download: vi.fn(),
  pyramid: vi.fn(),
  rowPeaks: vi.fn(),
}))

vi.mock('@tahti/db', () => ({ prisma: prismaMock, Prisma: { DbNull: 'DbNull' } }))
vi.mock('../lib/source-cache.js', () => ({ downloadSourceCached: download }))
vi.mock('../lib/editor-peaks.js', () => ({
  extractEditorPeaksPyramid: pyramid,
  extractAndStoreFinePeaks: vi.fn(),
  finePeaksKey: vi.fn(),
}))
vi.mock('../lib/waveform.js', () => ({ extractWaveformPeaks: rowPeaks }))
vi.mock('@tahti/audio-edit', () => ({ needsFinePeaks: () => false }))

import { processBackfillEditorPeaksJob } from './backfill-editor-peaks.js'

const job = { data: { itemId: 's1' } } as Job

describe('processBackfillEditorPeaksJob', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    download.mockResolvedValue(undefined)
  })

  it('fills the track-row waveform for a sound that has editor peaks but no row peaks, from its MP3', async () => {
    prismaMock.sound.findUnique.mockResolvedValue({
      id: 's1',
      status: 'READY',
      durationSec: 233,
      editorPeaks: { coarse: [] },
      peaks: null,
      rawKey: null,
      flacKey: null,
      mp3Key: 'mp3/s1.mp3',
      sourceChannels: 2,
      channel: { slug: 'minh' },
    })
    rowPeaks.mockResolvedValue([10, 200, 90])
    await processBackfillEditorPeaksJob(job)
    expect(download).toHaveBeenCalledWith('mp3/s1.mp3', expect.any(String))
    expect(pyramid).not.toHaveBeenCalled()
    expect(prismaMock.sound.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: expect.objectContaining({ peaks: [10, 200, 90] }),
    })
  })

  it('does nothing when both kinds of peaks are already there', async () => {
    prismaMock.sound.findUnique.mockResolvedValue({
      id: 's1',
      status: 'READY',
      durationSec: 60,
      editorPeaks: { coarse: [] },
      peaks: [1, 2, 3],
      rawKey: 'raw/s1',
      flacKey: null,
      mp3Key: null,
      sourceChannels: 2,
      channel: { slug: 'minh' },
    })
    await processBackfillEditorPeaksJob(job)
    expect(download).not.toHaveBeenCalled()
    expect(prismaMock.sound.update).not.toHaveBeenCalled()
  })
})
