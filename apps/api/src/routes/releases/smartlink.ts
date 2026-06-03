// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { config } from '../../config.js'

// M14 (partial): public smart link resolves to artist profile + release anchor.
const smartlinkRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/v1/r/:smartLinkSlug', async (request, reply) => {
    const { smartLinkSlug } = request.params as { smartLinkSlug: string }

    const release = await fastify.prisma.release.findFirst({
      where: { smartLinkSlug, state: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        type: true,
        releaseDate: true,
        artworkUrl: true,
        smartLinkTargets: true,
        description: true,
        user: { select: { username: true, displayName: true, avatarUrl: true } },
      },
    })

    if (!release) return reply.status(404).send({ error: 'Release not found' })

    const profileUrl = `${config.appUrl}/u/${release.user.username}`
    const releaseUrl = `${profileUrl}#release-${release.id}`
    const targets =
      release.smartLinkTargets && typeof release.smartLinkTargets === 'object'
        ? (release.smartLinkTargets as Record<string, string>)
        : {}

    return reply.send({
      release: {
        id: release.id,
        title: release.title,
        type: release.type,
        releaseDate: release.releaseDate,
        artworkUrl: release.artworkUrl,
        description: release.description,
        smartLinkSlug,
      },
      artist: release.user,
      profileUrl,
      releaseUrl,
      targets,
      embedUrl: `${config.appUrl}/embed/r/${release.id}`,
    })
  })
}

export default smartlinkRoutes
