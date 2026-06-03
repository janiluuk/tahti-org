// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  OEmbedQuerySchema,
  ReleaseTrackParamsSchema,
  SlugParamSchema,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../../config.js'
import { presignedGetUrl } from '../../lib/minio.js'
import { resolveReleaseArtworkUrl } from '../../lib/release-artwork.js'

// M14 — oEmbed discovery endpoint + embed metadata
// oEmbed spec: https://oembed.com/
const embedRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /oembed?url=<release-or-channel-url>&format=json
  fastify.get('/oembed', async (request, reply) => {
    const parsed = OEmbedQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({
        error: parsed.error.issues[0]?.message ?? 'Invalid query',
      })
    }
    const { url } = parsed.data

    let embedUrl: string
    let title: string
    let authorName: string
    let authorUrl: string
    let thumbnailUrl: string | undefined

    // Match release smart link: APP_URL/r/<slug>
    const releaseMatch = url.match(/\/r\/([^/?#]+)/)
    if (releaseMatch) {
      const slug = releaseMatch[1]
      const release = await fastify.prisma.release.findFirst({
        where: { smartLinkSlug: slug, state: 'PUBLISHED' },
        select: {
          id: true,
          title: true,
          artworkUrl: true,
          artworkKey: true,
          user: { select: { username: true, displayName: true } },
        },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      title = release.title
      authorName = release.user.displayName
      authorUrl = `${config.appUrl}/u/${release.user.username}`
      embedUrl = `${config.appUrl}/embed/r/${release.id}`
      thumbnailUrl = (await resolveReleaseArtworkUrl(release)) ?? undefined
    } else {
      // Match channel: APP_URL/c/<slug>
      const channelMatch = url.match(/\/c\/([^/?#]+)/)
      if (!channelMatch) return reply.status(404).send({ error: 'Unrecognised URL' })

      const slug = channelMatch[1]
      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { slug: true, user: { select: { username: true, displayName: true } } },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      title = `${channel.user.displayName} — live channel`
      authorName = channel.user.displayName
      authorUrl = `${config.appUrl}/u/${channel.user.username}`
      embedUrl = `${config.appUrl}/embed/c/${slug}`
    }

    return reply.header('Content-Type', 'application/json+oembed').send({
      version: '1.0',
      type: 'rich',
      title,
      author_name: authorName,
      author_url: authorUrl,
      provider_name: 'Tahti',
      provider_url: 'https://tahti.live',
      thumbnail_url: thumbnailUrl,
      thumbnail_width: thumbnailUrl ? 300 : undefined,
      thumbnail_height: thumbnailUrl ? 300 : undefined,
      html: `<iframe src="${embedUrl}" width="400" height="160" frameborder="0" allowtransparency="true" allow="autoplay"></iframe>`,
      width: 400,
      height: 160,
    })
  })

  // GET /api/v1/embed/r/:id — release embed metadata (lightweight, no auth)
  fastify.get('/api/v1/embed/r/:id', async (request, reply) => {
    const routeParams = parseRouteParams(IdParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { id } = routeParams

    const release = await fastify.prisma.release.findFirst({
      where: { id, state: 'PUBLISHED' },
      select: {
        id: true,
        title: true,
        type: true,
        artworkUrl: true,
        artworkKey: true,
        smartLinkSlug: true,
        user: { select: { username: true, displayName: true } },
        tracks: {
          orderBy: { position: 'asc' },
          select: { id: true, position: true, title: true, durationSec: true, streamKey: true },
        },
      },
    })

    if (!release) return reply.status(404).send({ error: 'Release not found' })

    const artworkUrl = await resolveReleaseArtworkUrl(release)

    return reply.send({
      id: release.id,
      title: release.title,
      type: release.type,
      artworkUrl,
      smartLinkSlug: release.smartLinkSlug,
      artist: release.user,
      tracks: release.tracks.map((t) => ({
        id: t.id,
        position: t.position,
        title: t.title,
        durationSec: t.durationSec,
        hasStream: !!t.streamKey,
      })),
      embedUrl: `${config.appUrl}/embed/r/${release.id}`,
      profileUrl: `${config.appUrl}/u/${release.user.username}`,
    })
  })

  // GET /api/v1/embed/c/:slug — channel embed metadata
  fastify.get('/api/v1/embed/c/:slug', async (request, reply) => {
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { slug } = routeParams

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: {
        slug: true,
        state: true,
        user: { select: { username: true, displayName: true, avatarUrl: true } },
      },
    })

    if (!channel) return reply.status(404).send({ error: 'Channel not found' })

    return reply.send({
      slug: channel.slug,
      state: channel.state,
      artist: channel.user,
      embedUrl: `${config.appUrl}/embed/c/${slug}`,
      profileUrl: `${config.appUrl}/u/${channel.user.username}`,
      hlsUrl: channel.state === 'LIVE' ? `${config.hlsBaseUrl}/${slug}/index.m3u8` : null,
    })
  })

  // GET /api/v1/embed/r/:id/tracks/:trackId/play — short-lived stream URL for embed player
  fastify.get('/api/v1/embed/r/:id/tracks/:trackId/play', async (request, reply) => {
    const routeParams = parseRouteParams(ReleaseTrackParamsSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { id, trackId } = routeParams

    const release = await fastify.prisma.release.findFirst({
      where: { id, state: 'PUBLISHED' },
      select: { id: true },
    })
    if (!release) return reply.status(404).send({ error: 'Release not found' })

    const track = await fastify.prisma.releaseTrack.findFirst({
      where: { id: trackId, releaseId: release.id, status: 'READY' },
      select: { streamKey: true, sourceKey: true, title: true },
    })
    if (!track) return reply.status(404).send({ error: 'Track not found or not ready' })

    const key = track.streamKey ?? track.sourceKey
    if (!key) return reply.status(409).send({ error: 'Track file not available yet' })

    const url = await presignedGetUrl(key, 300)
    return reply.send({ url, title: track.title, expiresInSec: 300 })
  })
}

export default embedRoutes
