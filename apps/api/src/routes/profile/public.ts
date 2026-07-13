// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import {
  PublicProfileViewSchema,
  UsernameParamSchema,
  archivePlaybackKey,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { presignedGetUrl } from '../../lib/minio.js'
import { resolveReleaseArtworkUrl } from '../../lib/release-artwork.js'
import { config } from '../../config.js'
import { getCachedJson } from '../../lib/json-cache.js'

// M12: public artist profile at tahti.live/u/<username>
const publicProfileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/u/:username/profile',
    {
      schema: {
        tags: ['releases'],
        description: 'M12: public artist profile',
        response: openApiResponse(PublicProfileViewSchema, 'PublicProfile'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(UsernameParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { username } = routeParams

      const profile = await getCachedJson(`profile:public:${username}`, 20, () =>
        buildPublicProfile(fastify, username),
      )
      if (!profile) return reply.status(404).send({ error: 'Artist not found' })
      return reply.send(profile)
    },
  )
}

async function buildPublicProfile(fastify: FastifyInstance, username: string) {
  const user = await fastify.prisma.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      displayName: true,
      bio: true,
      avatarUrl: true,
      socialLinks: true,
      tipJarUrl: true,
      tier: true,
      countryCode: true,
      pronouns: true,
      showJoinDate: true,
      createdAt: true,
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
          artworkKey: true,
          releaseDate: true,
          description: true,
          smartLinkSlug: true,
          tracks: {
            orderBy: { position: 'asc' },
            select: {
              position: true,
              title: true,
              durationSec: true,
              archiveItemId: true,
              streamKey: true,
            },
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
        orderBy: [{ isFeatured: 'desc' }, { createdAt: 'desc' }],
        take: 12,
        select: {
          slug: true,
          name: true,
          type: true,
          description: true,
          coverUrl: true,
          isFeatured: true,
          _count: { select: { items: true } },
        },
      },
    },
  })

  if (!user) return null

  const archiveIds = user.releases.flatMap((r) =>
    r.tracks.map((t) => t.archiveItemId).filter((id): id is string => Boolean(id)),
  )

  const playUrlByArchiveId = new Map<string, string | null>()
  if (archiveIds.length > 0) {
    const items = await fastify.prisma.archiveItem.findMany({
      where: {
        id: { in: archiveIds },
        status: 'READY',
        channel: { userId: user.id },
      },
      select: { id: true, mp3Key: true, flacKey: true },
    })
    await Promise.all(
      items.map(async (item) => {
        const key = archivePlaybackKey(item)
        playUrlByArchiveId.set(item.id, key ? await presignedGetUrl(key, 3600) : null)
      }),
    )
  }

  const channelSlug = user.channel?.slug ?? null
  const releases = await Promise.all(
    user.releases.map(async (release) => ({
      ...release,
      artworkUrl: await resolveReleaseArtworkUrl(release),
      tracks: await Promise.all(
        release.tracks.map(async (track) => {
          let playUrl: string | null = null
          if (track.archiveItemId) {
            playUrl = playUrlByArchiveId.get(track.archiveItemId) ?? null
          } else if (track.streamKey) {
            playUrl = await presignedGetUrl(track.streamKey, 3600)
          }
          return {
            position: track.position,
            title: track.title,
            durationSec: track.durationSec,
            archiveItemId: track.archiveItemId,
            playUrl,
            channelItemUrl:
              track.archiveItemId && channelSlug
                ? `/c/${channelSlug}#archive-item-${track.archiveItemId}`
                : null,
          }
        }),
      ),
    })),
  )

  return {
    artist: {
      username: user.username,
      displayName: user.displayName,
      bio: user.bio,
      avatarUrl: user.avatarUrl,
      socialLinks: user.socialLinks,
      tipJarUrl: user.tipJarUrl,
      tier: user.tier,
      countryCode: user.countryCode,
      pronouns: user.pronouns,
      joinDate: user.showJoinDate ? user.createdAt.toISOString() : null,
    },
    channel: user.channel,
    releases,
    fanTiers: user.fanTiers,
    collections: user.collections.map(({ _count, ...c }) => ({
      slug: c.slug,
      name: c.name,
      type: c.type,
      description: c.description,
      coverUrl: c.coverUrl,
      isFeatured: c.isFeatured,
      itemCount: _count.items,
      url: `/u/${user.username}/c/${c.slug}`,
      rssUrl: `${config.apiUrl}/api/v1/collections/${c.slug}/rss.xml`,
    })),
    links: {
      channel: user.channel ? `/c/${user.channel.slug}` : null,
      subscribe: `/u/${user.username}/subscribe`,
      feeds: {
        archive: user.channel ? `${config.apiUrl}/api/v1/u/${user.username}/rss.xml` : null,
      },
    },
  }
}

export default publicProfileRoutes
