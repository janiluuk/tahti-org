// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import { hashPassword } from '../../lib/password.js'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { liveHlsUrl } from '../../lib/stream-quality.js'

const streamSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/stream-settings — returns ingest URLs + masked credentials
  fastify.get('/api/me/stream-settings', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: {
        slug: true,
        state: true,
        liveSourceMount: true,
        liveSourcePass: true,
        rtmpStreamKey: true,
      },
    })

    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    return reply.send({
      rtmp: {
        server: `rtmp://${config.rtmpIngestHost}:1935/live`,
        streamKey: channel.rtmpStreamKey,
      },
      icecast: {
        server: `http://${config.icecastHost}`,
        mount: channel.liveSourceMount,
        password: channel.liveSourcePass,
      },
      hlsUrl: liveHlsUrl(config.hlsBaseUrl, channel.slug, user.tier),
    })
  })

  // POST /api/me/stream-settings/rtmp/rotate — generate a new RTMP stream key
  fastify.post(
    '/api/me/stream-settings/rtmp/rotate',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true, slug: true },
      })

      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const newKey = `${channel.slug}__${nanoid(32)}`
      const newHash = await hashPassword(newKey)

      await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: { rtmpStreamKey: newKey, rtmpStreamKeyHash: newHash },
      })

      return reply.send({ rtmpStreamKey: newKey })
    },
  )

  // POST /api/me/stream-settings/icecast/rotate — generate a new Icecast source password
  fastify.post(
    '/api/me/stream-settings/icecast/rotate',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })

      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const newPass = nanoid(24)
      const newHash = await hashPassword(newPass)

      await fastify.prisma.channel.update({
        where: { id: channel.id },
        data: { liveSourcePass: newPass, liveSourcePassHash: newHash },
      })

      return reply.send({ liveSourcePass: newPass })
    },
  )
}

export default streamSettingsRoutes
