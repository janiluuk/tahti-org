// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminAuditRecentListSchema,
  AdminChatStatsSchema,
  AdminChatTimeseriesSchema,
  AdminCronRunListSchema,
  AdminMemberStatsSchema,
  AdminQueueStatsListSchema,
  AdminSystemHealthSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { getQueueStatsByJobName } from '../../lib/queue-stats.js'
import { WORKER_CRON_JOBS } from '@tahti/shared'
import { runDependencyChecks } from '../../lib/health-checks.js'
import { collectBackupMetrics } from '../../lib/backup-metrics.js'

const adminStatsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/stats/members',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-A: member counts for admin dashboard',
        response: openApiResponse(AdminMemberStatsSchema, 'AdminMemberStats'),
      },
    },
    async (_request, reply) => {
      const monthStart = new Date()
      monthStart.setUTCDate(1)
      monthStart.setUTCHours(0, 0, 0, 0)

      const [total, newThisMonth, lapsed] = await Promise.all([
        fastify.prisma.user.count({ where: { isMember: true } }),
        fastify.prisma.user.count({
          where: { isMember: true, memberSince: { gte: monthStart } },
        }),
        fastify.prisma.auditLog.count({
          where: { action: 'MEMBERSHIP_LAPSED', createdAt: { gte: monthStart } },
        }),
      ])

      return reply.send({ total, newThisMonth, lapsedThisMonth: lapsed })
    },
  )

  fastify.get(
    '/api/admin/stats/queues',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-A: BullMQ queue depth by job name',
        response: openApiResponse(AdminQueueStatsListSchema, 'AdminQueueStatsList'),
      },
    },
    async (_request, reply) => {
      const queues = await getQueueStatsByJobName()
      return reply.send(queues)
    },
  )

  fastify.get(
    '/api/admin/stats/cron-runs',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-A: latest cron run per registered job',
        response: openApiResponse(AdminCronRunListSchema, 'AdminCronRunList'),
      },
    },
    async (_request, reply) => {
      const latestRuns = await fastify.prisma.cronRun.findMany({
        where: { jobName: { in: WORKER_CRON_JOBS.map((spec) => spec.name) } },
        orderBy: [{ jobName: 'asc' }, { startedAt: 'desc' }],
        distinct: ['jobName'],
      })
      const latestByJobName = new Map(latestRuns.map((run) => [run.jobName, run]))

      const latest = WORKER_CRON_JOBS.map((spec) => {
        const run = latestByJobName.get(spec.name)
        return {
          jobName: spec.name,
          description: spec.description,
          pattern: spec.pattern ?? `every ${spec.everyMs}ms`,
          lastRun: run
            ? {
                id: run.id.toString(),
                startedAt: run.startedAt,
                finishedAt: run.finishedAt,
                outcome: run.outcome,
                errorMessage: run.errorMessage,
              }
            : null,
        }
      })
      return reply.send(latest)
    },
  )

  fastify.get(
    '/api/admin/stats/system-health',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-A: dependency + backup health summary for the admin dashboard',
        response: openApiResponse(AdminSystemHealthSchema, 'AdminSystemHealth'),
      },
    },
    async (_request, reply) => {
      const [checks, backup, failedPayouts] = await Promise.all([
        runDependencyChecks(fastify.prisma),
        collectBackupMetrics(),
        fastify.prisma.fanSubPayout.count({ where: { state: 'FAILED' } }),
      ])
      const byId = new Map(checks.map((c) => [c.id, c.state]))

      return reply.send({
        icecast: byId.get('icecast') === 'up' ? 'up' : 'down',
        minio: byId.get('minio') === 'up' ? 'up' : 'down',
        postgresBackupAgeHours: backup.postgresBackupAgeHours,
        failedFanSubPayouts: failedPayouts,
      })
    },
  )

  // Chat messages in the last 24h — the admin dashboard KPI tile.
  fastify.get(
    '/api/admin/stats/chat',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Chat message volume for the admin dashboard KPI tile',
        response: openApiResponse(AdminChatStatsSchema, 'AdminChatStats'),
      },
    },
    async (_request, reply) => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
      const last24h = await fastify.prisma.chatMessage.count({
        where: { createdAt: { gte: since } },
      })
      return reply.send({ last24h })
    },
  )

  // Daily chat message counts — the chart behind the KPI tile.
  fastify.get(
    '/api/admin/stats/chat-timeseries',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Daily chat message counts for the admin dashboard chat chart',
        response: openApiResponse(AdminChatTimeseriesSchema, 'AdminChatTimeseries'),
      },
    },
    async (request, reply) => {
      const rawDays = (request.query as { days?: string | number } | undefined)?.days
      const parsedDays =
        typeof rawDays === 'string'
          ? Number.parseInt(rawDays, 10)
          : typeof rawDays === 'number'
            ? rawDays
            : 30
      const days = Number.isFinite(parsedDays) ? Math.min(Math.max(parsedDays, 1), 90) : 30

      const since = new Date()
      since.setUTCHours(0, 0, 0, 0)
      since.setUTCDate(since.getUTCDate() - (days - 1))

      const messages = await fastify.prisma.chatMessage.findMany({
        where: { createdAt: { gte: since } },
        select: { createdAt: true },
      })

      const countByDate = new Map<string, number>()
      for (const { createdAt } of messages) {
        const key = createdAt.toISOString().slice(0, 10)
        countByDate.set(key, (countByDate.get(key) ?? 0) + 1)
      }

      const series = Array.from({ length: days }, (_, i) => {
        const d = new Date(since)
        d.setUTCDate(d.getUTCDate() + i)
        const key = d.toISOString().slice(0, 10)
        return { date: key, count: countByDate.get(key) ?? 0 }
      })

      return reply.send({ days, series })
    },
  )

  fastify.get(
    '/api/admin/audit/recent',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-A: recent audit log entries for admin dashboard',
        response: openApiResponse(AdminAuditRecentListSchema, 'AdminAuditRecentList'),
      },
    },
    async (request, reply) => {
      const rawLimit = (request.query as { limit?: string | number } | undefined)?.limit
      const parsed =
        typeof rawLimit === 'string'
          ? Number.parseInt(rawLimit, 10)
          : typeof rawLimit === 'number'
            ? rawLimit
            : 100
      const limit = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 500) : 100

      const rows = await fastify.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          action: true,
          actorId: true,
          targetId: true,
          createdAt: true,
          meta: true,
        },
      })
      return reply.send(
        rows.map((r) => ({
          ...r,
          id: r.id.toString(),
        })),
      )
    },
  )
}

export default adminStatsRoutes
