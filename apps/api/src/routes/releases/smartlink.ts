// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  SmartLinkSlugParamSchema,
  SmartLinkViewSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../../config.js'
import { resolveReleaseArtworkUrl } from '../../lib/release-artwork.js'
import { resolveCollectionCoverUrl } from '../../lib/collection-cover.js'
import { resolveColorScheme } from '@tahti/shared'

// M14 (partial): public smart link resolves to artist profile + release anchor.
const smartlinkRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/r/:smartLinkSlug',
    {
      schema: {
        tags: ['releases'],
        description: 'M14: public smart link payload',
        response: openApiResponse(SmartLinkViewSchema, 'SmartLink'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(SmartLinkSlugParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { smartLinkSlug } = routeParams

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
          discogsReleaseId: true,
          pLine: true,
          cLine: true,
          colorSchemeJson: true,
          paletteJson: true,
          visualPreset: true,
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
                  coverKey: true,
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

      const discogsUrl = release.discogsReleaseId
        ? `https://www.discogs.com/release/${release.discogsReleaseId}`
        : null

      const featuredCollections = await Promise.all(
        release.user.collections.map(async ({ _count, ...c }) => ({
          slug: c.slug,
          name: c.name,
          type: c.type,
          description: c.description,
          coverUrl: await resolveCollectionCoverUrl(c),
          itemCount: _count.items,
          url: `/u/${release.user.username}/c/${c.slug}`,
        })),
      )

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
          discogsUrl,
          colorSchemeJson: release.colorSchemeJson,
          paletteJson: release.paletteJson,
          visualPreset: release.visualPreset,
          colorScheme: resolveColorScheme(release.colorSchemeJson, release.paletteJson),
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
    },
  )
}

export default smartlinkRoutes
