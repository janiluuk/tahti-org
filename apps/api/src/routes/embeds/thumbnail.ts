// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { EmbedThumbnailQuerySchema, EmbedThumbnailSchema, openApiResponse } from '@tahti/shared'
import { isSupportedEmbedPage, lookupEmbedThumbnail } from '../../lib/embed-thumbnail.js'

const embedThumbnailRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/embeds/thumbnail',
    {
      schema: {
        tags: ['channel'],
        summary: 'Provider thumbnail for an embed page',
        description:
          'Looks up the cover of a SoundCloud, YouTube, hearthis.at, Mixcloud, Spotify or Bandcamp page on the server, so clients never call a third-party oEmbed service. `thumbnailUrl` is null when the provider has none. Other hosts answer 400.',
        response: openApiResponse(EmbedThumbnailSchema, 'EmbedThumbnail'),
      },
    },
    async (request, reply) => {
      const parsed = EmbedThumbnailQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid query' })
      }
      if (!isSupportedEmbedPage(parsed.data.url)) {
        return reply.status(400).send({ error: 'Unsupported embed provider' })
      }
      const thumbnailUrl = await lookupEmbedThumbnail(parsed.data.url)
      return reply
        .header('Cache-Control', `public, max-age=${thumbnailUrl ? 86400 : 3600}`)
        .send({ thumbnailUrl })
    },
  )
}

export default embedThumbnailRoutes
