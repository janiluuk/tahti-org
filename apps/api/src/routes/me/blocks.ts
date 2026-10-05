// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  BlockUserSchema,
  BlockedUserListSchema,
  BlockedUserSchema,
  UsernameParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { userName } from '../../lib/safe-names.js'

const MAX_BLOCKS = 500

const meBlocksRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/blocks — the accounts the caller has blocked, newest first
  fastify.get(
    '/api/me/blocks',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['settings'],
        response: openApiResponse(BlockedUserListSchema, 'BlockedUserList'),
      },
    },
    async (request, reply) => {
      const rows = await fastify.prisma.userBlock.findMany({
        where: { blockerUserId: request.sessionUser!.id },
        orderBy: { createdAt: 'desc' },
        take: MAX_BLOCKS,
        select: {
          createdAt: true,
          blocked: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      })
      return reply.send({
        blocked: rows.map((row) => ({
          username: row.blocked.username,
          displayName: userName(row.blocked),
          avatarUrl: row.blocked.avatarUrl,
          blockedAt: row.createdAt,
        })),
      })
    },
  )

  // POST /api/me/blocks { username } — block an account. Repeating it is fine.
  fastify.post(
    '/api/me/blocks',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['settings'],
        response: openApiResponses([
          { status: 201, schema: BlockedUserSchema, name: 'BlockedUser' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = BlockUserSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const target = await fastify.prisma.user.findUnique({
        where: { username: parsed.data.username },
        select: { id: true, username: true, displayName: true, avatarUrl: true },
      })
      if (!target) return reply.status(404).send({ error: 'User not found' })
      if (target.id === user.id) {
        return reply.status(400).send({ error: 'You cannot block yourself' })
      }

      const count = await fastify.prisma.userBlock.count({ where: { blockerUserId: user.id } })
      if (count >= MAX_BLOCKS) {
        return reply.status(400).send({ error: `You can block at most ${MAX_BLOCKS} accounts` })
      }

      // Blocking also ends any follow between the two, in both directions, so
      // neither keeps getting the other's notifications.
      await fastify.prisma.artistFollow.deleteMany({
        where: {
          OR: [
            { followerUserId: user.id, artistUserId: target.id },
            { followerUserId: target.id, artistUserId: user.id },
          ],
        },
      })

      const block = await fastify.prisma.userBlock.upsert({
        where: {
          blockerUserId_blockedUserId: { blockerUserId: user.id, blockedUserId: target.id },
        },
        create: { blockerUserId: user.id, blockedUserId: target.id },
        update: {},
      })
      return reply.status(201).send({
        username: target.username,
        displayName: userName(target),
        avatarUrl: target.avatarUrl,
        blockedAt: block.createdAt,
      })
    },
  )

  // DELETE /api/me/blocks/:username — unblock
  fastify.delete(
    '/api/me/blocks/:username',
    { preHandler: requireAuth, schema: { tags: ['settings'] } },
    async (request, reply) => {
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      await fastify.prisma.userBlock.deleteMany({
        where: {
          blockerUserId: request.sessionUser!.id,
          blocked: { username: routeParams.username },
        },
      })
      return reply.status(204).send()
    },
  )
}

export default meBlocksRoutes
