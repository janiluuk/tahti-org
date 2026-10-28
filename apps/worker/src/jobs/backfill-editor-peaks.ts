// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prisma, Prisma } from '@tahti/db'
import { downloadSourceCached } from '../lib/source-cache.js'
import { needsFinePeaks, type PeaksPyramid } from '@tahti/audio-edit'
import {
  extractAndStoreFinePeaks,
  extractEditorPeaksPyramid,
  finePeaksKey,
} from '../lib/editor-peaks.js'
import { extractWaveformPeaks } from '../lib/waveform.js'

/** PERF-04 backfill: compute editorPeaks for sounds ingested before the
 * column existed, fine peaks for long sounds that don't have them, and the
 * track-row waveform (`peaks`) for sounds that never got one (seeded or
 * imported tracks). */
export async function processBackfillEditorPeaksJob(job: Job): Promise<void> {
  const { itemId } = job.data as { itemId: string }

  const item = await prisma.sound.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      status: true,
      durationSec: true,
      editorPeaks: true,
      peaks: true,
      rawKey: true,
      flacKey: true,
      mp3Key: true,
      sourceChannels: true,
      channel: { select: { slug: true } },
    },
  })

  if (!item || item.status !== 'READY') return
  const wantsFine = needsFinePeaks(item.durationSec, item.editorPeaks)
  const wantsRowPeaks = item.peaks === null
  if (item.editorPeaks && !wantsFine && !wantsRowPeaks) return

  const sourceKey = item.flacKey ?? item.rawKey ?? item.mp3Key
  if (!sourceKey) return

  const durationSec = item.durationSec ?? 60
  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-backfill-peaks-'))
  try {
    const rawPath = join(tmpDir, 'source')
    await downloadSourceCached(sourceKey, rawPath)
    const editorPeaks =
      (item.editorPeaks as unknown as PeaksPyramid | null) ??
      (await extractEditorPeaksPyramid(rawPath, durationSec))
    const rowPeaks = wantsRowPeaks ? await extractWaveformPeaks(rawPath) : null
    if (!editorPeaks) {
      if (rowPeaks) {
        await prisma.sound.update({ where: { id: itemId }, data: { peaks: rowPeaks } })
      }
      return
    }
    if (wantsFine) {
      const fine = await extractAndStoreFinePeaks(
        rawPath,
        item.sourceChannels,
        finePeaksKey(item.channel.slug, itemId),
      )
      if (fine) editorPeaks.fine = fine
    }

    await prisma.sound.update({
      where: { id: itemId },
      data: {
        editorPeaks: editorPeaks as unknown as Prisma.InputJsonValue,
        ...(rowPeaks ? { peaks: rowPeaks } : {}),
      },
    })
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
