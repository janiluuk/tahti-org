// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Fastify from 'fastify'
import { broadcastSessionLogFields } from '@tahti/shared'
import { spawnChannel, stopChannel, getActiveChannels } from './liquidsoap.js'

const PORT = parseInt(process.env.PORT ?? '3003', 10)
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? 'dev-internal-secret-change-in-prod'

const fastify = Fastify({ logger: true })

// All routes require the internal Bearer secret
fastify.addHook('preHandler', async (request, reply) => {
  const auth = (request.headers['authorization'] as string | undefined) ?? ''
  if (auth !== `Bearer ${INTERNAL_SECRET}`) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
})

fastify.get('/health', async () => ({ ok: true, channels: getActiveChannels() }))

// Spawn (or ensure running) the Liquidsoap container for a channel
fastify.post('/spawn', async (request, reply) => {
  const { channelId, slug, broadcastId } = request.body as {
    channelId: string
    slug: string
    broadcastId: string
  }

  if (!channelId || !slug) {
    return reply.status(400).send({ error: 'channelId and slug required' })
  }

  await spawnChannel(channelId, slug, broadcastId)
  request.log.info(
    broadcastSessionLogFields({ broadcastId, channelId, slug }),
    'liquidsoap spawned',
  )
  return reply.send({ ok: true })
})

// Stop the Liquidsoap container for a channel
fastify.post('/stop', async (request, reply) => {
  const { channelId } = request.body as { channelId: string }
  if (!channelId) return reply.status(400).send({ error: 'channelId required' })

  await stopChannel(channelId)
  return reply.send({ ok: true })
})

// STREAM-005: restart Liquidsoap after stale HLS segments (watchdog)
fastify.post('/restart', async (request, reply) => {
  const { channelId, slug, broadcastId } = request.body as {
    channelId: string
    slug: string
    broadcastId: string
  }
  if (!channelId || !slug || !broadcastId) {
    return reply.status(400).send({ error: 'channelId, slug, and broadcastId required' })
  }

  await stopChannel(channelId)
  await spawnChannel(channelId, slug, broadcastId)
  request.log.info(
    broadcastSessionLogFields({ broadcastId, channelId, slug }),
    'liquidsoap restarted',
  )
  return reply.send({ ok: true, restarted: true })
})

await fastify.listen({ port: PORT, host: '0.0.0.0' })
