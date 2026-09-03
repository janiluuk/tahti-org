// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  RADIO_SUBMISSION_STATUSES,
  RejectRadioSubmissionSchema,
  RadioSubmissionListSchema,
  TAHTI_RADIO_SLUG,
  soundPlaybackKey,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { notifyArtistOfRadioSubmissionRejected } from '@tahti/db'
import { requireBoard } from '../../plugins/auth.js'
import { presignedGetUrl } from '../../lib/minio.js'

const adminRadioSubmissionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/radio-submissions?status=PENDING
  fastify.get(
    '/api/admin/radio-submissions',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(RadioSubmissionListSchema, 'AdminRadioSubmissionList'),
      },
    },
    async (request, reply) => {
      const q = request.query as { status?: string }
      const status =
        q.status && (RADIO_SUBMISSION_STATUSES as readonly string[]).includes(q.status)
          ? (q.status as (typeof RADIO_SUBMISSION_STATUSES)[number])
          : 'PENDING'

      const items = await fastify.prisma.radioTrackSubmissionItem.findMany({
        where: { status },
        orderBy: { createdAt: 'asc' },
        take: 100,
        select: {
          id: true,
          status: true,
          positionInBatch: true,
          rejectionNote: true,
          reviewedAt: true,
          createdAt: true,
          batchId: true,
          batch: {
            select: {
              note: true,
              submitter: { select: { id: true, username: true, displayName: true } },
            },
          },
          sound: {
            select: {
              id: true,
              title: true,
              artistName: true,
              durationSec: true,
              bannerUrl: true,
            },
          },
        },
      })

      return reply.send({
        items: items.map((item) => ({
          id: item.id,
          status: item.status,
          positionInBatch: item.positionInBatch,
          rejectionNote: item.rejectionNote,
          reviewedAt: item.reviewedAt,
          createdAt: item.createdAt,
          batchId: item.batchId,
          batchNote: item.batch.note,
          submitter: item.batch.submitter,
          sound: item.sound,
        })),
      })
    },
  )

  // GET /api/admin/radio-submissions/:id/audio — presigned play URL for the big auditor
  fastify.get(
    '/api/admin/radio-submissions/:id/audio',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const item = await fastify.prisma.radioTrackSubmissionItem.findUnique({
        where: { id: routeParams.id },
        select: {
          sound: {
            select: { id: true, title: true, artistName: true, mp3Key: true, flacKey: true },
          },
          batch: {
            select: {
              submitter: { select: { displayName: true, username: true } },
            },
          },
        },
      })
      if (!item) return reply.status(404).send({ error: 'Submission not found' })

      const key = soundPlaybackKey(item.sound)
      if (!key) return reply.status(404).send({ error: 'No playable audio' })
      const audioUrl = await presignedGetUrl(key, 3600)
      return reply.send({
        audioUrl,
        title: item.sound.title,
        artistName:
          item.sound.artistName ??
          item.batch.submitter.displayName ??
          item.batch.submitter.username,
        soundId: item.sound.id,
      })
    },
  )

  // POST /api/admin/radio-submissions/:id/approve — add to Tahti Radio curated rotation
  fastify.post(
    '/api/admin/radio-submissions/:id/approve',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const submission = await fastify.prisma.radioTrackSubmissionItem.findUnique({
        where: { id: routeParams.id },
        select: { id: true, status: true, soundId: true },
      })
      if (!submission) return reply.status(404).send({ error: 'Submission not found' })
      if (submission.status !== 'PENDING') {
        return reply.status(409).send({ error: 'Submission already reviewed' })
      }

      const radio = await fastify.prisma.channel.findUnique({
        where: { slug: TAHTI_RADIO_SLUG },
        select: { id: true },
      })
      if (!radio) return reply.status(404).send({ error: 'Tahti Radio channel not found' })

      const sound = await fastify.prisma.sound.findUnique({
        where: { id: submission.soundId },
        select: { id: true, isPublic: true, status: true },
      })
      if (!sound || sound.status !== 'READY') {
        return reply.status(400).send({ error: 'Track is not ready to add' })
      }

      const existing = await fastify.prisma.curatedRotationItem.findUnique({
        where: {
          channelId_soundId: {
            channelId: radio.id,
            soundId: submission.soundId,
          },
        },
      })
      if (!existing) {
        const last = await fastify.prisma.curatedRotationItem.findFirst({
          where: { channelId: radio.id },
          orderBy: { position: 'desc' },
          select: { position: true },
        })
        await fastify.prisma.curatedRotationItem.create({
          data: {
            channelId: radio.id,
            soundId: submission.soundId,
            position: (last?.position ?? -1) + 1,
            addedById: request.sessionUser!.id,
          },
        })
      }

      if (!sound.isPublic) {
        await fastify.prisma.sound.update({
          where: { id: sound.id },
          data: { isPublic: true },
        })
      }

      await fastify.prisma.radioTrackSubmissionItem.update({
        where: { id: submission.id },
        data: {
          status: 'APPROVED',
          reviewedById: request.sessionUser!.id,
          reviewedAt: new Date(),
          rejectionNote: null,
        },
      })

      return reply.send({ ok: true as const })
    },
  )

  // POST /api/admin/radio-submissions/:id/reject — remove from rotation; notify only with note
  fastify.post(
    '/api/admin/radio-submissions/:id/reject',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const parsed = RejectRadioSubmissionSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }

      const submission = await fastify.prisma.radioTrackSubmissionItem.findUnique({
        where: { id: routeParams.id },
        select: {
          id: true,
          status: true,
          soundId: true,
          sound: { select: { title: true } },
          batch: { select: { submitterId: true } },
        },
      })
      if (!submission) return reply.status(404).send({ error: 'Submission not found' })
      if (submission.status === 'REJECTED') {
        return reply.status(409).send({ error: 'Already rejected' })
      }

      const radio = await fastify.prisma.channel.findUnique({
        where: { slug: TAHTI_RADIO_SLUG },
        select: { id: true },
      })
      if (radio) {
        await fastify.prisma.curatedRotationItem.deleteMany({
          where: {
            channelId: radio.id,
            soundId: submission.soundId,
          },
        })
      }

      const rejectionNote = parsed.data.rejectionNote?.trim() || null
      await fastify.prisma.radioTrackSubmissionItem.update({
        where: { id: submission.id },
        data: {
          status: 'REJECTED',
          rejectionNote,
          reviewedById: request.sessionUser!.id,
          reviewedAt: new Date(),
        },
      })

      if (rejectionNote) {
        await notifyArtistOfRadioSubmissionRejected(
          fastify.prisma,
          submission.batch.submitterId,
          submission.sound.title,
          rejectionNote,
        )
      }

      return reply.send({ ok: true as const, notified: Boolean(rejectionNote) })
    },
  )
}

export default adminRadioSubmissionRoutes
