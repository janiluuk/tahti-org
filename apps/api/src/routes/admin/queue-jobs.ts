// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Job } from 'bullmq'
import {
  AdminQueueJobListResponseSchema,
  AdminQueueJobStateSchema,
  openApiResponse,
  type AdminQueueJobState,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { mediaQueue } from '../../lib/queue.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function toIso(ms: number | undefined | null): string | null {
  if (ms == null || !Number.isFinite(ms)) return null
  return new Date(ms).toISOString()
}

function soundIdFromData(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null
  const row = data as Record<string, unknown>
  for (const key of ['itemId', 'soundId', 'id'] as const) {
    const value = row[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

async function subjectForJob(
  prisma: typeof import('@tahti/db').prisma,
  job: Job,
): Promise<{
  kind: 'sound' | 'unknown'
  id: string | null
  title: string | null
  ownerUsername: string | null
}> {
  const soundId = soundIdFromData(job.data)
  if (!soundId) {
    return { kind: 'unknown', id: null, title: null, ownerUsername: null }
  }
  const sound = await prisma.sound.findUnique({
    where: { id: soundId },
    select: {
      id: true,
      title: true,
      channel: { select: { user: { select: { username: true } } } },
    },
  })
  if (!sound) {
    return { kind: 'sound', id: soundId, title: null, ownerUsername: null }
  }
  return {
    kind: 'sound',
    id: sound.id,
    title: sound.title,
    ownerUsername: sound.channel?.user.username ?? null,
  }
}

const adminQueueJobsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/queues/media/jobs',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description:
          'List BullMQ media-queue jobs by state (waiting / active / delayed / failed / completed), newest page first. Optional jobName filter.',
        response: openApiResponse(AdminQueueJobListResponseSchema, 'AdminQueueJobListResponse'),
      },
    },
    async (request, reply) => {
      const query = request.query as Record<string, string | undefined>
      const parsedState = AdminQueueJobStateSchema.safeParse(query.state ?? 'waiting')
      if (!parsedState.success) {
        return reply.status(400).send({ error: 'Invalid state' })
      }
      const state: AdminQueueJobState = parsedState.data
      const page = Math.max(0, Number.parseInt(query.page ?? '0', 10) || 0)
      const limit = Math.min(
        MAX_LIMIT,
        Math.max(1, Number.parseInt(query.limit ?? String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT),
      )
      const jobName = query.jobName?.trim() || null

      const counts = await mediaQueue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
        'completed',
      )
      const totalForState = counts[state] ?? 0
      const start = page * limit
      const end = start + limit - 1
      let jobs = await mediaQueue.getJobs([state], start, end)
      if (jobName) {
        jobs = jobs.filter((job) => job.name === jobName)
      }

      const mapped = await Promise.all(
        jobs.map(async (job) => {
          const subject = await subjectForJob(fastify.prisma, job)
          return {
            id: String(job.id),
            name: job.name,
            state,
            timestamp: toIso(job.timestamp),
            processedOn: toIso(job.processedOn),
            finishedOn: toIso(job.finishedOn),
            attemptsMade: job.attemptsMade ?? 0,
            failedReason: job.failedReason ?? null,
            subject,
          }
        }),
      )

      return reply.send({
        state,
        total: jobName ? mapped.length + start : totalForState,
        page,
        limit,
        jobs: mapped,
      })
    },
  )
}

export default adminQueueJobsRoutes
