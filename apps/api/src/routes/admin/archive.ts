// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ArchiveItemListSchema,
  ArchiveItemViewSchema,
  ChannelArchiveParamsSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import {
  archiveItemMetadataSelect,
  metadataPatchFromBody,
  serializeArchiveItem,
} from '../../lib/archive-metadata.js'
import { normalizeTracklist, recordTracklistMentions } from '../../lib/tracklist.js'
import { auditLog } from '../../lib/audit.js'
import type { TracklistEntry } from '@tahti/shared'

// Board access to any artist's archive/track metadata — mirrors /api/me/archive's
// list + patch endpoints exactly, scoped by :slug (requireBoard) instead of the
// session user. Same pattern as /api/admin/channels/:slug/programme.
const adminArchiveRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/channels/:slug/archive',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: "Board access to any channel's archive items, for moderation edits",
        response: openApiResponse(ArchiveItemListSchema, 'ArchiveItemList'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const items = await fastify.prisma.archiveItem.findMany({
        where: { channelId: channel.id },
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: archiveItemMetadataSelect,
      })
      return reply.send(items.map((i) => serializeArchiveItem(i)))
    },
  )

  fastify.patch(
    '/api/admin/channels/:slug/archive/:itemId',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: "Board access: patch archive item metadata for any channel's track",
        response: openApiResponse(ArchiveItemViewSchema, 'ArchiveItem'),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const routeParams = parseRouteParams(ChannelArchiveParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug, itemId } = routeParams

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id: itemId, channel: { slug } },
        select: { id: true, channelId: true, title: true },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const patch = metadataPatchFromBody(request.body)
      if (!patch.ok) return reply.status(400).send({ error: patch.error })

      if (patch.title !== undefined) {
        const t = patch.title.trim()
        if (!t) return reply.status(400).send({ error: 'title cannot be empty' })
        patch.data.title = t.slice(0, 200)
      }

      if (patch.data.tracklist !== undefined && patch.data.tracklist !== null) {
        try {
          patch.data.tracklist = await normalizeTracklist(
            fastify.prisma,
            patch.data.tracklist as TracklistEntry[],
          )
        } catch (err) {
          return reply
            .status(400)
            .send({ error: err instanceof Error ? err.message : 'Invalid tracklist' })
        }
      }

      const updated = await fastify.prisma.archiveItem.update({
        where: { id: itemId },
        data: patch.data,
        select: archiveItemMetadataSelect,
      })

      if (patch.data.tracklist !== undefined && Array.isArray(updated.tracklist)) {
        try {
          await recordTracklistMentions(
            fastify.prisma,
            actor.id,
            updated.tracklist as TracklistEntry[],
            itemId,
          )
        } catch (e) {
          fastify.log.warn(e, 'tracklist mention record failed')
        }
      }

      await auditLog(fastify.prisma, {
        action: 'ARCHIVE_METADATA_ADMIN_EDIT',
        actorId: actor.id,
        targetId: itemId,
        meta: { slug, previousTitle: item.title, fields: Object.keys(patch.data) },
      })

      return reply.send(serializeArchiveItem(updated))
    },
  )
}

export default adminArchiveRoutes
