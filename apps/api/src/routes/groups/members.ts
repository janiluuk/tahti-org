// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  GroupMemberParamsSchema,
  PatchGroupMemberSchema,
  SlugParamSchema,
  TransferArtistGroupSchema,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { isBlockedEitherWay } from '../../lib/user-blocks.js'
import { notifyGroupMemberRemoved } from '../../lib/group-notices.js'
import { availableUserWhere } from '../../lib/listed-artist.js'
import { zodError } from '../collections/helpers.js'
import { canManageGroup, loadGroupForUser, publicUser } from './helpers.js'

const MEMBER_LIST_LIMIT = 500
const ROLE_ORDER = { OWNER: 0, ADMIN: 1, MEMBER: 2 } as const

const groupMemberRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/groups/:slug/members — every member, owner and admins first.
  // Only members see the full list; the public page shows a short preview.
  fastify.get(
    '/api/me/groups/:slug/members',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const loaded = await loadGroupForUser(fastify, routeParams.slug, user.id)
      if (!loaded || !loaded.role) return reply.status(404).send({ error: 'Group not found' })

      const where = { groupId: loaded.group.id, user: availableUserWhere }
      const [members, total] = await Promise.all([
        fastify.prisma.artistGroupMember.findMany({
          where,
          orderBy: { joinedAt: 'asc' },
          take: MEMBER_LIST_LIMIT,
          select: {
            role: true,
            joinedAt: true,
            user: { select: { username: true, displayName: true, avatarUrl: true } },
          },
        }),
        fastify.prisma.artistGroupMember.count({ where }),
      ])
      const items = members
        .map((m) => ({
          ...publicUser(m.user),
          avatarUrl: m.user.avatarUrl,
          role: m.role,
          joinedAt: m.joinedAt,
        }))
        .sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role])
      return reply.send({ items, total })
    },
  )

  // DELETE /api/me/groups/:slug/members/:username — an admin removes a
  // member. Only the owner removes an admin; nobody removes the owner (they
  // delete the group or hand it over). Leaving yourself is .../members/me.
  fastify.delete(
    '/api/me/groups/:slug/members/:username',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(GroupMemberParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const loaded = await loadGroupForUser(fastify, routeParams.slug, user.id)
      if (!loaded || !loaded.role) return reply.status(404).send({ error: 'Group not found' })
      if (!canManageGroup(loaded.role)) {
        return reply.status(403).send({ error: 'Only group admins can remove members' })
      }

      const target = await fastify.prisma.artistGroupMember.findFirst({
        where: { groupId: loaded.group.id, user: { username: routeParams.username } },
        select: { userId: true, role: true },
      })
      if (!target) return reply.status(404).send({ error: 'Member not found' })
      if (target.userId === user.id) {
        return reply.status(409).send({ error: 'Leave the group instead of removing yourself' })
      }
      if (target.role === 'OWNER') {
        return reply.status(403).send({ error: 'The group owner cannot be removed' })
      }
      if (target.role === 'ADMIN' && loaded.role !== 'OWNER') {
        return reply.status(403).send({ error: 'Only the group owner can remove an admin' })
      }

      await fastify.prisma.artistGroupMember.delete({
        where: { groupId_userId: { groupId: loaded.group.id, userId: target.userId } },
      })
      await notifyGroupMemberRemoved(fastify.prisma, loaded.group, target.userId, user.id).catch(
        (err: unknown) => fastify.log.warn({ err }, 'group removal notice failed'),
      )
      return reply.status(204).send()
    },
  )

  // PATCH /api/me/groups/:slug/members/:username — the owner makes a member
  // an admin, or an admin a member again.
  fastify.patch(
    '/api/me/groups/:slug/members/:username',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(GroupMemberParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchGroupMemberSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const loaded = await loadGroupForUser(fastify, routeParams.slug, user.id)
      if (!loaded || !loaded.role) return reply.status(404).send({ error: 'Group not found' })
      if (loaded.role !== 'OWNER') {
        return reply.status(403).send({ error: 'Only the group owner can change roles' })
      }

      const target = await fastify.prisma.artistGroupMember.findFirst({
        where: {
          groupId: loaded.group.id,
          user: { username: routeParams.username, ...availableUserWhere },
        },
        select: { userId: true, role: true, joinedAt: true },
      })
      if (!target) return reply.status(404).send({ error: 'Member not found' })
      if (target.role === 'OWNER') {
        return reply.status(409).send({ error: 'Hand the group over to change your own role' })
      }

      const updated = await fastify.prisma.artistGroupMember.update({
        where: { groupId_userId: { groupId: loaded.group.id, userId: target.userId } },
        data: { role: parsed.data.role },
        select: {
          role: true,
          joinedAt: true,
          user: { select: { username: true, displayName: true, avatarUrl: true } },
        },
      })
      return reply.send({
        ...publicUser(updated.user),
        avatarUrl: updated.user.avatarUrl,
        role: updated.role,
        joinedAt: updated.joinedAt,
      })
    },
  )

  // POST /api/me/groups/:slug/transfer — the owner hands the group to another
  // member, who becomes OWNER while the old owner stays on as ADMIN. The
  // group playlist and the group's founder link move too, so the group
  // survives the old owner deleting their account.
  fastify.post(
    '/api/me/groups/:slug/transfer',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = TransferArtistGroupSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const loaded = await loadGroupForUser(fastify, routeParams.slug, user.id)
      if (!loaded || !loaded.role) return reply.status(404).send({ error: 'Group not found' })
      if (loaded.role !== 'OWNER') {
        return reply.status(403).send({ error: 'Only the group owner can hand the group over' })
      }
      const { group } = loaded

      const target = await fastify.prisma.artistGroupMember.findFirst({
        where: {
          groupId: group.id,
          user: { username: parsed.data.username, ...availableUserWhere },
        },
        select: { userId: true },
      })
      if (!target) return reply.status(404).send({ error: 'Member not found' })
      if (target.userId === user.id) {
        return reply.status(409).send({ error: 'You already own this group' })
      }
      if (await isBlockedEitherWay(fastify.prisma, user.id, target.userId)) {
        return reply.status(409).send({ error: 'This person cannot take over the group' })
      }

      await fastify.prisma.$transaction([
        fastify.prisma.artistGroupMember.update({
          where: { groupId_userId: { groupId: group.id, userId: user.id } },
          data: { role: 'ADMIN' },
        }),
        fastify.prisma.artistGroupMember.update({
          where: { groupId_userId: { groupId: group.id, userId: target.userId } },
          data: { role: 'OWNER' },
        }),
        fastify.prisma.artistGroup.update({
          where: { id: group.id },
          data: { createdByUserId: target.userId },
        }),
        fastify.prisma.collection.update({
          where: { id: group.collectionId },
          data: { userId: target.userId },
        }),
      ])
      return reply.send({ slug: group.slug, owner: parsed.data.username, role: 'ADMIN' })
    },
  )
}

export default groupMemberRoutes
