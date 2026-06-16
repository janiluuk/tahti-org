// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { prisma, Prisma } from '@tahti/db'
import { downloadSourceCached } from '../lib/source-cache.js'
import { extractEditorPeaksPyramid } from '../lib/editor-peaks.js'

/** PERF-04 backfill: compute editorPeaks for archives ingested before the column existed. */
export async function processBackfillEditorPeaksJob(job: Job): Promise<void> {
  const { itemId } = job.data as { itemId: string }

  const item = await prisma.archiveItem.findUnique({
    where: { id: itemId },
    select: {
      id: true,
      status: true,
      durationSec: true,
      editorPeaks: true,
      rawKey: true,
      flacKey: true,
    },
  })

  if (!item || item.status !== 'READY' || item.editorPeaks) return

  const sourceKey = item.flacKey ?? item.rawKey
  if (!sourceKey) return

  const durationSec = item.durationSec ?? 60
  const tmpDir = await mkdtemp(join(tmpdir(), 'tahti-backfill-peaks-'))
  try {
    const rawPath = join(tmpDir, 'source')
    await downloadSourceCached(sourceKey, rawPath)
    const editorPeaks = await extractEditorPeaksPyramid(rawPath, durationSec)
    if (!editorPeaks) return

    await prisma.archiveItem.update({
      where: { id: itemId },
      data: { editorPeaks: editorPeaks as unknown as Prisma.InputJsonValue },
    })
  } finally {
    await rm(tmpDir, { recursive: true, force: true })
  }
}
