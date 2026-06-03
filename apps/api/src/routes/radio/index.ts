// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'

const RADIO_URL = process.env.RADIO_SERVICE_URL ?? 'http://tahti-radio:3004'

// M16 — public Tahti Radio now-playing endpoint
const radioRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/v1/radio', async (_request, reply) => {
    try {
      const res = await fetch(`${RADIO_URL}/now-playing`, { signal: AbortSignal.timeout(2000) })
      const data = (await res.json()) as unknown
      return reply.send(data)
    } catch {
      // Radio service unreachable — return offline state rather than 500
      return reply.send({ live: false, channel: null })
    }
  })
}

export default radioRoutes
