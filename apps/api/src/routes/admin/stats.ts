// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminAuditRecentListSchema,
  AdminChatStatsSchema,
  AdminChatTimeseriesSchema,
  AdminCronRunHistoryResponseSchema,
  AdminCronRunListSchema,
  AdminMailStatsSchema,
  AdminMemberStatsSchema,
  AdminQueueStatsListSchema,
  AdminSystemHealthSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { getQueueStatsByJobName } from '../../lib/queue-stats.js'
import { WORKER_CRON_JOBS } from '@tahti/shared'
import { runDependencyChecks } from '../../lib/health-checks.js'
import { collectBackupMetrics } from '../../lib/backup-metrics.js'

function durationMs(startedAt: Date, finishedAt: Date | null): number | null {
  return finishedAt ? Math.max(0, finishedAt.getTime() - startedAt.getTime()) : null
}

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
                resultJson: run.resultJson,
                durationMs: durationMs(run.startedAt, run.finishedAt),
              }
            : null,
        }
      })
      return reply.send(latest)
    },
  )

  fastify.get(
    '/api/admin/stats/cron-runs/history',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Chronological cron execution log with result and duration',
        response: openApiResponse(AdminCronRunHistoryResponseSchema, 'AdminCronRunHistoryResponse'),
      },
    },
    async (request, reply) => {
      const query = request.query as { page?: string; limit?: string; jobName?: string }
      const page = Math.max(1, parseInt(query.page ?? '1', 10) || 1)
      const limit = Math.min(100, Math.max(1, parseInt(query.limit ?? '50', 10) || 50))
      const jobName = query.jobName?.trim()
      const where = jobName ? { jobName } : undefined
      const [runs, total] = await Promise.all([
        fastify.prisma.cronRun.findMany({
          where,
          orderBy: { startedAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        fastify.prisma.cronRun.count({ where }),
      ])

      return reply.send({
        page,
        limit,
        total,
        items: runs.map((run) => ({
          id: run.id.toString(),
          jobName: run.jobName,
          startedAt: run.startedAt,
          finishedAt: run.finishedAt,
          outcome: run.outcome,
          errorMessage: run.errorMessage,
          resultJson: run.resultJson,
          durationMs: durationMs(run.startedAt, run.finishedAt),
        })),
      })
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
        discordBot: byId.get('discord-bot') === 'up' ? 'up' : 'down',
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

  // Contact-inbox mail counts (hello@ / support@tahti.live) for the admin
  // dashboard KPI tiles. Read from Prometheus on vimage6 (tahti_mail_metrics
  // job fed by doveadm via mail-metrics.sh); fail-open with zeros so the
  // dashboard never breaks when Prometheus is unreachable (dev, CI, blip).
  fastify.get(
    '/api/admin/stats/mail',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Unread/total mails to hello@/support@tahti.live for the admin dashboard',
        response: openApiResponse(AdminMailStatsSchema, 'AdminMailStats'),
      },
    },
    async (_request, reply) => {
      const zeros = () => ({ unseen: 0, total: 0 })
      const snapshot: Record<'hello' | 'support', { unseen: number; total: number }> = {
        hello: zeros(),
        support: zeros(),
      }
      try {
        const [unseen, total] = await Promise.all([
          queryPromMailboxCounts('mail_inbox_unseen'),
          queryPromMailboxCounts('mail_inbox_total'),
        ])
        for (const key of ['hello', 'support'] as const) {
          snapshot[key].unseen = unseen.get(`${key}@tahti.live`) ?? 0
          snapshot[key].total = total.get(`${key}@tahti.live`) ?? 0
        }
      } catch (err) {
        fastify.log.warn({ err }, '[admin/stats/mail] prometheus unreachable, returning zeros')
      }
      return reply.send(snapshot)
    },
  )
}

async function queryPromMailboxCounts(metric: string): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  // Short timeout: CI runners blackhole the vimage6 LAN address, so a hung
  // SYN would otherwise eat the whole vitest 5s test budget (fail-open
  // must stay fast as well as safe).
  const res = await fetch(`${config.promUrl}/api/v1/query?query=${metric}`, {
    signal: AbortSignal.timeout(2500),
  })
  if (!res.ok) throw new Error(`prometheus query ${metric}: HTTP ${res.status}`)
  const body = (await res.json()) as {
    data?: { result?: Array<{ metric?: { mailbox?: string }; value?: [number, string] }> }
  }
  for (const row of body.data?.result ?? []) {
    const mailbox = row.metric?.mailbox
    const raw = row.value?.[1]
    if (!mailbox || raw == null) continue
    const n = Number.parseInt(raw, 10)
    if (Number.isFinite(n) && n >= 0) counts.set(mailbox, n)
  }
  return counts
}

export default adminStatsRoutes
