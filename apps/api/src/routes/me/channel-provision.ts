// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import { requireAuth } from '../../plugins/auth.js'
import { hashPassword } from '../../lib/password.js'

/** Self-service channel provisioning for accounts created without one (e.g. legacy listener accounts). */
const channelProvisionRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/api/me/channel/provision', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!

    const existing = await fastify.prisma.channel.findUnique({ where: { userId: user.id } })
    if (existing) {
      return reply.status(409).send({ error: 'Channel already exists.' })
    }

    const slug = user.username
    const liveSourceMount = `/live/${slug}`
    const liveSourcePass = nanoid(24)
    const rtmpStreamKey = `${slug}__${nanoid(32)}`
    const [liveSourcePassHash, rtmpStreamKeyHash] = await Promise.all([
      hashPassword(liveSourcePass),
      hashPassword(rtmpStreamKey),
    ])

    const channel = await fastify.prisma.channel.create({
      data: {
        userId: user.id,
        slug,
        liveSourceMount,
        liveSourcePass,
        liveSourcePassHash,
        rtmpStreamKey,
        rtmpStreamKeyHash,
      },
      select: { slug: true },
    })

    return reply.status(201).send({ slug: channel.slug })
  })
}

export default channelProvisionRoutes
