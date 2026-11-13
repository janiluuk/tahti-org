// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Job } from 'bullmq'
import {
  AdminQueueJobIdParamSchema,
  AdminQueueJobListResponseSchema,
  AdminQueueJobStateSchema,
  AdminQueueOkSchema,
  AdminQueuePausedSchema,
  AdminStuckPendingListResponseSchema,
  AdminStuckPendingRequeueBodySchema,
  AdminStuckPendingRequeueResponseSchema,
  openApiResponse,
  parseRouteParams,
  type AdminQueueJobState,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { enqueueTranscode, mediaQueue } from '../../lib/queue.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100
const STUCK_AFTER_MS = 60 * 60 * 1000
const STUCK_LIST_LIMIT = 50
const LIVE_JOB_STATES = ['waiting', 'active', 'delayed', 'prioritized', 'paused'] as const

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

async function liveTranscodeSoundIds(): Promise<Set<string>> {
  const live = await mediaQueue.getJobs([...LIVE_JOB_STATES])
  return new Set(
    live
      .filter((job) => job?.name === 'transcode-sound')
      .map((job) => soundIdFromData(job.data))
      .filter((id): id is string => Boolean(id)),
  )
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

  fastify.get(
    '/api/admin/queues/media/paused',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Whether the media queue is paused.',
        response: openApiResponse(AdminQueuePausedSchema, 'AdminQueuePaused'),
      },
    },
    async (_request, reply) => {
      const paused = await mediaQueue.isPaused()
      return reply.send({ paused })
    },
  )

  fastify.post(
    '/api/admin/queues/media/pause',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Pause the media queue. New work stops; jobs already running finish.',
        response: openApiResponse(AdminQueuePausedSchema, 'AdminQueuePaused'),
      },
    },
    async (_request, reply) => {
      await mediaQueue.pause()
      return reply.send({ paused: true })
    },
  )

  fastify.post(
    '/api/admin/queues/media/resume',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Resume the media queue after a pause.',
        response: openApiResponse(AdminQueuePausedSchema, 'AdminQueuePaused'),
      },
    },
    async (_request, reply) => {
      await mediaQueue.resume()
      return reply.send({ paused: false })
    },
  )

  fastify.post(
    '/api/admin/queues/media/jobs/:id/retry',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Retry one failed media-queue job. Does not confirm.',
        response: openApiResponse(AdminQueueOkSchema, 'AdminQueueOk'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(AdminQueueJobIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const job = await mediaQueue.getJob(routeParams.id)
      if (!job) return reply.status(404).send({ error: 'Job not found' })
      const state = await job.getState()
      if (state !== 'failed') {
        return reply.status(409).send({ error: 'Only a failed job can be retried' })
      }
      await job.retry()
      return reply.send({ ok: true as const })
    },
  )

  fastify.delete(
    '/api/admin/queues/media/jobs/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description:
          'Remove one media-queue job. Does not delete the sound or release it belonged to.',
        response: openApiResponse(AdminQueueOkSchema, 'AdminQueueOk'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(AdminQueueJobIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const job = await mediaQueue.getJob(routeParams.id)
      if (!job) return reply.status(404).send({ error: 'Job not found' })
      await job.remove()
      return reply.send({ ok: true as const })
    },
  )

  fastify.get(
    '/api/admin/queues/media/stuck-pending',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description:
          'List sounds stuck PENDING/PROCESSING for over an hour with a stored file and no live transcode-sound job.',
        response: openApiResponse(
          AdminStuckPendingListResponseSchema,
          'AdminStuckPendingListResponse',
        ),
      },
    },
    async (_request, reply) => {
      const cutoff = new Date(Date.now() - STUCK_AFTER_MS)
      const candidates = await fastify.prisma.sound.findMany({
        where: {
          status: { in: ['PENDING', 'PROCESSING'] },
          rawKey: { not: null },
          updatedAt: { lt: cutoff },
        },
        select: {
          id: true,
          title: true,
          status: true,
          updatedAt: true,
          rawKey: true,
          channel: { select: { user: { select: { username: true } } } },
        },
        orderBy: { updatedAt: 'asc' },
        take: STUCK_LIST_LIMIT * 2,
      })
      const queuedIds = await liveTranscodeSoundIds()
      const stuck = candidates
        .filter((row) => !queuedIds.has(row.id))
        .slice(0, STUCK_LIST_LIMIT)
        .map((row) => ({
          id: row.id,
          title: row.title,
          status: row.status as 'PENDING' | 'PROCESSING',
          updatedAt: row.updatedAt.toISOString(),
          ownerUsername: row.channel?.user.username ?? null,
          rawKey: row.rawKey,
        }))
      return reply.send({ total: stuck.length, sounds: stuck })
    },
  )

  fastify.post(
    '/api/admin/queues/media/stuck-pending/requeue',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description:
          'Re-queue transcode for one stuck PENDING/PROCESSING sound, or all currently listed stuck sounds.',
        response: openApiResponse(
          AdminStuckPendingRequeueResponseSchema,
          'AdminStuckPendingRequeueResponse',
        ),
      },
    },
    async (request, reply) => {
      const body = AdminStuckPendingRequeueBodySchema.safeParse(request.body ?? {})
      if (!body.success) {
        return reply.status(400).send({ error: 'Invalid request body' })
      }
      if (!body.data.soundId && !body.data.all) {
        return reply.status(400).send({ error: 'Provide soundId or all: true' })
      }

      const cutoff = new Date(Date.now() - STUCK_AFTER_MS)
      const stuckWhere = {
        status: { in: ['PENDING' as const, 'PROCESSING' as const] },
        rawKey: { not: null },
        updatedAt: { lt: cutoff },
      }

      let targets: Array<{ id: string }>
      if (body.data.soundId) {
        const one = await fastify.prisma.sound.findFirst({
          where: { id: body.data.soundId, ...stuckWhere },
          select: { id: true },
        })
        if (!one) {
          return reply.status(404).send({ error: 'Stuck sound not found' })
        }
        targets = [one]
      } else {
        targets = await fastify.prisma.sound.findMany({
          where: stuckWhere,
          select: { id: true },
          orderBy: { updatedAt: 'asc' },
          take: STUCK_LIST_LIMIT,
        })
      }

      const queuedIds = await liveTranscodeSoundIds()
      const ids: string[] = []
      for (const { id } of targets) {
        if (queuedIds.has(id)) continue
        const { count } = await fastify.prisma.sound.updateMany({
          where: { id, ...stuckWhere },
          data: { status: 'PENDING', processingError: null },
        })
        if (count === 0) continue
        await enqueueTranscode(id)
        ids.push(id)
      }
      return reply.send({ enqueued: ids.length, ids })
    },
  )
}

export default adminQueueJobsRoutes
