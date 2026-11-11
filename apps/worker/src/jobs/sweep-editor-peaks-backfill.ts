// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Job } from 'bullmq'
import { Queue } from 'bullmq'
import { prisma, Prisma } from '@tahti/db'
import { clearFinishedJob } from '@tahti/shared'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'
const BATCH_SIZE = 24

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379', 10),
}

// Same defaults as apps/api/src/lib/queue.ts; the retention bounds Redis growth
// for any job added here that doesn't set its own.
const defaultJobOptions = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 5000 },
  removeOnComplete: { count: 500 },
  removeOnFail: { count: 1000 },
}

/** PERF-04: enqueue the peaks backfill for READY sounds with audio that are
 * missing editor peaks or the track-row waveform. */
export async function processSweepEditorPeaksBackfillJob(_job: Job): Promise<{ enqueued: number }> {
  const items = await prisma.sound.findMany({
    where: {
      status: 'READY',
      OR: [{ editorPeaks: { equals: Prisma.DbNull } }, { peaks: { equals: Prisma.DbNull } }],
      // Oldest-first with a small batch: rows the job can never fill (embed-only
      // sounds have no audio) would otherwise hold the head of the sweep forever.
      AND: [
        { OR: [{ flacKey: { not: null } }, { rawKey: { not: null } }, { mp3Key: { not: null } }] },
      ],
    },
    select: { id: true },
    take: BATCH_SIZE,
    orderBy: { createdAt: 'asc' },
  })

  if (items.length === 0) return { enqueued: 0 }

  const queue = new Queue('media', { connection, defaultJobOptions })
  try {
    for (const item of items) {
      const jobId = `backfill-editor-peaks-${item.id}`
      await clearFinishedJob(queue, jobId)
      await queue.add(
        'backfill-editor-peaks',
        { itemId: item.id },
        {
          jobId,
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
