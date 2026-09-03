// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  RADIO_SUBMISSION_MAX_TRACKS,
  RadioSubmissionListSchema,
  SubmitRadioTracksSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const meRadioSubmissionRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/radio-submissions — own recent submissions
  fastify.get(
    '/api/me/radio-submissions',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(RadioSubmissionListSchema, 'RadioSubmissionList'),
      },
    },
    async (request, reply) => {
      const userId = request.sessionUser!.id
      const items = await fastify.prisma.radioTrackSubmissionItem.findMany({
        where: { batch: { submitterId: userId } },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: {
          id: true,
          status: true,
          positionInBatch: true,
          rejectionNote: true,
          reviewedAt: true,
          createdAt: true,
          batchId: true,
          batch: { select: { note: true } },
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
          rejectionNote: item.status === 'REJECTED' ? item.rejectionNote : null,
          reviewedAt: item.reviewedAt,
          createdAt: item.createdAt,
          batchId: item.batchId,
          batchNote: item.batch.note,
          sound: item.sound,
        })),
      })
    },
  )

  // POST /api/me/radio-submissions — submit up to 5 READY tracks for audit
  fastify.post(
    '/api/me/radio-submissions',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Submit up to 5 READY sound tracks for Tahti Radio board audit',
      },
    },
    async (request, reply) => {
      const parsed = SubmitRadioTracksSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }

      const userId = request.sessionUser!.id
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const ids = [...new Set(parsed.data.soundIds)]
      if (ids.length > RADIO_SUBMISSION_MAX_TRACKS) {
        return reply
          .status(400)
          .send({ error: `You can submit at most ${RADIO_SUBMISSION_MAX_TRACKS} tracks at once` })
      }

      const owned = await fastify.prisma.sound.findMany({
        where: {
          id: { in: ids },
          channelId: channel.id,
          status: 'READY',
        },
        select: { id: true, title: true },
      })
      if (owned.length !== ids.length) {
        return reply.status(400).send({
          error: 'Every track must be a READY sound item you own',
        })
      }

      const pending = await fastify.prisma.radioTrackSubmissionItem.findMany({
        where: {
          soundId: { in: ids },
          status: 'PENDING',
        },
        select: { soundId: true },
      })
      if (pending.length > 0) {
        return reply.status(409).send({
          error: 'One or more tracks are already awaiting review',
        })
      }

      const batch = await fastify.prisma.radioTrackSubmissionBatch.create({
        data: {
          submitterId: userId,
          channelId: channel.id,
          note: parsed.data.note?.trim() || null,
          items: {
            create: ids.map((soundId, positionInBatch) => ({
              soundId,
              positionInBatch,
            })),
          },
        },
        select: {
          id: true,
          items: {
            select: {
              id: true,
              status: true,
              positionInBatch: true,
              rejectionNote: true,
              createdAt: true,
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
          },
        },
      })

      return reply.status(201).send({
        batchId: batch.id,
        items: batch.items,
      })
    },
  )
}

export default meRadioSubmissionRoutes
