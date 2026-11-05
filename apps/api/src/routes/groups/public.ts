// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { PublicGroupListQuerySchema, SlugParamSchema, parseRouteParams } from '@tahti/shared'
import { availableUserWhere } from '../../lib/listed-artist.js'
import { isBlockedEitherWay } from '../../lib/user-blocks.js'
import { zodError } from '../collections/helpers.js'
import { groupSummary, groupSummaryInclude, publicUser } from './helpers.js'

const DEFAULT_LIMIT = 20
const MEMBER_PREVIEW = 12

const publicGroupRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/v1/groups', async (request, reply) => {
    const parsed = PublicGroupListQuerySchema.safeParse(request.query)
    if (!parsed.success) return zodError(reply, parsed.error)
    const { q, limit = DEFAULT_LIMIT, offset = 0 } = parsed.data

    const viewerId = request.sessionUser?.id
    // A block either way between the viewer and a group's founder hides the
    // group, as joining it already does.
    const where = {
      isPublic: true,
      createdBy: viewerId
        ? {
            ...availableUserWhere,
            blocksMade: { none: { blockedUserId: viewerId } },
            blocksReceived: { none: { blockerUserId: viewerId } },
          }
        : availableUserWhere,
      ...(q ? { name: { contains: q, mode: 'insensitive' as const } } : {}),
    }
    const [groups, total] = await Promise.all([
      fastify.prisma.artistGroup.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: offset,
        take: limit,
        include: groupSummaryInclude,
      }),
      fastify.prisma.artistGroup.count({ where }),
    ])
    return reply.send({ items: await Promise.all(groups.map(groupSummary)), total })
  })

  fastify.get('/api/v1/groups/:slug', async (request, reply) => {
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const viewer = request.sessionUser

    const group = await fastify.prisma.artistGroup.findUnique({
      where: { slug: routeParams.slug },
      include: {
        ...groupSummaryInclude,
        createdBy: {
          select: {
            id: true,
            username: true,
            displayName: true,
            deletedAt: true,
            suspendedAt: true,
          },
        },
        members: {
          orderBy: { joinedAt: 'asc' },
          take: MEMBER_PREVIEW,
          where: { user: availableUserWhere },
          select: { role: true, user: { select: { username: true, displayName: true } } },
        },
      },
    })
    if (!group || group.createdBy.deletedAt || group.createdBy.suspendedAt) {
      return reply.status(404).send({ error: 'Group not found' })
    }

    const viewerMembership = viewer
      ? await fastify.prisma.artistGroupMember.findUnique({
          where: { groupId_userId: { groupId: group.id, userId: viewer.id } },
          select: { role: true },
        })
      : null
    if (!group.isPublic && !viewerMembership) {
      return reply.status(404).send({ error: 'Group not found' })
    }
    if (
      viewer &&
      !viewerMembership &&
      (await isBlockedEitherWay(fastify.prisma, group.createdBy.id, viewer.id))
    ) {
      return reply.status(404).send({ error: 'Group not found' })
    }
    const joinRequestPending =
      viewer && !viewerMembership
        ? Boolean(
            await fastify.prisma.artistGroupJoinRequest.findFirst({
              where: { groupId: group.id, userId: viewer.id, status: 'PENDING' },
              select: { id: true },
            }),
          )
        : false

    return reply.send({
      ...(await groupSummary(group)),
      createdBy: publicUser(group.createdBy),
      members: group.members.map((m) => ({ ...publicUser(m.user), role: m.role })),
      viewer: { role: viewerMembership?.role ?? null, joinRequestPending },
    })
  })
}

export default publicGroupRoutes
