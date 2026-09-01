// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Reads the worker fleet's self-registered state from Redis (see
// apps/worker/src/lib/worker-registry.ts) — there is no hardcoded list of
// worker hosts anywhere; whatever has heartbeated in is what shows here. A
// worker that has stopped heartbeating still shows up, just as "offline",
// rather than silently disappearing.

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminWorkersResponseSchema,
  AdminWorkerDetailResponseSchema,
  openApiResponse,
  type AdminWorkerJobEventSchema,
} from '@tahti/shared'
import type { z } from 'zod'
import { requireBoard } from '../../plugins/auth.js'
import { getRedisClient } from '../../lib/redis.js'

const KNOWN_SET_KEY = 'workers:known'
const ONLINE_THRESHOLD_MS = 60_000

type WorkerSummary = z.infer<typeof AdminWorkersResponseSchema>['workers'][number]

function workerKey(name: string): string {
  return `worker:${name}`
}

function historyKey(name: string): string {
  return `worker:${name}:history`
}

function toIso(raw: string | undefined): string | null {
  if (!raw) return null
  const n = Number(raw)
  return Number.isFinite(n) ? new Date(n).toISOString() : null
}

function summaryFromHash(name: string, hash: Record<string, string>): WorkerSummary {
  const updatedAtMs = hash.updatedAt ? Number(hash.updatedAt) : null
  const online = updatedAtMs != null && Date.now() - updatedAtMs < ONLINE_THRESHOLD_MS
  return {
    name,
    lanes: hash.lanes ? hash.lanes.split(',').filter(Boolean) : [],
    status: online ? 'online' : 'offline',
    jobStatus: hash.status ?? null,
    hostname: hash.hostname ?? null,
    pid: hash.pid ? Number(hash.pid) : null,
    startedAt: toIso(hash.startedAt),
    updatedAt: toIso(hash.updatedAt),
    lastJobName: hash.lastJobName ?? null,
    lastJobId: hash.lastJobId ?? null,
    lastJobStatus: hash.lastJobStatus ?? null,
    lastJobAt: toIso(hash.lastJobAt),
  }
}

const adminWorkersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/workers',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Board-only: configured worker nodes and their live status',
        response: openApiResponse(AdminWorkersResponseSchema, 'AdminWorkersResponse'),
      },
    },
    async (_request, reply) => {
      const client = await getRedisClient()
      if (!client) return reply.send({ workers: [] })

      const names = await client.sMembers(KNOWN_SET_KEY)
      const workers = await Promise.all(
        names.map(async (name) => {
          const hash = await client.hGetAll(workerKey(name))
          return summaryFromHash(name, hash)
        }),
      )
      workers.sort((a, b) => a.name.localeCompare(b.name))
      return reply.send({ workers })
    },
  )

  fastify.get<{ Params: { name: string } }>(
    '/api/admin/workers/:name',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Board-only: one worker node plus its recent job history',
        response: openApiResponse(AdminWorkerDetailResponseSchema, 'AdminWorkerDetailResponse'),
      },
    },
    async (request, reply) => {
      const { name } = request.params
      const client = await getRedisClient()
      if (!client) return reply.status(404).send({ error: 'Redis unavailable' })

      const hash = await client.hGetAll(workerKey(name))
      if (Object.keys(hash).length === 0) {
        return reply.status(404).send({ error: 'Unknown worker' })
      }

      const rawHistory = await client.lRange(historyKey(name), 0, 19)
      const history: z.infer<typeof AdminWorkerJobEventSchema>[] = []
      for (const raw of rawHistory) {
        try {
          const parsed = JSON.parse(raw) as {
            jobId: string
            jobName: string
            status: 'active' | 'completed' | 'failed'
            at: number
            errorMessage?: string
          }
          history.push({
            jobId: parsed.jobId,
            jobName: parsed.jobName,
            status: parsed.status,
            at: new Date(parsed.at).toISOString(),
            ...(parsed.errorMessage !== undefined ? { errorMessage: parsed.errorMessage } : {}),
          })
        } catch {
          // skip a malformed history entry
        }
      }

      return reply.send({ worker: summaryFromHash(name, hash), history })
    },
  )
}

export default adminWorkersRoutes
