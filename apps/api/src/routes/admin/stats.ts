// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminAuditRecentListSchema,
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
      const latest = await Promise.all(
        WORKER_CRON_JOBS.map(async (spec) => {
          const run = await fastify.prisma.cronRun.findFirst({
            where: { jobName: spec.name },
            orderBy: { startedAt: 'desc' },
          })
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
        }),
      )
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
    async (_request, reply) => {
      const rows = await fastify.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          action: true,
          actorId: true,
          targetId: true,
          createdAt: true,
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
