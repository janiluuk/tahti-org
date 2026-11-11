// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Queue } from 'bullmq'
import { prisma } from '@tahti/db'
import { JOB_RETENTION } from '../lib/job-retention.js'

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379'

const connection = {
  host: new URL(REDIS_URL).hostname,
  port: parseInt(new URL(REDIS_URL).port || '6379', 10),
}

export const STUCK_TRANSCODE_AFTER_MS = 60 * 60 * 1000
export const STUCK_TRANSCODE_BATCH = 20

const LIVE_JOB_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'paused'] as const

/**
 * Re-queues transcode-sound for uploads that have sat PENDING/PROCESSING for an
 * hour with no transcode job left in the queue, so a lost or exhausted job does
 * not leave the sound stuck until its owner notices. A sound whose job is still
 * waiting (e.g. while no transcode-lane worker is up) is left to that job.
 */
export async function processSweepStuckSoundTranscodesJob(): Promise<{
  stuck: number
  enqueued: number
}> {
  const cutoff = new Date(Date.now() - STUCK_TRANSCODE_AFTER_MS)
  const stuckWhere = {
    status: { in: ['PENDING' as const, 'PROCESSING' as const] },
    rawKey: { not: null },
    updatedAt: { lt: cutoff },
  }
  const candidates = await prisma.sound.findMany({
    where: stuckWhere,
    select: { id: true },
    orderBy: { updatedAt: 'asc' },
    take: STUCK_TRANSCODE_BATCH,
  })
  if (candidates.length === 0) return { stuck: 0, enqueued: 0 }

  const queue = new Queue('media', {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential' as const, delay: 5000 },
      ...JOB_RETENTION,
    },
  })
  let enqueued = 0
  try {
    const live = await queue.getJobs([...LIVE_JOB_STATES])
    const queuedIds = new Set(
      live
        .filter((job) => job?.name === 'transcode-sound')
        .map((job) => (job.data as { itemId?: string }).itemId),
    )
    for (const { id } of candidates) {
      if (queuedIds.has(id)) continue
      // Conditional on the same staleness so an owner's retry click that
      // landed since the read above is not queued a second time.
      const { count } = await prisma.sound.updateMany({
        where: { id, ...stuckWhere },
        data: { status: 'PENDING', processingError: null },
      })
      if (count === 0) continue
      await queue.add('transcode-sound', { itemId: id })
      enqueued += 1
    }
  } finally {
    await queue.close()
  }

  if (enqueued > 0) {
    console.log(`[worker] sweep-stuck-sound-transcodes: re-queued ${enqueued} sound(s)`)
  }
  return { stuck: candidates.length, enqueued }
}
