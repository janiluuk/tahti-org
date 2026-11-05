// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { randomBytes } from 'node:crypto'
import type { FastifyPluginAsync } from 'fastify'
import {
  CreateArtistGroupSchema,
  GroupRequestParamsSchema,
  PatchArtistGroupSchema,
  ResolveJoinRequestSchema,
  SlugParamSchema,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { isUniqueConstraintError } from '../../lib/prisma-errors.js'
import { availableUserWhere } from '../../lib/listed-artist.js'
import { isBlockedEitherWay } from '../../lib/user-blocks.js'
import { notifyGroupJoinRequested, notifyGroupJoinResolved } from '../../lib/group-notices.js'
import { zodError } from '../collections/helpers.js'
import {
  COLLECTION_SLUG_PREFIX,
  canManageGroup,
  groupSummary,
  groupSummaryInclude,
  groupVisibleTo,
  loadGroupForUser,
  publicUser,
  slugifyGroupName,
} from './helpers.js'

const meGroupRoutes: FastifyPluginAsync = async (fastify) => {
  async function slugTaken(slug: string): Promise<boolean> {
    const [group, collection] = await Promise.all([
      fastify.prisma.artistGroup.findUnique({ where: { slug }, select: { id: true } }),
      fastify.prisma.collection.findUnique({
        where: { slug: `${COLLECTION_SLUG_PREFIX}${slug}` },
        select: { id: true },
      }),
    ])
    return Boolean(group || collection)
  }

  fastify.post('/api/me/groups', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const parsed = CreateArtistGroupSchema.safeParse(request.body)
    if (!parsed.success) return zodError(reply, parsed.error)
    const body = parsed.data

    let slug = body.slug
    if (slug) {
      if (await slugTaken(slug)) return reply.status(409).send({ error: 'Slug already taken' })
    } else {
      const base = slugifyGroupName(body.name) || 'group'
      slug = base
      if (base.length < 2 || (await slugTaken(base))) {
        slug = `${base}-${randomBytes(3).toString('hex')}`
      }
    }

    const isPublic = body.isPublic ?? true
    const description = body.description || null
    const coverUrl = body.coverUrl || null

    try {
      const collection = await fastify.prisma.collection.create({
        data: {
          userId: user.id,
          slug: `${COLLECTION_SLUG_PREFIX}${slug}`,
          name: body.name,
          description,
          type: 'CUSTOM',
          style: 'PLAYLIST',
          collaborative: false,
          isPublic,
          visibility: isPublic ? 'PUBLIC' : 'DRAFT',
          coverUrl,
          artistGroup: {
            create: {
              slug,
              name: body.name,
              description,
              coverUrl,
              createdByUserId: user.id,
              isPublic,
              ...(body.joinPolicy ? { joinPolicy: body.joinPolicy } : {}),
              ...(body.submitPolicy ? { submitPolicy: body.submitPolicy } : {}),
              members: { create: { userId: user.id, role: 'OWNER' } },
            },
          },
        },
        select: { artistGroup: { include: groupSummaryInclude } },
      })
      return reply
        .status(201)
        .send({ ...(await groupSummary(collection.artistGroup!)), role: 'OWNER' })
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return reply.status(409).send({ error: 'Slug already taken' })
      }
      throw err
    }
  })

  fastify.get('/api/me/groups', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const memberships = await fastify.prisma.artistGroupMember.findMany({
      where: { userId: user.id },
      orderBy: { joinedAt: 'desc' },
      include: {
        group: {
          include: {
            ...groupSummaryInclude,
            _count: {
              select: {
                members: true,
                joinRequests: { where: { status: 'PENDING' } },
                submissions: { where: { status: 'PENDING' } },
              },
            },
          },
        },
      },
    })
    return reply.send(
      await Promise.all(
        memberships.map(async ({ group, role }) => {
          const manager = canManageGroup(role)
          return {
            ...(await groupSummary(group)),
            role,
            pendingJoinRequestCount: manager ? group._count.joinRequests : 0,
            pendingSubmissionCount: manager ? group._count.submissions : 0,
          }
        }),
      ),
    )
  })

  fastify.patch('/api/me/groups/:slug', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const parsed = PatchArtistGroupSchema.safeParse(request.body)
    if (!parsed.success) return zodError(reply, parsed.error)
    const body = parsed.data

    const loaded = await loadGroupForUser(fastify, routeParams.slug, user.id)
    if (!loaded || !loaded.role) return reply.status(404).send({ error: 'Group not found' })
    if (!canManageGroup(loaded.role)) {
      return reply.status(403).send({ error: 'Only group admins can edit the group' })
    }
    const { group } = loaded

    const groupData: Record<string, unknown> = {}
    const collectionData: Record<string, unknown> = {}
    if (body.name !== undefined) {
      groupData.name = body.name
      collectionData.name = body.name
    }
    if (body.description !== undefined) {
      groupData.description = body.description || null
      collectionData.description = body.description || null
    }
    if (body.coverUrl !== undefined) {
      groupData.coverUrl = body.coverUrl || null
      groupData.coverKey = null
      collectionData.coverUrl = body.coverUrl || null
      collectionData.coverKey = null
    }
    if (body.isPublic !== undefined) {
      groupData.isPublic = body.isPublic
      collectionData.isPublic = body.isPublic
      collectionData.visibility = body.isPublic ? 'PUBLIC' : 'DRAFT'
    }
    if (body.joinPolicy !== undefined) groupData.joinPolicy = body.joinPolicy
    if (body.submitPolicy !== undefined) groupData.submitPolicy = body.submitPolicy

    const updated = await fastify.prisma.$transaction(async (tx) => {
      if (Object.keys(collectionData).length > 0) {
        await tx.collection.update({ where: { id: group.collectionId }, data: collectionData })
      }
      return tx.artistGroup.update({
        where: { id: group.id },
        data: groupData,
        include: groupSummaryInclude,
      })
    })
    return reply.send({ ...(await groupSummary(updated)), role: loaded.role })
  })

  fastify.delete('/api/me/groups/:slug', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

    const loaded = await loadGroupForUser(fastify, routeParams.slug, user.id)
    if (!loaded || !loaded.role) return reply.status(404).send({ error: 'Group not found' })
    if (loaded.role !== 'OWNER') {
      return reply.status(403).send({ error: 'Only the group owner can delete the group' })
    }
    // The playlist owns the group row (cascade), so one delete takes both,
    // along with members, requests and submissions.
    await fastify.prisma.collection.delete({ where: { id: loaded.group.collectionId } })
    return reply.status(204).send()
  })

  fastify.post('/api/me/groups/:slug/join', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

    const loaded = await loadGroupForUser(fastify, routeParams.slug, user.id)
    if (!loaded || !(await groupVisibleTo(fastify, loaded, user.id))) {
      return reply.status(404).send({ error: 'Group not found' })
    }
    if (loaded.role) return reply.status(409).send({ error: 'You are already in this group' })
    const creator = await fastify.prisma.user.findFirst({
      where: { id: loaded.group.createdBy.id, ...availableUserWhere },
      select: { id: true },
    })
    if (!creator) return reply.status(404).send({ error: 'Group not found' })
    const { group } = loaded

    try {
      if (group.joinPolicy === 'OPEN') {
        await fastify.prisma.$transaction([
          fastify.prisma.artistGroupMember.create({
            data: { groupId: group.id, userId: user.id, role: 'MEMBER' },
          }),
          fastify.prisma.artistGroupJoinRequest.deleteMany({
            where: { groupId: group.id, userId: user.id },
          }),
        ])
        return reply.status(201).send({ status: 'JOINED', role: 'MEMBER' })
      }

      const alreadyPending = await fastify.prisma.artistGroupJoinRequest.findFirst({
        where: { groupId: group.id, userId: user.id, status: 'PENDING' },
        select: { id: true },
      })
      const pendingRequest = await fastify.prisma.artistGroupJoinRequest.upsert({
        where: { groupId_userId: { groupId: group.id, userId: user.id } },
        create: { groupId: group.id, userId: user.id },
        update: { status: 'PENDING', resolvedAt: null, resolvedByUserId: null },
        select: { id: true, status: true },
      })
      if (!alreadyPending) {
        await notifyGroupJoinRequested(fastify.prisma, group, user.id).catch((err: unknown) =>
          fastify.log.warn({ err }, 'group join request notice failed'),
        )
      }
      return reply.status(202).send({ status: 'REQUESTED', requestId: pendingRequest.id })
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        return reply.status(409).send({ error: 'You are already in this group' })
      }
      throw err
    }
  })

  fastify.delete(
    '/api/me/groups/:slug/members/me',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const loaded = await loadGroupForUser(fastify, routeParams.slug, user.id)
      if (!loaded) return reply.status(404).send({ error: 'Group not found' })
      const { group, role } = loaded

      if (role === 'OWNER') {
        return reply
          .status(409)
          .send({ error: 'The owner cannot leave the group. Delete the group instead.' })
      }
      if (role) {
        await fastify.prisma.artistGroupMember.delete({
          where: { groupId_userId: { groupId: group.id, userId: user.id } },
        })
        return reply.status(204).send()
      }
      const cancelled = await fastify.prisma.artistGroupJoinRequest.deleteMany({
        where: { groupId: group.id, userId: user.id, status: 'PENDING' },
      })
      if (cancelled.count === 0) return reply.status(404).send({ error: 'Group not found' })
      return reply.status(204).send()
    },
  )

  fastify.get(
    '/api/me/groups/:slug/join-requests',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const loaded = await loadGroupForUser(fastify, routeParams.slug, user.id)
      if (!loaded || !loaded.role) return reply.status(404).send({ error: 'Group not found' })
      if (!canManageGroup(loaded.role)) {
        return reply.status(403).send({ error: 'Only group admins can see join requests' })
      }

      const requests = await fastify.prisma.artistGroupJoinRequest.findMany({
        where: { groupId: loaded.group.id, status: 'PENDING', user: availableUserWhere },
        orderBy: { createdAt: 'asc' },
        take: 200,
        select: {
          id: true,
          createdAt: true,
          user: { select: { username: true, displayName: true } },
        },
      })
      return reply.send(
        requests.map((r) => ({ id: r.id, createdAt: r.createdAt, user: publicUser(r.user) })),
      )
    },
  )

  fastify.post(
    '/api/me/groups/:slug/join-requests/:requestId/resolve',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(GroupRequestParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = ResolveJoinRequestSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const loaded = await loadGroupForUser(fastify, routeParams.slug, user.id)
      if (!loaded || !loaded.role) return reply.status(404).send({ error: 'Group not found' })
      if (!canManageGroup(loaded.role)) {
        return reply.status(403).send({ error: 'Only group admins can answer join requests' })
      }
      const { group } = loaded

      const joinRequest = await fastify.prisma.artistGroupJoinRequest.findFirst({
        where: { id: routeParams.requestId, groupId: group.id },
        select: { id: true, userId: true, status: true },
      })
      if (!joinRequest) return reply.status(404).send({ error: 'Join request not found' })
      if (joinRequest.status !== 'PENDING') {
        return reply.status(409).send({ error: 'This request was already answered' })
      }

      const approve = parsed.data.action === 'APPROVE'
      if (approve && (await isBlockedEitherWay(fastify.prisma, user.id, joinRequest.userId))) {
        return reply.status(409).send({ error: 'This person cannot join the group' })
      }
      const status = approve ? ('APPROVED' as const) : ('REJECTED' as const)

      await fastify.prisma.$transaction(async (tx) => {
        await tx.artistGroupJoinRequest.update({
          where: { id: joinRequest.id },
          data: { status, resolvedAt: new Date(), resolvedByUserId: user.id },
        })
        if (approve) {
          await tx.artistGroupMember.upsert({
            where: { groupId_userId: { groupId: group.id, userId: joinRequest.userId } },
            create: { groupId: group.id, userId: joinRequest.userId, role: 'MEMBER' },
            update: {},
          })
        }
      })
      await notifyGroupJoinResolved(
        fastify.prisma,
        group,
        joinRequest.userId,
        approve,
        user.id,
      ).catch((err: unknown) => fastify.log.warn({ err }, 'group join answer notice failed'))
      return reply.send({ id: joinRequest.id, status })
    },
  )
}

export default meGroupRoutes
