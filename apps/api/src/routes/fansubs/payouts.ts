// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  FanSubPayoutsDashboardSchema,
  FanSubPayoutsSummarySchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { sendCsv } from '../../lib/csv.js'

const fanSubPayoutRoutes: FastifyPluginAsync = async (fastify) => {
  // PERF-006: slim variant for the dashboard overview, which only ever renders
  // thisMonthNetCents as a single StatCard — avoids the full dashboard payload's
  // 7 parallel queries (counts, a 10-row findMany with a join, two more aggregates).
  fastify.get(
    '/api/me/fan-sub-payouts/summary',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['fansubs'],
        description: 'PERF-006: slim this-month-net summary for the dashboard overview',
        response: openApiResponse(FanSubPayoutsSummarySchema, 'FanSubPayoutsSummary'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      const thisMonthAgg = await fastify.prisma.fanSubPayout.aggregate({
        _sum: { netToArtistCents: true },
        where: { artistUserId: user.id, state: 'PAID', paidAt: { gte: startOfMonth } },
      })
      return reply.send({ thisMonthNetCents: thisMonthAgg._sum.netToArtistCents ?? 0 })
    },
  )

  fastify.get(
    '/api/me/fan-sub-payouts',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['fansubs'],
        response: openApiResponse(FanSubPayoutsDashboardSchema, 'FanSubPayoutsDashboard'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      const now = new Date()
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
      const startOfYear = new Date(now.getFullYear(), 0, 1)

      const [pending, failed, paidRecent, recent, activeSubs, thisMonthAgg, ytdAgg] =
        await Promise.all([
          fastify.prisma.fanSubPayout.count({
            where: { artistUserId: user.id, state: 'PENDING' },
          }),
          fastify.prisma.fanSubPayout.count({
            where: { artistUserId: user.id, state: 'FAILED' },
          }),
          fastify.prisma.fanSubPayout.count({
            where: {
              artistUserId: user.id,
              state: 'PAID',
              paidAt: { gte: new Date(Date.now() - 30 * 24 * 3600 * 1000) },
            },
          }),
          fastify.prisma.fanSubPayout.findMany({
            where: { artistUserId: user.id },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: {
              id: true,
              state: true,
              grossCents: true,
              netToArtistCents: true,
              forPeriodStart: true,
              forPeriodEnd: true,
              paidAt: true,
              createdAt: true,
              fanSubscription: { select: { tierName: true } },
            },
          }),
          fastify.prisma.fanSubscription.count({
            where: { artistUserId: user.id, state: 'ACTIVE' },
          }),
          fastify.prisma.fanSubPayout.aggregate({
            _sum: { netToArtistCents: true },
            where: { artistUserId: user.id, state: 'PAID', paidAt: { gte: startOfMonth } },
          }),
          fastify.prisma.fanSubPayout.aggregate({
            _sum: { netToArtistCents: true },
            where: { artistUserId: user.id, state: 'PAID', paidAt: { gte: startOfYear } },
          }),
        ])

      return reply.send({
        pending,
        failed,
        paidLast30Days: paidRecent,
        activeSubscribers: activeSubs,
        thisMonthNetCents: thisMonthAgg._sum.netToArtistCents ?? 0,
        paidYtdNetCents: ytdAgg._sum.netToArtistCents ?? 0,
        recent: recent.map((p) => ({
          id: p.id,
          state: p.state,
          tierName: p.fanSubscription.tierName,
          grossCents: p.grossCents,
          netToArtistCents: p.netToArtistCents,
          forPeriodStart: p.forPeriodStart,
          forPeriodEnd: p.forPeriodEnd,
          paidAt: p.paidAt,
          createdAt: p.createdAt,
        })),
      })
    },
  )

  // M19: GDPR data-subject export for the artist's fan subscribers
  fastify.get(
    '/api/me/fan-subscribers/export.csv',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const subs = await fastify.prisma.fanSubscription.findMany({
        where: { artistUserId: user.id },
        orderBy: { startedAt: 'asc' },
        select: {
          tierName: true,
          amountCents: true,
          state: true,
          startedAt: true,
          currentPeriodEnd: true,
          canceledAt: true,
          subscriber: { select: { username: true, email: true } },
        },
      })

      return sendCsv(
        reply,
        'fan-subscribers.csv',
        [
          'username',
          'email',
          'tier',
          'amount_cents',
          'state',
          'started_at',
          'current_period_end',
          'canceled_at',
        ],
        subs.map((s) => [
          s.subscriber.username,
          s.subscriber.email,
          s.tierName,
          s.amountCents,
          s.state,
          s.startedAt.toISOString(),
          s.currentPeriodEnd.toISOString(),
          s.canceledAt?.toISOString() ?? '',
        ]),
      )
    },
  )
}

export default fanSubPayoutRoutes
