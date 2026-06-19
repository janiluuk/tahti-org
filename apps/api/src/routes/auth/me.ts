// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { AuthMeResponseSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { computeUserStorageUsedBytes } from '../../lib/user-storage.js'

const meRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/auth/me',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['auth'],
        response: openApiResponse(AuthMeResponseSchema, 'AuthMe'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      const membership = await fastify.prisma.membership.findUnique({
        where: { userId: user.id },
        select: { status: true, activatedAt: true },
      })

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { slug: true, state: true },
      })

      const storageInfo = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { softTargetBytes: true },
      })

      const usedBytes = await computeUserStorageUsedBytes(fastify.prisma, user.id)
      const showSoftTarget = !user.isMember && user.tier === 'FREE'

      return reply.send({
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        tier: user.tier,
        emailVerifiedAt: user.emailVerifiedAt,
        isMember: user.isMember,
        isBoard: user.isBoard,
        membership,
        channel,
        storage: {
          usedBytes: usedBytes.toString(),
          ...(showSoftTarget
            ? {
                softTargetBytes: (storageInfo?.softTargetBytes ?? 524_288_000n).toString(),
              }
            : {}),
          showSoftTarget,
        },
      })
    },
  )
}

export default meRoute
