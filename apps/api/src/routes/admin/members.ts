// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { PrismaClient } from '@tahti/db'
import {
  AdminMemberRegisterListSchema,
  CsvExportBodySchema,
  LegacySubscriptionMemberListSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { sendCsv } from '../../lib/csv.js'
import { stripeEnabled } from '../../lib/stripe.js'

const memberRegisterSelect = {
  memberNumber: true,
  displayName: true,
  email: true,
  username: true,
  memberSince: true,
  membership: { select: { status: true } },
} as const

async function fetchMemberRegister(prisma: PrismaClient) {
  // No real pagination here — Finnish Associations Act compliance requires this
  // register to be complete, not a truncated page. `take` is just a safety cap
  // against a pathological unbounded query, matching admin/users.ts and
  // admin/audit.ts's same generous-cap pattern.
  const members = await prisma.user.findMany({
    where: { isMember: true },
    orderBy: [{ memberNumber: 'asc' }],
    select: memberRegisterSelect,
    take: 50_000,
  })

  return members.map((m) => ({
    memberNumber: m.memberNumber,
    displayName: m.displayName,
    email: m.email,
    username: m.username,
    memberSince: m.memberSince,
    membershipStatus: m.membership?.status ?? null,
  }))
}

// PRH-compliant member register (board/treasurer).
const adminMembersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/members',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M10: member register preview for board (includes email)',
        response: openApiResponse(AdminMemberRegisterListSchema, 'AdminMemberRegisterList'),
      },
    },
    async (_request, reply) => {
      return reply.send(await fetchMemberRegister(fastify.prisma))
    },
  )

  fastify.get(
    '/api/admin/members/export.csv',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(CsvExportBodySchema, 'CsvExportBody'),
      },
    },
    async (_request, reply) => {
      const members = await fetchMemberRegister(fastify.prisma)

      return sendCsv(
        reply,
        'tahti-members.csv',
        ['memberNumber', 'displayName', 'email', 'username', 'memberSince', 'membershipStatus'],
        members.map((m) => [
          m.memberNumber ?? '',
          m.displayName,
          m.email,
          m.username,
          m.memberSince?.toISOString() ?? '',
          m.membershipStatus ?? '',
        ]),
      )
    },
  )

  fastify.get(
    '/api/admin/members/legacy-subscriptions',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'M1: members without Stripe subscription (migration queue)',
        response: openApiResponse(
          LegacySubscriptionMemberListSchema,
          'LegacySubscriptionMemberList',
        ),
      },
    },
    async (_request, reply) => {
      if (!stripeEnabled) {
        return reply.send([])
      }
      const rows = await fastify.prisma.user.findMany({
        where: {
          isMember: true,
          stripeMembershipSubscriptionId: null,
          deletedAt: null,
        },
        orderBy: [{ memberNumber: 'asc' }],
        select: {
          id: true,
          memberNumber: true,
          displayName: true,
          email: true,
          username: true,
          memberSince: true,
        },
      })
      return reply.send(rows)
    },
  )
}

export default adminMembersRoutes
