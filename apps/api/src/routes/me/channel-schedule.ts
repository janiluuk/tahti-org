// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelSchedulePatchSchema } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

/** LISTENER-002 — artist sets when they plan to go live next. */
const channelScheduleRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/me/channel/schedule', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { nextBroadcastAt: true, nextBroadcastNote: true },
    })
    if (!channel) return reply.status(404).send({ error: 'No channel' })
    return reply.send(channel)
  })

  fastify.patch('/api/me/channel/schedule', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const parsed = ChannelSchedulePatchSchema.safeParse(request.body)
    if (!parsed.success) return zodError(reply, parsed.error)

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!channel) return reply.status(404).send({ error: 'No channel' })

    const data: { nextBroadcastAt?: Date | null; nextBroadcastNote?: string | null } = {}
    if (parsed.data.nextBroadcastAt !== undefined) {
      data.nextBroadcastAt = parsed.data.nextBroadcastAt
        ? new Date(parsed.data.nextBroadcastAt)
        : null
    }
    if (parsed.data.nextBroadcastNote !== undefined) {
      data.nextBroadcastNote = parsed.data.nextBroadcastNote?.trim() || null
    }
    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: 'No schedule fields to update' })
    }

    const updated = await fastify.prisma.channel.update({
      where: { id: channel.id },
      data,
      select: { nextBroadcastAt: true, nextBroadcastNote: true },
    })
    return reply.send(updated)
  })
}

export default channelScheduleRoutes
