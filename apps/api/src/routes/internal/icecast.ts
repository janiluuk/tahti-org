// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { verifyPassword } from '../../lib/password.js'

// Icecast URL auth callbacks.
// Icecast sends: mount, user, pass (plus optional ip, agent) as form-encoded body.
// Return HTTP 200 to allow, non-200 to deny.
const icecastRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/internal/icecast/on_connect', async (request, reply) => {
    const body = request.body as Record<string, string>
    const mount: string = body.mount ?? ''
    const pass: string = body.pass ?? ''

    // mount is /live/<slug>
    const slug = mount.replace(/^\/live\//, '')
    if (!slug) return reply.status(403).send('denied')

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: { id: true, liveSourcePassHash: true, state: true },
    })

    if (!channel) return reply.status(403).send('denied')

    const valid = await verifyPassword(channel.liveSourcePassHash, pass)
    if (!valid) {
      fastify.log.warn({ slug }, 'icecast on_connect: invalid source password')
      return reply.status(403).send('denied')
    }

    const broadcast = await fastify.prisma.broadcast.create({
      data: { channelId: channel.id, source: 'ICECAST' },
    })

    await fastify.prisma.channel.update({
      where: { id: channel.id },
      data: { state: 'LIVE', goneLiveAt: new Date() },
    })

    fastify.log.info({ slug, broadcastId: broadcast.id }, 'icecast source connected')
    return reply.status(200).send('ok')
  })

  fastify.post('/internal/icecast/on_disconnect', async (request, reply) => {
    const body = request.body as Record<string, string>
    const mount: string = body.mount ?? ''
    const slug = mount.replace(/^\/live\//, '')
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
    }

    await fastify.prisma.channel.update({
      where: { id: channel.id },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })

    fastify.log.info({ slug }, 'icecast source disconnected')
    return reply.status(200).send('ok')
  })

  // Listener add — future: increment presence count
  fastify.post('/internal/icecast/on_listen', async (_request, reply) => {
    return reply.status(200).send('ok')
  })
}

export default icecastRoutes
