// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { prisma } from '@tahti/db'
import Fastify from 'fastify'
import { broadcastSessionLogFields } from '@tahti/shared'
import {
  spawnChannel,
  stopChannel,
  stopLiquidsoapContainer,
  spawnLiquidsoapContainer,
  getActiveChannels,
  getContainerNameForChannel,
} from './liquidsoap.js'
import { getActiveRecorders } from './recorder.js'
import { getActiveEdgeEncoders } from './edge-encoder.js'
import { startNowPlayingSync } from './now-playing-sync.js'
import {
  LIQUIDSOAP_SKIP_COMMAND,
  LIQUIDSOAP_PAUSE_COMMAND,
  LIQUIDSOAP_RESUME_COMMAND,
  liquidsoapJumpQueuePushCommand,
  sendLiquidsoapTelnetCommand,
} from './liquidsoap-shutdown.js'

const PORT = parseInt(process.env.PORT ?? '3003', 10)
const INTERNAL_SECRET = process.env.INTERNAL_SECRET ?? 'dev-internal-secret-change-in-prod'

const fastify = Fastify({ logger: true })

// Operational routes require the internal Bearer secret (/health is public liveness).
fastify.addHook('preHandler', async (request, reply) => {
  if (request.routerPath === '/health') return
  const auth = (request.headers['authorization'] as string | undefined) ?? ''
  if (auth !== `Bearer ${INTERNAL_SECRET}`) {
    return reply.status(401).send({ error: 'Unauthorized' })
  }
})

fastify.get('/health', async () => ({
  ok: true,
  channels: getActiveChannels(),
  edgeEncoders: getActiveEdgeEncoders(),
  recorders: getActiveRecorders(),
}))

// Spawn (or ensure running) the Liquidsoap container for a channel
fastify.post('/spawn', async (request, reply) => {
  const { channelId, slug, broadcastId, template } = request.body as {
    channelId: string
    slug: string
    broadcastId: string
    template?: 'channel' | 'rotation'
  }

  if (!channelId || !slug) {
    return reply.status(400).send({ error: 'channelId and slug required' })
  }

  await spawnChannel(channelId, slug, broadcastId, template ?? 'channel')
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
  const { channelId, slug, broadcastId, template } = request.body as {
    channelId: string
    slug: string
    broadcastId: string
    template?: 'channel' | 'rotation'
  }
  if (!channelId || !slug || !broadcastId) {
    return reply.status(400).send({ error: 'channelId, slug, and broadcastId required' })
  }

  await stopLiquidsoapContainer(channelId)

  const broadcast = await prisma.broadcast.findUnique({
    where: { id: broadcastId },
    select: { source: true },
  })
  await spawnLiquidsoapContainer(
    channelId,
    slug,
    broadcastId,
    broadcast?.source ?? 'ICECAST',
    template ?? 'channel',
  )
  request.log.info(
    broadcastSessionLogFields({ broadcastId, channelId, slug }),
    'liquidsoap restarted (edge encoder + recorder sidecars kept running)',
  )
  return reply.send({ ok: true, restarted: true })
})

// Manage panel transport controls — all no-op with a 404 when the channel
// has no running Liquidsoap process (offline channels have nothing to control).
async function withChannelContainer(
  channelId: string,
  reply: { status: (code: number) => { send: (body: unknown) => unknown } },
  fn: (containerName: string) => Promise<void>,
): Promise<unknown> {
  const containerName = getContainerNameForChannel(channelId)
  if (!containerName) {
    return reply.status(404).send({ error: 'Channel is not currently running' })
  }
  await fn(containerName)
  return undefined
}

fastify.post('/skip', async (request, reply) => {
  const { channelId } = request.body as { channelId: string }
  if (!channelId) return reply.status(400).send({ error: 'channelId required' })

  const early = await withChannelContainer(channelId, reply, async (containerName) => {
    await sendLiquidsoapTelnetCommand(containerName, LIQUIDSOAP_SKIP_COMMAND)
  })
  if (early !== undefined) return early
  return reply.send({ ok: true })
})

fastify.post('/previous', async (request, reply) => {
  const { channelId, url } = request.body as { channelId: string; url: string }
  if (!channelId || !url) return reply.status(400).send({ error: 'channelId and url required' })

  const early = await withChannelContainer(channelId, reply, async (containerName) => {
    await sendLiquidsoapTelnetCommand(containerName, liquidsoapJumpQueuePushCommand(url))
  })
  if (early !== undefined) return early
  return reply.send({ ok: true })
})

fastify.post('/pause', async (request, reply) => {
  const { channelId } = request.body as { channelId: string }
  if (!channelId) return reply.status(400).send({ error: 'channelId required' })

  const early = await withChannelContainer(channelId, reply, async (containerName) => {
    await sendLiquidsoapTelnetCommand(containerName, LIQUIDSOAP_PAUSE_COMMAND)
  })
  if (early !== undefined) return early
  return reply.send({ ok: true })
})

fastify.post('/resume', async (request, reply) => {
  const { channelId } = request.body as { channelId: string }
  if (!channelId) return reply.status(400).send({ error: 'channelId required' })

  const early = await withChannelContainer(channelId, reply, async (containerName) => {
    await sendLiquidsoapTelnetCommand(containerName, LIQUIDSOAP_RESUME_COMMAND)
  })
  if (early !== undefined) return early
  return reply.send({ ok: true })
})

startNowPlayingSync()

await fastify.listen({ port: PORT, host: '0.0.0.0' })
