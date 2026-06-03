// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'

// M12: public artist profile at tahti.live/u/<username>
const publicProfileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/v1/u/:username/profile', async (request, reply) => {
    const { username } = request.params as { username: string }

    const user = await fastify.prisma.user.findUnique({
      where: { username },
      select: {
        username: true,
        displayName: true,
        bio: true,
        avatarUrl: true,
        socialLinks: true,
        tipJarUrl: true,
        tier: true,
        channel: { select: { slug: true, state: true } },
        releases: {
          where: { state: 'PUBLISHED' },
          orderBy: { releaseDate: 'desc' },
          take: 24,
          select: {
            id: true,
            title: true,
            type: true,
            artworkUrl: true,
            releaseDate: true,
            description: true,
            smartLinkSlug: true,
            tracks: {
              orderBy: { position: 'asc' },
              select: { position: true, title: true, durationSec: true },
            },
          },
        },
        fanTiers: {
          where: { active: true },
          orderBy: { position: 'asc' },
          select: { id: true, name: true, amountCents: true },
        },
      },
    })

    if (!user) return reply.status(404).send({ error: 'Artist not found' })

    return reply.send({
      artist: {
        username: user.username,
        displayName: user.displayName,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        socialLinks: user.socialLinks,
        tipJarUrl: user.tipJarUrl,
        tier: user.tier,
      },
      channel: user.channel,
      releases: user.releases,
      fanTiers: user.fanTiers,
      links: {
        channel: user.channel ? `/c/${user.channel.slug}` : null,
        subscribe: `/u/${user.username}/subscribe`,
      },
    })
  })
}

export default publicProfileRoutes
