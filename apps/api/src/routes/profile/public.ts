// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

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
        collections: {
          where: { isPublic: true },
          orderBy: { createdAt: 'desc' },
          take: 12,
          select: {
            slug: true,
            name: true,
            type: true,
            description: true,
            coverUrl: true,
            _count: { select: { items: true } },
          },
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
      collections: user.collections.map(({ _count, ...c }) => ({
        slug: c.slug,
        name: c.name,
        type: c.type,
        description: c.description,
        coverUrl: c.coverUrl,
        itemCount: _count.items,
        url: `/u/${user.username}/c/${c.slug}`,
      })),
      links: {
        channel: user.channel ? `/c/${user.channel.slug}` : null,
        subscribe: `/u/${user.username}/subscribe`,
      },
    })
  })
}

export default publicProfileRoutes
