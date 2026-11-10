// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  SoundListQuerySchema,
  SoundListResponseSchema,
  SoundViewSchema,
  ChannelSoundParamsSchema,
  SlugParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { notifyArtistOfBoardTrackEdit } from '@tahti/db'
import { requireBoard } from '../../plugins/auth.js'
import {
  soundMetadataSelect,
  metadataPatchFromBody,
  serializeSound,
} from '../../lib/sound-metadata.js'
import { pageLimit, soundListWhere } from '../../lib/sound-list-query.js'
import { SOUND_LIST_ORDER_BY } from '../me/sound-helpers.js'
import { UNKNOWN_VENUE_BODY, canAttachVenue } from '../../lib/sound-venue.js'
import { normalizeTracklist, recordTracklistMentions } from '../../lib/tracklist.js'
import { auditLog } from '../../lib/audit.js'
import type { TracklistEntry } from '@tahti/shared'

// Board access to any artist's sound/track metadata — mirrors /api/me/sound's
// list + patch endpoints exactly, scoped by :slug (requireBoard) instead of the
// session user. Same pattern as /api/admin/channels/:slug/programme.
function comparable(value: unknown): string {
  return value === null || value === undefined || value === '' ? '' : JSON.stringify(value)
}

function changedFields(
  before: Record<string, unknown> | null,
  after: Record<string, unknown>,
  fields: string[],
): string[] {
  return fields.filter(
    (field) =>
      !before || !(field in after) || comparable(before[field]) !== comparable(after[field]),
  )
}

const adminSoundRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/channels/:slug/sound',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description:
          "Board access to any channel's sound items. With `limit`, returns `{ items, total }` using the same filters as `/api/me/sound`; bare GET keeps the legacy array (capped at 200).",
        response: openApiResponse(SoundListResponseSchema, 'SoundListResponse'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const parsedQuery = SoundListQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: parsedQuery.error.issues[0]?.message ?? 'Invalid query',
        })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: routeParams.slug },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const { sort, limit, offset, ...filter } = parsedQuery.data
      const where = soundListWhere(channel.id, filter)
      const orderBy = SOUND_LIST_ORDER_BY[sort ?? 'newest'] ?? SOUND_LIST_ORDER_BY.newest

      if (limit == null) {
        const items = await fastify.prisma.sound.findMany({
          where,
          orderBy,
          take: 200,
          select: soundMetadataSelect,
        })
        return reply.send(items.map((i) => serializeSound(i)))
      }

      const take = pageLimit(limit)
      const skip = offset ?? 0
      const [total, rows] = await Promise.all([
        fastify.prisma.sound.count({ where }),
        fastify.prisma.sound.findMany({
          where,
          orderBy,
          take,
          skip,
          select: soundMetadataSelect,
        }),
      ])
      return reply.send({ items: rows.map((i) => serializeSound(i)), total })
    },
  )

  fastify.delete(
    '/api/admin/channels/:slug/sound/:itemId',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Board: permanently delete one sound on a channel (audited)',
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const routeParams = parseRouteParams(ChannelSoundParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug, itemId } = routeParams

      const item = await fastify.prisma.sound.findFirst({
        where: { id: itemId, channel: { slug } },
        select: { id: true, title: true, channelId: true },
      })
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      await fastify.prisma.sound.delete({ where: { id: item.id } })
      await auditLog(fastify.prisma, {
        action: 'SOUND_ADMIN_DELETE',
        actorId: actor.id,
        targetId: itemId,
        meta: { slug, title: item.title, channelId: item.channelId },
      })
      return reply.status(204).send()
    },
  )

  fastify.patch(
    '/api/admin/channels/:slug/sound/:itemId',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: "Board access: patch sound item metadata for any channel's track",
        response: openApiResponse(SoundViewSchema, 'Sound'),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const routeParams = parseRouteParams(ChannelSoundParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { slug, itemId } = routeParams

      const item = await fastify.prisma.sound.findFirst({
        where: { id: itemId, channel: { slug } },
        select: { id: true, channelId: true, title: true },
      })
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      const patch = metadataPatchFromBody(request.body)
      if (!patch.ok) return reply.status(400).send({ error: patch.error })

      const venueId = patch.data.venueId
      if (typeof venueId === 'string' && !(await canAttachVenue(fastify.prisma, venueId, null))) {
        return reply.status(400).send(UNKNOWN_VENUE_BODY)
      }

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

      const before = await fastify.prisma.sound.findUnique({
        where: { id: itemId },
        select: soundMetadataSelect,
      })
      const updated = await fastify.prisma.sound.update({
        where: { id: itemId },
        data: patch.data,
        select: soundMetadataSelect,
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
        action: 'SOUND_METADATA_ADMIN_EDIT',
        actorId: actor.id,
        targetId: itemId,
        meta: { slug, previousTitle: item.title, fields: Object.keys(patch.data) },
      })
      await notifyArtistOfBoardTrackEdit(fastify.prisma, {
        soundId: itemId,
        channelId: item.channelId,
        title: updated.title,
        fields: changedFields(before, updated, Object.keys(patch.data)),
        actorId: actor.id,
      }).catch((err: unknown) => fastify.log.warn({ err }, 'board edit notice failed'))

      return reply.send(serializeSound(updated))
    },
  )
}

export default adminSoundRoutes
