// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { config } from '../../config.js'
import { resolveReleaseArtworkUrl } from '../../lib/release-artwork.js'

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
        artworkKey: true,
        smartLinkTargets: true,
        smartLinkViewCount: true,
        description: true,
        upc: true,
        musicbrainzReleaseId: true,
        pLine: true,
        cLine: true,
        tracks: {
          orderBy: { position: 'asc' },
          select: { title: true, isrc: true, position: true },
        },
        user: {
          select: {
            username: true,
            displayName: true,
            avatarUrl: true,
            collections: {
              where: { isPublic: true, isFeatured: true },
              orderBy: { createdAt: 'desc' },
              take: 6,
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
        },
      },
    })

    if (!release) return reply.status(404).send({ error: 'Release not found' })

    const artworkUrl = await resolveReleaseArtworkUrl(release)

    await fastify.prisma.release.update({
      where: { id: release.id },
      data: { smartLinkViewCount: { increment: 1 } },
    })

    const profileUrl = `${config.appUrl}/u/${release.user.username}`
    const releaseUrl = `${profileUrl}#release-${release.id}`
    const targets =
      release.smartLinkTargets && typeof release.smartLinkTargets === 'object'
        ? (release.smartLinkTargets as Record<string, string>)
        : {}

    const musicbrainzUrl = release.musicbrainzReleaseId
      ? `https://musicbrainz.org/release/${release.musicbrainzReleaseId}`
      : null

    const featuredCollections = release.user.collections.map(({ _count, ...c }) => ({
      slug: c.slug,
      name: c.name,
      type: c.type,
      description: c.description,
      coverUrl: c.coverUrl,
      itemCount: _count.items,
      url: `/u/${release.user.username}/c/${c.slug}`,
    }))

    return reply.send({
      release: {
        id: release.id,
        title: release.title,
        type: release.type,
        releaseDate: release.releaseDate,
        artworkUrl,
        description: release.description,
        smartLinkSlug,
        smartLinkViewCount: release.smartLinkViewCount + 1,
        upc: release.upc,
        pLine: release.pLine,
        cLine: release.cLine,
        tracks: release.tracks,
        musicbrainzUrl,
      },
      artist: {
        username: release.user.username,
        displayName: release.user.displayName,
        avatarUrl: release.user.avatarUrl,
      },
      featuredCollections,
      profileUrl,
      releaseUrl,
      targets,
      embedUrl: `${config.appUrl}/embed/r/${release.id}`,
    })
  })
}

export default smartlinkRoutes
