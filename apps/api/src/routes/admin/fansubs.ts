// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import {
  AdminFanSubArtistListSchema,
  AdminFanSubOverviewSchema,
  AdminFanSubPayoutListSchema,
  AdminFanSubPayoutRetrySchema,
  AdminFanSubPayoutStateQuerySchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'

// M21-D: fan-sub revenue overview and payout queue for board/treasurer
const adminFanSubsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/fansubs/overview',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-D: fan-sub summary metrics',
        response: openApiResponse(AdminFanSubOverviewSchema, 'AdminFanSubOverview'),
      },
    },
    async (_request, reply) => {
      const activeSubs = await fastify.prisma.fanSubscription.findMany({
        where: { state: 'ACTIVE' },
        select: { amountCents: true, artistUserId: true },
      })

      const artistIds = new Set(activeSubs.map((s) => s.artistUserId))
      const mrrCents = activeSubs.reduce((sum, s) => sum + s.amountCents, 0)

      const [pendingAgg, failedAgg] = await Promise.all([
        fastify.prisma.fanSubPayout.aggregate({
          where: { state: 'PENDING' },
          _count: true,
          _sum: { netToArtistCents: true },
        }),
        fastify.prisma.fanSubPayout.aggregate({
          where: { state: 'FAILED' },
          _count: true,
          _sum: { netToArtistCents: true },
        }),
      ])

      return reply.send({
        activeFanSubCount: activeSubs.length,
        mrrCents,
        artistsWithSubscribers: artistIds.size,
        pendingPayouts: {
          count: pendingAgg._count,
          totalNetCents: pendingAgg._sum.netToArtistCents ?? 0,
        },
        failedPayouts: {
          count: failedAgg._count,
          totalNetCents: failedAgg._sum.netToArtistCents ?? 0,
        },
      })
    },
  )

  fastify.get(
    '/api/admin/fansubs/payouts',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-D: payout queue (PENDING / FAILED)',
        response: openApiResponse(AdminFanSubPayoutListSchema, 'AdminFanSubPayoutList'),
      },
    },
    async (request, reply) => {
      const parsed = AdminFanSubPayoutStateQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const { state, page, limit } = parsed.data
      const where: Prisma.FanSubPayoutWhereInput = state
        ? { state }
        : { state: { in: ['PENDING', 'FAILED'] } }

      const [total, rows] = await Promise.all([
        fastify.prisma.fanSubPayout.count({ where }),
        fastify.prisma.fanSubPayout.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: {
            fanSubscription: {
              select: {
                artist: { select: { id: true, displayName: true, username: true } },
                subscriber: { select: { displayName: true, username: true } },
              },
            },
          },
        }),
      ])

      return reply.send({
        page,
        limit,
        total,
        payouts: rows.map((row) => ({
          id: row.id,
          state: row.state,
          artistUserId: row.artistUserId,
          artistDisplayName: row.fanSubscription.artist.displayName,
          artistUsername: row.fanSubscription.artist.username,
          subscriberDisplayName: row.fanSubscription.subscriber.displayName,
          subscriberUsername: row.fanSubscription.subscriber.username,
          netToArtistCents: row.netToArtistCents,
          grossCents: row.grossCents,
          forPeriodStart: row.forPeriodStart,
          forPeriodEnd: row.forPeriodEnd,
          stripeTransferId: row.stripeTransferId,
          paidAt: row.paidAt,
          createdAt: row.createdAt,
        })),
      })
    },
  )

  fastify.get(
    '/api/admin/fansubs/by-artist',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-D: per-artist fan-sub revenue and Connect status',
        response: openApiResponse(AdminFanSubArtistListSchema, 'AdminFanSubArtistList'),
      },
    },
    async (_request, reply) => {
      const activeSubs = await fastify.prisma.fanSubscription.findMany({
        where: { state: 'ACTIVE' },
        select: {
          artistUserId: true,
          amountCents: true,
          artist: {
            select: {
              displayName: true,
              username: true,
              stripeConnectChargesEnabled: true,
              stripeConnectAccountId: true,
            },
          },
        },
      })

      const paidByArtist = await fastify.prisma.fanSubPayout.groupBy({
        by: ['artistUserId'],
        where: { state: 'PAID' },
        _sum: { netToArtistCents: true },
      })
      const paidMap = new Map(
        paidByArtist.map((row) => [row.artistUserId, row._sum.netToArtistCents ?? 0]),
      )

      const byArtist = new Map<
        string,
        {
          artistUserId: string
          displayName: string
          username: string
          activeSubscriberCount: number
          mrrCents: number
          stripeConnectChargesEnabled: boolean
          stripeConnectAccountId: string | null
        }
      >()

      for (const sub of activeSubs) {
        const existing = byArtist.get(sub.artistUserId)
        if (existing) {
          existing.activeSubscriberCount++
          existing.mrrCents += sub.amountCents
        } else {
          byArtist.set(sub.artistUserId, {
            artistUserId: sub.artistUserId,
            displayName: sub.artist.displayName,
            username: sub.artist.username,
            activeSubscriberCount: 1,
            mrrCents: sub.amountCents,
            stripeConnectChargesEnabled: sub.artist.stripeConnectChargesEnabled,
            stripeConnectAccountId: sub.artist.stripeConnectAccountId,
          })
        }
      }

      const artists = [...byArtist.values()]
        .map((row) => ({
          ...row,
          totalPaidCents: paidMap.get(row.artistUserId) ?? 0,
        }))
        .sort((a, b) => b.mrrCents - a.mrrCents)

      return reply.send(artists)
    },
  )

  fastify.post(
    '/api/admin/fansubs/payouts/:id/retry',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-D: requeue a FAILED payout for worker processing',
        response: openApiResponses([
          { status: 200, schema: AdminFanSubPayoutRetrySchema, name: 'Ok' },
        ]),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const payout = await fastify.prisma.fanSubPayout.findUnique({ where: { id } })
      if (!payout) return reply.status(404).send({ error: 'Payout not found' })
      if (payout.state !== 'FAILED') {
        return reply.status(409).send({ error: 'Only FAILED payouts can be retried' })
      }

      await fastify.prisma.fanSubPayout.update({
        where: { id },
        data: { state: 'PENDING' },
      })

      await auditLog(fastify.prisma, {
        action: 'LEDGER_ENTRY_CREATE',
        actorId: actor.id,
        targetId: id,
        meta: { kind: 'fan_sub_payout_retry', artistUserId: payout.artistUserId },
      })

      return reply.send({ ok: true as const, payoutId: id, state: 'PENDING' })
    },
  )
}

export default adminFanSubsRoutes
