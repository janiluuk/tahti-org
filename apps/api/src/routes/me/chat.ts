// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  ChatAnnouncementSchema,
  ChatBanSchema,
  FingerprintHashParamSchema,
  IdParamSchema,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { recordMentions } from '../../lib/mentions.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const meChat: FastifyPluginAsync = async (fastify) => {
  // POST /api/me/chat/announcements { body: string }
  fastify.post(
    '/api/me/chat/announcements',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = ChatAnnouncementSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const text = parsed.data.body

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })

      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      // Max 3 announcements: delete the oldest if already at limit
      const existing = await fastify.prisma.channelAnnouncement.findMany({
        where: { channelId: channel.id },
        orderBy: { createdAt: 'asc' },
      })

      if (existing.length >= 3) {
        await fastify.prisma.channelAnnouncement.delete({
          where: { id: existing[0]!.id },
        })
      }

      const announcement = await fastify.prisma.channelAnnouncement.create({
        data: { channelId: channel.id, body: text },
      })

      // Record @-mentions (fire-and-forget; never block the response)
      recordMentions(fastify.prisma, user.id, text, 'ANNOUNCEMENT', announcement.id).catch((e) =>
        fastify.log.warn(e, 'mention record failed'),
      )

      return reply.status(201).send(announcement)
    },
  )

  // DELETE /api/me/chat/announcements/:id
  fastify.delete(
    '/api/me/chat/announcements/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })

      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const announcement = await fastify.prisma.channelAnnouncement.findFirst({
        where: { id, channelId: channel.id },
      })

      if (!announcement) return reply.status(404).send({ error: 'Not found' })

      await fastify.prisma.channelAnnouncement.delete({ where: { id } })
      return reply.status(204).send()
    },
  )

  // POST /api/me/chat/ban { fingerprintHash: string }
  fastify.post('/api/me/chat/ban', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const parsed = ChatBanSchema.safeParse(request.body)
    if (!parsed.success) return zodError(reply, parsed.error)
    const { fingerprintHash } = parsed.data

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })

    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    await fastify.prisma.chatBan.upsert({
      where: {
        channelId_fingerprintHash: { channelId: channel.id, fingerprintHash },
      },
      create: { channelId: channel.id, fingerprintHash },
      update: { bannedAt: new Date() },
    })

    return reply.status(201).send({ ok: true })
  })

  // DELETE /api/me/chat/ban/:fingerprintHash
  fastify.delete(
    '/api/me/chat/ban/:fingerprintHash',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(FingerprintHashParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { fingerprintHash } = routeParams

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })

      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      await fastify.prisma.chatBan.deleteMany({
        where: { channelId: channel.id, fingerprintHash },
      })

      return reply.status(204).send()
    },
  )
}

export default meChat
