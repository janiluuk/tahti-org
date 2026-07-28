// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelSlugRedirectResponseSchema, SlugParamSchema, openApiResponse, parseRouteParams } from '@tahti/shared'

/** Resolves a channel's previous, renamed-away slug to its current one, while
 * the 30-day grace redirect from routes/me/channel-slug.ts is still active —
 * lets /c/[slug]/page.tsx send visitors of the old <slug>.tahti.live address
 * on to the new one instead of a bare 404. */
const channelSlugRedirectRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/channels/:slug/redirect',
    {
      schema: {
        tags: ['channel'],
        description: "Resolve a channel's old, renamed-away slug to its current slug",
        response: openApiResponse(ChannelSlugRedirectResponseSchema, 'ChannelSlugRedirect'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const redirect = await fastify.prisma.channelSlugRedirect.findFirst({
        where: { oldSlug: routeParams.slug, expiresAt: { gt: new Date() } },
        select: { channel: { select: { slug: true } } },
      })
      if (!redirect) return reply.status(404).send({ error: 'No active redirect for that address' })

      return reply.send({ slug: redirect.channel.slug })
    },
  )
}

export default channelSlugRedirectRoute
