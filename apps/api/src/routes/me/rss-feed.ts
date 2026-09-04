// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { fetchGuardedFeed } from '../../lib/rss-feed.js'

const meRssFeedRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/rss-feed?url= — fetch a public RSS/Atom document for the
  // Listen News widget's settings preview. SSRF-guarded: http(s) only, no
  // redirects, no private IPs.
  fastify.get(
    '/api/me/rss-feed',
    {
      preHandler: requireAuth,
      schema: { tags: ['channel'], description: 'Proxy a public RSS or Atom feed' },
    },
    async (request, reply) => {
      const urlValue = (request.query as { url?: string })?.url?.trim()
      if (!urlValue) {
        return reply.status(400).send({ error: 'url is required' })
      }
      const result = await fetchGuardedFeed(urlValue)
      if (!result.ok) {
        return reply.status(result.status).send({ error: result.error })
      }
      return reply.send({ xml: result.xml })
    },
  )
}

export default meRssFeedRoutes
