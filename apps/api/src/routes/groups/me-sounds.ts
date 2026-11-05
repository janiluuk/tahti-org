// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  GroupMembershipResponseSchema,
  GroupSubmissionParamsSchema,
  IdParamSchema,
  SlugParamSchema,
  SubmitGroupSoundSchema,
  openApiResponse,
  parseRouteParams,
  safeDisplayName,
} from '@tahti/shared'
import { notifyPlaylistOfNewTrack } from '@tahti/db'
import { notifyGroupSubmissionReceived } from '../../lib/group-notices.js'
import { requireAuth } from '../../plugins/auth.js'
import { resolveCollectionCoverUrl } from '../../lib/collection-cover.js'
import { isUniqueConstraintError } from '../../lib/prisma-errors.js'
import { isBlockedEitherWay } from '../../lib/user-blocks.js'
import {
  nextCollectionPosition,
  publicCollectionSoundWhere,
  zodError,
} from '../collections/helpers.js'
import {
  addableSoundWhere,
  canManageGroup,
  groupVisibleTo,
  loadGroupForUser,
  publicUser,
} from './helpers.js'

const meGroupSoundRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/sound/:id/group-membership — the caller's groups, flagged
  // with whether this sound is already in each group's playlist (or waiting
  // for approval there).
  fastify.get(
    '/api/me/sound/:id/group-membership',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: "The caller's groups, with whether this sound is in each group playlist",
        response: openApiResponse(GroupMembershipResponseSchema, 'GroupMembership'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const sound = await fastify.prisma.sound.findFirst({
        where: { id, OR: [{ channel: { userId: user.id } }, publicCollectionSoundWhere] },
        select: { id: true },
      })
      if (!sound) return reply.status(404).send({ error: 'Sound item not found' })

      const memberships = await fastify.prisma.artistGroupMember.findMany({
        where: { userId: user.id },
        orderBy: { joinedAt: 'desc' },
        take: 200,
        select: {
          role: true,
          group: {
            select: {
              id: true,
              slug: true,
              name: true,
              coverUrl: true,
              coverKey: true,
              isPublic: true,
              submitPolicy: true,
              collection: {
                select: {
                  slug: true,
                  items: { where: { soundId: id }, select: { id: true }, take: 1 },
                  _count: { select: { items: true } },
                },
              },
              submissions: {
                where: { soundId: id, submittedByUserId: user.id, status: 'PENDING' },
                select: { id: true },
                take: 1,
              },
            },
          },
        },
      })

      return reply.send(
        await Promise.all(
          memberships.map(async ({ role, group }) => ({
            id: group.id,
            slug: group.slug,
            name: group.name,
            coverUrl: await resolveCollectionCoverUrl(group),
            isPublic: group.isPublic,
            submitPolicy: group.submitPolicy,
            role,
            collectionSlug: group.collection.slug,
            itemCount: group.collection._count.items,
            member: group.collection.items.length > 0,
            itemId: group.collection.items[0]?.id ?? null,
            submissionPending: group.submissions.length > 0,
          })),
        ),
      )
    },
  )

  // POST /api/me/groups/:slug/sounds — a member adds a track to the group
  // playlist. OPEN groups append at once; APPROVE groups queue a submission
  // for an owner/admin (who add directly).
  fastify.post(
    '/api/me/groups/:slug/sounds',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = SubmitGroupSoundSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const { soundId, note } = parsed.data

      const loaded = await loadGroupForUser(fastify, routeParams.slug, user.id)
      if (!loaded || !(await groupVisibleTo(fastify, loaded, user.id))) {
        return reply.status(404).send({ error: 'Group not found' })
      }
      const { group, role } = loaded
      if (!role) return reply.status(403).send({ error: 'Join the group to add tracks' })
      if (
        group.createdBy.id !== user.id &&
        (await isBlockedEitherWay(fastify.prisma, group.createdBy.id, user.id))
      ) {
        return reply.status(404).send({ error: 'Group not found' })
      }

      const sound = await fastify.prisma.sound.findFirst({
        where: addableSoundWhere(user.id, soundId),
        select: { id: true, title: true, isPublic: true },
      })
      if (!sound) return reply.status(400).send({ error: 'Track not found' })

      const existing = await fastify.prisma.collectionItem.findFirst({
        where: { collectionId: group.collectionId, soundId },
        select: { id: true },
      })
      if (existing) return reply.status(409).send({ error: 'Already in this playlist' })

      const direct = group.submitPolicy === 'OPEN' || canManageGroup(role)
      try {
        if (!direct) {
          const pending = await fastify.prisma.artistGroupSoundSubmission.findUnique({
            where: { groupId_soundId: { groupId: group.id, soundId } },
            select: { status: true },
          })
          if (pending?.status === 'PENDING') {
            return reply.status(409).send({ error: 'Already submitted to this group' })
          }
          const submission = await fastify.prisma.artistGroupSoundSubmission.upsert({
            where: { groupId_soundId: { groupId: group.id, soundId } },
            create: {
              groupId: group.id,
              soundId,
              submittedByUserId: user.id,
              note: note || null,
            },
            update: {
              submittedByUserId: user.id,
              note: note || null,
              status: 'PENDING',
              resolvedAt: null,
              resolvedByUserId: null,
            },
            select: { id: true, soundId: true, status: true, note: true, createdAt: true },
          })
          await notifyGroupSubmissionReceived(fastify.prisma, group, user.id, sound.title).catch(
            (err: unknown) => fastify.log.warn({ err }, 'group submission notice failed'),
          )
          return reply.status(202).send({ status: 'PENDING', submission })
        }

        const item = await fastify.prisma.$transaction(async (tx) => {
          await tx.artistGroupSoundSubmission.updateMany({
            where: { groupId: group.id, soundId, status: 'PENDING' },
            data: { status: 'APPROVED', resolvedAt: new Date(), resolvedByUserId: user.id },
          })
          return tx.collectionItem.create({
            data: {
              collectionId: group.collectionId,
              soundId,
              position: await nextCollectionPosition(tx, group.collectionId),
              addedByUserId: user.id,
              addNote: note || null,
            },
          })
        })
        if (sound.isPublic) {
          await notifyPlaylistOfNewTrack(
            fastify.prisma,
            {
              id: group.collectionId,
              slug: group.collection.slug,
              name: group.name,
              ownerUsername: group.createdBy.username,
              ownerUserId: group.collection.userId,
            },
            {
              id: user.id,
              username: user.username,
              displayName: safeDisplayName(user.displayName, user.username),
            },
            { title: sound.title },
          ).catch((err: unknown) => fastify.log.warn({ err }, 'group-add notification failed'))
        }
        return reply.status(201).send({ status: 'ADDED', item })
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return reply
            .status(409)
            .send({ error: 'Another track was added at the same time — please retry' })
        }
        throw err
      }
    },
  )

  fastify.get(
    '/api/me/groups/:slug/submissions',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const loaded = await loadGroupForUser(fastify, routeParams.slug, user.id)
      if (!loaded || !loaded.role) return reply.status(404).send({ error: 'Group not found' })
      if (!canManageGroup(loaded.role)) {
        return reply.status(403).send({ error: 'Only group admins can see submissions' })
      }

      const submissions = await fastify.prisma.artistGroupSoundSubmission.findMany({
        where: { groupId: loaded.group.id, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        take: 200,
        select: {
          id: true,
          note: true,
          createdAt: true,
          sound: { select: { id: true, title: true } },
          submittedBy: { select: { username: true, displayName: true } },
        },
      })
      return reply.send(
        submissions.map((s) => ({
          id: s.id,
          note: s.note,
          createdAt: s.createdAt,
          sound: s.sound,
          submittedBy: publicUser(s.submittedBy),
        })),
      )
    },
  )

  async function loadPendingSubmission(slug: string, submissionId: string, userId: string) {
    const loaded = await loadGroupForUser(fastify, slug, userId)
    if (!loaded || !loaded.role)
      return { ok: false as const, status: 404, message: 'Group not found' }
    if (!canManageGroup(loaded.role)) {
      return {
        ok: false as const,
        status: 403,
        message: 'Only group admins can answer submissions',
      }
    }
    const submission = await fastify.prisma.artistGroupSoundSubmission.findFirst({
      where: { id: submissionId, groupId: loaded.group.id },
      include: {
        submittedBy: { select: { id: true, username: true, displayName: true } },
        sound: { select: { id: true, title: true, isPublic: true } },
      },
    })
    if (!submission) return { ok: false as const, status: 404, message: 'Submission not found' }
    if (submission.status !== 'PENDING') {
      return { ok: false as const, status: 409, message: 'This submission was already answered' }
    }
    return { ok: true as const, group: loaded.group, submission }
  }

  fastify.post(
    '/api/me/groups/:slug/submissions/:submissionId/approve',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(GroupSubmissionParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const found = await loadPendingSubmission(routeParams.slug, routeParams.submissionId, user.id)
      if (!found.ok) return reply.status(found.status).send({ error: found.message })
      const { group, submission } = found

      const sound = await fastify.prisma.sound.findFirst({
        where: addableSoundWhere(submission.submittedByUserId, submission.soundId),
        select: { id: true },
      })
      if (!sound) {
        return reply.status(409).send({ error: 'This track is no longer available' })
      }

      const existing = await fastify.prisma.collectionItem.findFirst({
        where: { collectionId: group.collectionId, soundId: submission.soundId },
        select: { id: true },
      })

      try {
        const item = await fastify.prisma.$transaction(async (tx) => {
          await tx.artistGroupSoundSubmission.update({
            where: { id: submission.id },
            data: { status: 'APPROVED', resolvedAt: new Date(), resolvedByUserId: user.id },
          })
          if (existing) return existing
          return tx.collectionItem.create({
            data: {
              collectionId: group.collectionId,
              soundId: submission.soundId,
              position: await nextCollectionPosition(tx, group.collectionId),
              addedByUserId: submission.submittedByUserId,
              addNote: submission.note,
            },
          })
        })
        if (!existing && submission.sound.isPublic) {
          await notifyPlaylistOfNewTrack(
            fastify.prisma,
            {
              id: group.collectionId,
              slug: group.collection.slug,
              name: group.name,
              ownerUsername: group.createdBy.username,
              ownerUserId: group.collection.userId,
            },
            {
              id: submission.submittedBy.id,
              username: submission.submittedBy.username,
              displayName: safeDisplayName(
                submission.submittedBy.displayName,
                submission.submittedBy.username,
              ),
            },
            { title: submission.sound.title },
          ).catch((err: unknown) => fastify.log.warn({ err }, 'group-add notification failed'))
        }
        return reply.send({ id: submission.id, status: 'APPROVED', itemId: item.id })
      } catch (err) {
        if (isUniqueConstraintError(err)) {
          return reply
            .status(409)
            .send({ error: 'Another track was added at the same time — please retry' })
        }
        throw err
      }
    },
  )

  fastify.post(
    '/api/me/groups/:slug/submissions/:submissionId/reject',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(GroupSubmissionParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const found = await loadPendingSubmission(routeParams.slug, routeParams.submissionId, user.id)
      if (!found.ok) return reply.status(found.status).send({ error: found.message })

      await fastify.prisma.artistGroupSoundSubmission.update({
        where: { id: found.submission.id },
        data: { status: 'REJECTED', resolvedAt: new Date(), resolvedByUserId: user.id },
      })
      return reply.send({ id: found.submission.id, status: 'REJECTED' })
    },
  )
}

export default meGroupSoundRoutes
