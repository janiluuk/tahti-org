// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  MikseriAddTrackRequestSchema,
  MikseriAddTrackResponseSchema,
  mikseriTrackEmbedUrl,
  openApiResponses,
} from '@tahti/shared'
import { restrictionErrorMessage, soundOwnerDefaults } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import { nextCollectionPosition } from '../collections/helpers.js'

const mikseriImportRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/v1/imports/mikseri/add',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        summary: 'Add a Mikseri track to a collection',
        description:
          'Stores a validated official Mikseri track embed and user-supplied metadata. No audio or Mikseri page content is fetched.',
        response: openApiResponses([
          {
            status: 201,
            schema: MikseriAddTrackResponseSchema,
            name: 'MikseriAddTrackResponse',
          },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = MikseriAddTrackRequestSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: 'Validation error',
          issues: parsed.error.issues.map((issue) => ({
            path: issue.path,
            message: issue.message,
          })),
        })
      }
      const embedUrl = mikseriTrackEmbedUrl(parsed.data.trackUrl)
      if (!embedUrl) {
        return reply.status(400).send({ error: 'Expected a Mikseri track URL, track embed, or ID' })
      }
      const user = request.sessionUser!
      const uploadBanError = await restrictionErrorMessage(fastify.prisma, user.id, 'UPLOAD')
      if (uploadBanError) return reply.status(403).send({ error: uploadBanError })

      const [channel, collection] = await Promise.all([
        fastify.prisma.channel.findUnique({
          where: { userId: user.id },
          select: { id: true },
        }),
        fastify.prisma.collection.findFirst({
          where: { id: parsed.data.collectionId, userId: user.id },
          select: { id: true },
        }),
      ])
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (!collection) return reply.status(404).send({ error: 'Collection not found' })

      const sound = await fastify.prisma.sound.create({
        data: {
          channelId: channel.id,
          title: parsed.data.title,
          artistName: parsed.data.artistName,
          genre: parsed.data.genre || null,
          source: 'URL_EMBED',
          qualityBadge: 'EMBED_ONLY',
          contentType: 'EMBED',
          embedUri: embedUrl,
          embedProvider: 'MIKSERI',
          status: 'READY',
          isPublic: true,
          ...(await soundOwnerDefaults(fastify.prisma, channel.id)),
        },
        select: { id: true },
      })
      const collectionItem = await fastify.prisma.collectionItem.create({
        data: {
          collectionId: collection.id,
          soundId: sound.id,
          addedByUserId: user.id,
          position: await nextCollectionPosition(fastify.prisma, collection.id),
        },
        select: { id: true },
      })

      return reply.status(201).send({
        soundId: sound.id,
        collectionItemId: collectionItem.id,
        embedUrl,
      })
    },
  )
}

export default mikseriImportRoutes
