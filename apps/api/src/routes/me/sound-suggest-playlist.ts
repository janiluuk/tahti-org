// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  SuggestPlaylistBodySchema,
  SuggestedPlaylistSchema,
  openApiResponse,
  suggestMixOrder,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { effectiveBpm, effectiveKey } from '../../lib/sound-metadata.js'

const meSoundSuggestPlaylistRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/api/me/sound/suggest-playlist',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        summary: 'Put your sounds in mix order',
        description:
          'Orders 2-500 of your own sounds for a DJ-style mix by Camelot key and BPM (detected values when the sound uses them). Ids that are not yours are ignored; sounds with no readable key come back in `unplaced`. Nothing is saved.',
        response: openApiResponse(SuggestedPlaylistSchema, 'SuggestedPlaylist'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = SuggestPlaylistBodySchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const ids = [...new Set(parsed.data.ids)]
      const rows = await fastify.prisma.sound.findMany({
        where: { id: { in: ids }, channel: { userId: user.id } },
        select: {
          id: true,
          title: true,
          bpm: true,
          bpmDetected: true,
          musicalKey: true,
          keyDetected: true,
          useDetectedBpmKey: true,
        },
      })
      const byId = new Map(rows.map((r) => [r.id, r]))
      const tracks = ids.flatMap((id) => {
        const row = byId.get(id)
        if (!row) return []
        return [{ id: row.id, title: row.title, bpm: effectiveBpm(row), key: effectiveKey(row) }]
      })
      const { ordered, unplaced } = suggestMixOrder(tracks)
      return reply.send({ items: ordered, unplaced })
    },
  )
}

export default meSoundSuggestPlaylistRoutes
