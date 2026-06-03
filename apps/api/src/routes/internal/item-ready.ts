// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { config } from '../../config.js'

const itemReadyRoute: FastifyPluginAsync = async (fastify) => {
  fastify.post('/internal/webhooks/item-ready', async (request, reply) => {
    const authHeader = request.headers['authorization']
    if (authHeader !== `Bearer ${config.internalSecret}`) {
      return reply.status(401).send({ error: 'Unauthorized' })
    }

    const { itemId } = request.body as { itemId?: string }
    if (!itemId || typeof itemId !== 'string') {
      return reply.status(400).send({ error: 'itemId is required' })
    }

    const item = await fastify.prisma.archiveItem.findUnique({
      where: { id: itemId },
      select: { id: true },
    })

    if (!item) {
      return reply.status(404).send({ error: 'ArchiveItem not found' })
    }

    return reply.status(200).send({ ok: true })
  })
}

export default itemReadyRoute
