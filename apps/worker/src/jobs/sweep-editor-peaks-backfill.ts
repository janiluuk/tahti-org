// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { Queue } from 'bullmq'
import { prisma, Prisma } from '@tahti/db'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const BATCH_SIZE = 24

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379', 10),
}

// See apps/api/src/lib/queue.ts — gives lane-filtered workers a chance to land
// on the right worker instead of losing the job on first mismatch.
const defaultJobOptions = { attempts: 3, backoff: { type: 'exponential' as const, delay: 5000 } }

/** PERF-04: enqueue editorPeaks backfill for READY archives missing the column. */
export async function processSweepEditorPeaksBackfillJob(_job: Job): Promise<{ enqueued: number }> {
  const items = await prisma.archiveItem.findMany({
    where: { status: 'READY', editorPeaks: { equals: Prisma.DbNull } },
    select: { id: true },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  })

  if (items.length === 0) return { enqueued: 0 }

  const queue = new Queue('media', { connection, defaultJobOptions })
  try {
    for (const item of items) {
      await queue.add(
        'backfill-editor-peaks',
        { itemId: item.id },
        {
          jobId: `backfill-editor-peaks-${item.id}`,
          removeOnComplete: true,
          removeOnFail: 50,
        },
      )
    }
  } finally {
    await queue.close()
  }

  return { enqueued: items.length }
}
