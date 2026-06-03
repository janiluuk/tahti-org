// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { requireAuth } from '../../plugins/auth.js'
import { encryptStreamKey, decryptStreamKey } from '../../lib/stream-key-enc.js'
import { auditLog } from '../../lib/audit.js'

const PROVIDER_RTMP_URLS: Record<string, string> = {
  YOUTUBE: 'rtmp://a.rtmp.youtube.com/live2',
  TWITCH: 'rtmp://live.twitch.tv/app',
  FACEBOOK: 'rtmps://live-api-s.facebook.com:443/rtmp',
  KICK: 'rtmp://fa723fc1b171.ngwitch.tv/app',
  TIKTOK: 'rtmp://push-rtmp.tiktok.com/live/',
  MIXCLOUD_LIVE: 'rtmp://broadcast.mixcloud.com/live',
  INSTAGRAM: 'rtmps://live-upload.instagram.com:443/rtmp',
  CUSTOM: '',
}

const VALID_PROVIDERS = Object.keys(PROVIDER_RTMP_URLS)

const rtmpTargetRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/rtmp-targets — list targets (stream keys masked)
  fastify.get('/api/me/rtmp-targets', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    const targets = await fastify.prisma.rtmpTarget.findMany({
      where: { channelId: channel.id },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        provider: true,
        label: true,
        rtmpUrl: true,
        alwaysMirror: true,
        enabled: true,
        createdAt: true,
      },
    })

    return reply.send(targets)
  })

  // POST /api/me/rtmp-targets — add a new target
  fastify.post('/api/me/rtmp-targets', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const body = request.body as {
      provider?: string
      label?: string
      rtmpUrl?: string
      streamKey?: string
      alwaysMirror?: boolean
    }

    const provider = (body.provider ?? 'CUSTOM').toUpperCase()
    if (!VALID_PROVIDERS.includes(provider)) {
      return reply.status(400).send({ error: 'Invalid provider' })
    }

    const label = body.label?.trim()
    if (!label) return reply.status(400).send({ error: 'label is required' })

    const streamKey = body.streamKey?.trim()
    if (!streamKey) return reply.status(400).send({ error: 'streamKey is required' })

    const rtmpUrl = provider === 'CUSTOM' ? body.rtmpUrl?.trim() : PROVIDER_RTMP_URLS[provider]

    if (!rtmpUrl)
      return reply.status(400).send({ error: 'rtmpUrl is required for CUSTOM provider' })

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    const existing = await fastify.prisma.rtmpTarget.count({ where: { channelId: channel.id } })
    if (existing >= 5) {
      return reply.status(400).send({ error: 'Maximum 5 RTMP targets per channel' })
    }

    const streamKeyEnc = encryptStreamKey(streamKey)

    const target = await fastify.prisma.rtmpTarget.create({
      data: {
        channelId: channel.id,
        provider: provider as
          | 'YOUTUBE'
          | 'TWITCH'
          | 'FACEBOOK'
          | 'KICK'
          | 'TIKTOK'
          | 'MIXCLOUD_LIVE'
          | 'INSTAGRAM'
          | 'CUSTOM',
        label: label.slice(0, 64),
        rtmpUrl,
        streamKeyEnc,
        alwaysMirror: body.alwaysMirror === true && user.tier === 'STUDIO',
      },
      select: {
        id: true,
        provider: true,
        label: true,
        rtmpUrl: true,
        alwaysMirror: true,
        enabled: true,
      },
    })

    await auditLog(fastify.prisma, {
      action: 'RTMP_TARGET_ADD',
      actorId: user.id,
      targetId: target.id,
      meta: { provider, label },
    })

    return reply.status(201).send(target)
  })

  // PATCH /api/me/rtmp-targets/:id — toggle enabled / update stream key
  fastify.patch('/api/me/rtmp-targets/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const { id } = request.params as { id: string }
    const body = request.body as { enabled?: boolean; streamKey?: string; label?: string }

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    const target = await fastify.prisma.rtmpTarget.findFirst({
      where: { id, channelId: channel.id },
    })
    if (!target) return reply.status(404).send({ error: 'Target not found' })

    const update: Record<string, unknown> = {}
    if (typeof body.enabled === 'boolean') update.enabled = body.enabled
    if (body.label?.trim()) update.label = body.label.trim().slice(0, 64)
    if (body.streamKey?.trim()) update.streamKeyEnc = encryptStreamKey(body.streamKey.trim())

    await fastify.prisma.rtmpTarget.update({ where: { id }, data: update })

    return reply.send({ ok: true })
  })

  // DELETE /api/me/rtmp-targets/:id
  fastify.delete(
    '/api/me/rtmp-targets/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { id } = request.params as { id: string }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const target = await fastify.prisma.rtmpTarget.findFirst({
        where: { id, channelId: channel.id },
      })
      if (!target) return reply.status(404).send({ error: 'Target not found' })

      await fastify.prisma.rtmpTarget.delete({ where: { id } })

      await auditLog(fastify.prisma, {
        action: 'RTMP_TARGET_DELETE',
        actorId: user.id,
        targetId: id,
        meta: { label: target.label },
      })

      return reply.status(204).send()
    },
  )

  // GET /api/me/rtmp-targets/:id/stream-key — reveal decrypted stream key (logged)
  fastify.get(
    '/api/me/rtmp-targets/:id/stream-key',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { id } = request.params as { id: string }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const target = await fastify.prisma.rtmpTarget.findFirst({
        where: { id, channelId: channel.id },
        select: { streamKeyEnc: true },
      })
      if (!target) return reply.status(404).send({ error: 'Target not found' })

      const streamKey = decryptStreamKey(target.streamKeyEnc)
      return reply.send({ streamKey })
    },
  )
}

export default rtmpTargetRoutes
