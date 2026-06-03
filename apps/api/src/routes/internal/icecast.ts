// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { verifyPassword } from '../../lib/password.js'
import { spawnChannelLiquidsoap } from '../../lib/orchestrator.js'
import { checkBroadcastCap, canAcceptSourceConnect } from '@tahti/shared/broadcast-cap'
import {
  broadcastSessionLogFields,
  IcecastConnectSchema,
  IcecastDisconnectSchema,
} from '@tahti/shared'
import { enqueueFinalizeBroadcastRecording } from '../../lib/queue.js'

// Icecast URL auth callbacks.
// Icecast sends: mount, user, pass (plus optional ip, agent) as form-encoded body.
// Return HTTP 200 to allow, non-200 to deny.
const icecastRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/internal/icecast/on_connect', async (request, reply) => {
    const parsed = IcecastConnectSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(403).send('denied')
    const mount = parsed.data.mount
    const pass = parsed.data.pass ?? ''

    // mount is /live/<slug>
    const slug = mount.replace(/^\/live\//, '')
    if (!slug) return reply.status(403).send('denied')

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: {
        id: true,
        liveSourcePassHash: true,
        state: true,
        userId: true,
        user: { select: { tier: true } },
      },
    })

    if (!channel) return reply.status(403).send('denied')

    const valid = await verifyPassword(channel.liveSourcePassHash, pass)
    if (!valid) {
      fastify.log.warn({ slug }, 'icecast on_connect: invalid source password')
      return reply.status(403).send('denied')
    }

    const cap = await checkBroadcastCap(fastify.prisma, channel.userId, channel.user.tier)
    if (!canAcceptSourceConnect(cap, channel.state)) {
      fastify.log.info({ slug }, 'icecast on_connect: weekly live cap reached')
      return reply.status(403).send('weekly_cap')
    }

    const broadcast = await fastify.prisma.broadcast.create({
      data: { channelId: channel.id, source: 'ICECAST' },
    })

    await fastify.prisma.channel.update({
      where: { id: channel.id },
      data: { state: 'LIVE', goneLiveAt: new Date() },
    })

    spawnChannelLiquidsoap(channel.id, slug, broadcast.id).catch((err: unknown) =>
      fastify.log.error({ err }, 'orchestrator spawn failed (icecast)'),
    )

    fastify.log.info(
      broadcastSessionLogFields({
        broadcastId: broadcast.id,
        channelId: channel.id,
        slug,
        source: 'ICECAST',
      }),
      'icecast source connected',
    )
    return reply.status(200).send('ok')
  })

  fastify.post('/internal/icecast/on_disconnect', async (request, reply) => {
    const parsed = IcecastDisconnectSchema.safeParse(request.body)
    if (!parsed.success) return reply.status(200).send('ok')
    const slug = parsed.data.mount.replace(/^\/live\//, '')
    if (!slug) return reply.status(200).send('ok')

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: { id: true },
    })

    if (!channel) return reply.status(200).send('ok')

    const broadcast = await fastify.prisma.broadcast.findFirst({
      where: { channelId: channel.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
    })

    if (broadcast) {
      await fastify.prisma.broadcast.update({
        where: { id: broadcast.id },
        data: { endedAt: new Date() },
      })
      enqueueFinalizeBroadcastRecording(broadcast.id).catch((err: unknown) =>
        fastify.log.error(
          {
            err,
            ...broadcastSessionLogFields({
              broadcastId: broadcast.id,
              channelId: channel.id,
              slug,
              source: 'ICECAST',
            }),
          },
          'finalize-broadcast-recording enqueue failed',
        ),
      )
    }

    await fastify.prisma.channel.update({
      where: { id: channel.id },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })

    fastify.log.info(
      broadcast
        ? broadcastSessionLogFields({
            broadcastId: broadcast.id,
            channelId: channel.id,
            slug,
            source: 'ICECAST',
          })
        : { slug, channelId: channel.id },
      'icecast source disconnected',
    )
    return reply.status(200).send('ok')
  })

  // Listener add — future: increment presence count
  fastify.post('/internal/icecast/on_listen', async (_request, reply) => {
    return reply.status(200).send('ok')
  })
}

export default icecastRoutes
