// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  IcecastPassRotateResponseSchema,
  StreamKeyRotateResponseSchema,
  StreamSettingsResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { hashPassword } from '../../lib/password.js'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { liveHlsUrl } from '../../lib/stream-quality.js'
import {
  parseIngestHostList,
  resolveIcecastIngestHosts,
  resolveRtmpIngestHosts,
} from '../../lib/ingest-endpoints.js'

const streamSettingsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/stream-settings — returns ingest URLs + masked credentials
  fastify.get(
    '/api/me/stream-settings',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M3: RTMP + Icecast ingest credentials and HLS playback URL',
        response: openApiResponse(StreamSettingsResponseSchema, 'StreamSettings'),
      },
    },
    async (request, reply) => {
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

      const rtmpHosts = parseIngestHostList(config.rtmpIngestHosts, config.rtmpIngestHost)
      const icecastHosts = parseIngestHostList(
        config.icecastIngestHosts,
        config.icecastPublicUrl.replace(/^https?:\/\//, '').split('/')[0] ?? config.icecastPublicUrl,
      )

      const icecastScheme = config.icecastPublicUrl.startsWith('http://') ? 'http' : 'https'

      const [rtmp, icecast] = await Promise.all([
        resolveRtmpIngestHosts({
          hosts: rtmpHosts,
          healthPort: config.rtmpIngestHealthPort,
          healthPath: config.rtmpIngestHealthPath,
          healthScheme: config.rtmpIngestHealthScheme,
        }),
        resolveIcecastIngestHosts({
          hosts: icecastHosts,
          defaultScheme: icecastScheme,
        }),
      ])

      return reply.send({
        rtmp: {
          server: rtmp.server,
          streamKey: channel.rtmpStreamKey,
          ...(rtmp.fallbackServers.length > 0 ? { fallbackServers: rtmp.fallbackServers } : {}),
        },
        icecast: {
          server: icecast.server,
          mount: channel.liveSourceMount,
          password: channel.liveSourcePass,
          hint: 'Audio-only DJ apps (Mixxx, Traktor, butt) — not OBS. Same live show as RTMP.',
          ...(icecast.fallbackServers.length > 0
            ? { fallbackServers: icecast.fallbackServers }
            : {}),
        },
        hlsUrl: liveHlsUrl(config.hlsBaseUrl, channel.slug, user.tier),
      })
    },
  )

  // POST /api/me/stream-settings/rtmp/rotate — generate a new RTMP stream key
  fastify.post(
    '/api/me/stream-settings/rtmp/rotate',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(StreamKeyRotateResponseSchema, 'StreamKeyRotate'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true, slug: true, state: true },
      })

      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (channel.state === 'LIVE') {
        return reply.status(409).send({
          error: 'Go offline before rotating the RTMP stream key',
        })
      }

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
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(IcecastPassRotateResponseSchema, 'IcecastPassRotate'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true, state: true },
      })

      if (!channel) return reply.status(404).send({ error: 'Channel not found' })
      if (channel.state === 'LIVE') {
        return reply.status(409).send({
          error: 'Go offline before rotating the Icecast password',
        })
      }

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
