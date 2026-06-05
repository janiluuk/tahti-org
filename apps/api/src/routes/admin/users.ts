// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import { computeEngagementUnits } from '@tahti/ledger'
import {
  AdminUserDetailSchema,
  AdminUserListQuerySchema,
  AdminUserListResponseSchema,
  AdminUserPatchSchema,
  AdminUserSuspendSchema,
  CsvExportBodySchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { sendCsv } from '../../lib/csv.js'

async function fetchUserDetail(prisma: Parameters<typeof computeEngagementUnits>[0], id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      username: true,
      displayName: true,
      tier: true,
      isMember: true,
      isBoard: true,
      memberNumber: true,
      memberSince: true,
      suspendedAt: true,
      suspendReason: true,
      stripeConnectChargesEnabled: true,
      channel: {
        select: {
          id: true,
          slug: true,
          state: true,
          goneLiveAt: true,
          totalLiveHours: true,
          metaStreamOptOut: true,
        },
      },
      _count: { select: { fanSubsAsArtist: { where: { state: 'ACTIVE' } } } },
    },
  })
  if (!user) return null

  const year = new Date().getUTCFullYear()
  const unitsMap = await engagementUnitsMap(prisma, year)

  return {
    ...user,
    engagementUnitsYtd: unitsMap.get(user.id) ?? 0,
    fanSubscriptionsAsArtist: user._count.fanSubsAsArtist,
  }
}

async function engagementUnitsMap(
  prisma: Parameters<typeof computeEngagementUnits>[0],
  year: number,
): Promise<Map<string, number>> {
  const rows = await computeEngagementUnits(prisma, year)
  return new Map(rows.map((r) => [r.userId, r.units]))
}

function buildUserWhere(query: {
  tier?: 'FREE' | 'ARTIST' | 'STUDIO'
  isMember?: boolean
  isBoard?: boolean
  channelState?: 'LIVE' | 'OFFLINE'
  search?: string
}): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = {}
  if (query.tier) where.tier = query.tier
  if (query.isMember !== undefined) where.isMember = query.isMember
  if (query.isBoard !== undefined) where.isBoard = query.isBoard
  if (query.channelState) {
    where.channel = { state: query.channelState }
  }
  if (query.search) {
    const q = query.search
    where.OR = [
      { displayName: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { username: { contains: q, mode: 'insensitive' } },
    ]
  }
  return where
}

const adminUsersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/users',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M21-B: paginated user directory',
        response: openApiResponse(AdminUserListResponseSchema, 'AdminUserList'),
      },
    },
    async (request, reply) => {
      const parsed = AdminUserListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const { page, limit, sort, order, ...filters } = parsed.data
      const where = buildUserWhere(filters)
      const year = new Date().getUTCFullYear()
      const unitsMap = await engagementUnitsMap(fastify.prisma, year)

      const orderBy: Prisma.UserOrderByWithRelationInput =
        sort === 'displayName'
          ? { displayName: order }
          : sort === 'createdAt'
            ? { createdAt: order }
            : { memberNumber: order }

      const [total, users] = await Promise.all([
        fastify.prisma.user.count({ where }),
        fastify.prisma.user.findMany({
          where,
          orderBy,
          skip: (page - 1) * limit,
          take: limit,
          select: {
            id: true,
            memberNumber: true,
            displayName: true,
            email: true,
            username: true,
            tier: true,
            isMember: true,
            isBoard: true,
            suspendedAt: true,
            memberSince: true,
            channel: { select: { state: true } },
          },
        }),
      ])

      return reply.send({
        page,
        limit,
        total,
        users: users.map((u) => ({
          id: u.id,
          memberNumber: u.memberNumber,
          displayName: u.displayName,
          email: u.email,
          username: u.username,
          tier: u.tier,
          isMember: u.isMember,
          isBoard: u.isBoard,
          suspendedAt: u.suspendedAt,
          channelState: u.channel?.state ?? null,
          memberSince: u.memberSince,
          engagementUnitsYtd: unitsMap.get(u.id) ?? 0,
        })),
      })
    },
  )

  fastify.get(
    '/api/admin/users/export.csv',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(CsvExportBodySchema, 'CsvExportBody'),
      },
    },
    async (request, reply) => {
      const parsed = AdminUserListQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const { sort, order, ...filters } = parsed.data
      const where = buildUserWhere(filters)
      const year = new Date().getUTCFullYear()
      const unitsMap = await engagementUnitsMap(fastify.prisma, year)

      const orderBy: Prisma.UserOrderByWithRelationInput =
        sort === 'displayName'
          ? { displayName: order }
          : sort === 'createdAt'
            ? { createdAt: order }
            : { memberNumber: order }

      const users = await fastify.prisma.user.findMany({
        where,
        orderBy,
        take: 10_000,
        select: {
          memberNumber: true,
          displayName: true,
          email: true,
          username: true,
          tier: true,
          isMember: true,
          isBoard: true,
          suspendedAt: true,
          memberSince: true,
          channel: { select: { state: true } },
          id: true,
        },
      })

      const date = new Date().toISOString().slice(0, 10)
      return sendCsv(
        reply,
        `tahti-users-${date}.csv`,
        [
          'memberNumber',
          'displayName',
          'email',
          'username',
          'tier',
          'isMember',
          'isBoard',
          'channelState',
          'memberSince',
          'engagementUnitsYtd',
          'suspendedAt',
        ],
        users.map((u) => [
          u.memberNumber ?? '',
          u.displayName,
          u.email,
          u.username,
          u.tier,
          u.isMember ? 'yes' : 'no',
          u.isBoard ? 'yes' : 'no',
          u.channel?.state ?? '',
          u.memberSince?.toISOString() ?? '',
          unitsMap.get(u.id) ?? 0,
          u.suspendedAt?.toISOString() ?? '',
        ]),
      )
    },
  )

  fastify.get(
    '/api/admin/users/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminUserDetailSchema, 'AdminUserDetail'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const detail = await fetchUserDetail(fastify.prisma, id)
      if (!detail) return reply.status(404).send({ error: 'User not found' })
      return reply.send(detail)
    },
  )

  fastify.patch(
    '/api/admin/users/:id',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminUserDetailSchema, 'AdminUserDetail'),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const parsed = AdminUserPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid body',
        })
      }

      const existing = await fastify.prisma.user.findUnique({
        where: { id },
        select: { isBoard: true },
      })
      if (!existing) return reply.status(404).send({ error: 'User not found' })

      const data = parsed.data
      if (data.isBoard !== undefined && data.isBoard !== existing.isBoard) {
        await auditLog(fastify.prisma, {
          action: 'BOARD_ROLE_CHANGE',
          actorId: actor.id,
          targetId: id,
          meta: { isBoard: data.isBoard },
        })
      }

      await fastify.prisma.user.update({ where: { id }, data })

      const detail = await fetchUserDetail(fastify.prisma, id)
      return reply.send(detail)
    },
  )

  fastify.post(
    '/api/admin/users/:id/suspend',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponses([{ status: 200, schema: AdminUserDetailSchema, name: 'Ok' }]),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      if (id === actor.id) {
        return reply.status(400).send({ error: 'Cannot suspend your own account' })
      }

      const parsed = AdminUserSuspendSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid body',
        })
      }

      const user = await fastify.prisma.user.findUnique({ where: { id }, select: { id: true } })
      if (!user) return reply.status(404).send({ error: 'User not found' })

      await fastify.prisma.user.update({
        where: { id },
        data: { suspendedAt: new Date(), suspendReason: parsed.data.reason },
      })

      await auditLog(fastify.prisma, {
        action: 'USER_SUSPEND',
        actorId: actor.id,
        targetId: id,
        meta: { reason: parsed.data.reason },
      })

      const detail = await fetchUserDetail(fastify.prisma, id)
      return reply.send(detail)
    },
  )

  fastify.post(
    '/api/admin/users/:id/unsuspend',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminUserDetailSchema, 'AdminUserDetail'),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const user = await fastify.prisma.user.findUnique({ where: { id }, select: { id: true } })
      if (!user) return reply.status(404).send({ error: 'User not found' })

      await fastify.prisma.user.update({
        where: { id },
        data: { suspendedAt: null, suspendReason: null },
      })

      await auditLog(fastify.prisma, {
        action: 'USER_UNSUSPEND',
        actorId: actor.id,
        targetId: id,
      })

      const detail = await fetchUserDetail(fastify.prisma, id)
      return reply.send(detail)
    },
  )
}

export default adminUsersRoutes
