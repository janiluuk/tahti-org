// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Minimal, cacheable HTML documents carrying just <title>/<meta> tags, for
// non-JS-executing link-preview bots (Facebook, Twitter/X, Slack, Discord,
// iMessage) that would otherwise see the SPA's single static index.html for
// every /c, /u, /r, /t, /v route. Real browsers and JS-executing crawlers never hit
// these directly — the web edge only proxies known bot user agents here.
// See tahti-player's packages/tahti-web/SEO-OG-NOTES.md for the plan
// this implements.

import type { FastifyPluginAsync } from 'fastify'
import {
  IdParamSchema,
  SlugParamSchema,
  SmartLinkSlugParamSchema,
  UsernameParamSchema,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../config.js'
import { resolveArtistUrl } from '../lib/artist-url.js'
import { resolveChannelUrl } from '../lib/channel-url.js'
import { resolveCollectionCoverUrl } from '../lib/collection-cover.js'
import { resolveReleaseArtworkUrl } from '../lib/release-artwork.js'
import { trackArtistName, userName } from '../lib/safe-names.js'

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ogPage(opts: {
  title: string
  description: string
  image: string | null
  url: string
  noindex?: boolean
}): string {
  const { title, description, image, url } = opts
  const imageTag = image ? `\n    <meta property="og:image" content="${escapeHtml(image)}" />` : ''
  const robotsTag = opts.noindex ? '\n    <meta name="robots" content="noindex" />' : ''
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />${robotsTag}
    <link rel="canonical" href="${escapeHtml(url)}" />
    <meta property="og:type" content="website" />
    <meta property="og:title" content="${escapeHtml(title)}" />
    <meta property="og:description" content="${escapeHtml(description)}" />
    <meta property="og:url" content="${escapeHtml(url)}" />${imageTag}
    <meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(description)}</p>
  </body>
</html>
`
}

function notFoundPage(
  reply: { status: (n: number) => { type: (t: string) => { send: (b: string) => unknown } } },
  url: string,
) {
  return reply
    .status(404)
    .type('text/html')
    .send(
      ogPage({
        title: 'Not found · Tahti',
        description: 'This page could not be found.',
        image: null,
        url,
      }),
    )
}

const CACHE_CONTROL = 'public, max-age=300'

const ogRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/api/og/channel/:slug', async (request, reply) => {
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { slug } = routeParams
    const url = resolveChannelUrl(slug)

    const channel = await fastify.prisma.channel.findUnique({
      where: { slug },
      select: {
        user: { select: { username: true, displayName: true, bio: true, avatarUrl: true } },
      },
    })
    if (!channel) return notFoundPage(reply, url)

    const name = userName(channel.user)
    reply.header('Cache-Control', CACHE_CONTROL)
    return reply.type('text/html').send(
      ogPage({
        title: `${name} live on Tahti`,
        description:
          channel.user.bio || `Listen to ${name}'s live channel, sound, and programme on Tahti.`,
        image: channel.user.avatarUrl,
        url,
      }),
    )
  })

  fastify.get('/api/og/profile/:username', async (request, reply) => {
    const routeParams = parseRouteParams(UsernameParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { username } = routeParams
    const url = resolveArtistUrl(username)

    const user = await fastify.prisma.user.findUnique({
      where: { username },
      select: { username: true, displayName: true, bio: true, avatarUrl: true },
    })
    if (!user) return notFoundPage(reply, url)
    const name = userName(user)

    reply.header('Cache-Control', CACHE_CONTROL)
    return reply.type('text/html').send(
      ogPage({
        title: `${name} on Tahti`,
        description:
          user.bio || `Explore ${name}'s music, releases, collections, and live channel on Tahti.`,
        image: user.avatarUrl,
        url,
      }),
    )
  })

  fastify.get('/api/og/release/:smartLinkSlug', async (request, reply) => {
    const routeParams = parseRouteParams(SmartLinkSlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { smartLinkSlug } = routeParams
    const url = `${config.appUrl.replace(/\/$/, '')}/r/${smartLinkSlug}`

    const release = await fastify.prisma.release.findFirst({
      where: { smartLinkSlug, state: 'PUBLISHED' },
      select: {
        title: true,
        description: true,
        artworkUrl: true,
        artworkKey: true,
        user: { select: { username: true, displayName: true, avatarUrl: true } },
      },
    })
    if (!release) return notFoundPage(reply, url)

    const image = (await resolveReleaseArtworkUrl(release)) ?? release.user.avatarUrl
    reply.header('Cache-Control', CACHE_CONTROL)
    return reply.type('text/html').send(
      ogPage({
        title: `${release.title} by ${userName(release.user)} on Tahti`,
        description:
          release.description || `Listen to ${release.title} and find its official links on Tahti.`,
        image,
        url,
      }),
    )
  })

  // Public, finished tracks only: a private track's share link (?key=) must
  // not hand its title to whichever bot unfurls it.
  fastify.get('/api/og/track/:id', async (request, reply) => {
    const routeParams = parseRouteParams(IdParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { id } = routeParams
    const url = `${config.appUrl.replace(/\/$/, '')}/t/${encodeURIComponent(id)}`

    const track = await fastify.prisma.sound.findFirst({
      where: {
        id,
        isPublic: true,
        status: 'READY',
        channel: { user: { deletedAt: null, suspendedAt: null } },
      },
      select: {
        title: true,
        artistName: true,
        description: true,
        bannerUrl: true,
        channel: {
          select: { user: { select: { username: true, displayName: true, avatarUrl: true } } },
        },
      },
    })
    if (!track) return notFoundPage(reply, url)

    const artist = trackArtistName(track)
    reply.header('Cache-Control', CACHE_CONTROL)
    return reply.type('text/html').send(
      ogPage({
        title: `${track.title} by ${artist} on Tahti`,
        description: track.description || `Listen to ${track.title} by ${artist} on Tahti.`,
        image: track.bannerUrl ?? track.channel.user.avatarUrl,
        url,
      }),
    )
  })

  // Verified venues only, matching GET /api/v1/venues/:slug.
  fastify.get('/api/og/venue/:slug', async (request, reply) => {
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { slug } = routeParams
    const url = `${config.appUrl.replace(/\/$/, '')}/v/${encodeURIComponent(slug)}`

    const venue = await fastify.prisma.venue.findFirst({
      where: { slug, verifiedAt: { not: null } },
      select: { name: true, city: true, description: true, photos: true },
    })
    if (!venue) return notFoundPage(reply, url)

    reply.header('Cache-Control', CACHE_CONTROL)
    return reply.type('text/html').send(
      ogPage({
        title: `${venue.name}, ${venue.city} on Tahti`,
        description:
          venue.description || `Live sets and upcoming broadcasts from ${venue.name} on Tahti.`,
        image: venue.photos[0] ?? null,
        url,
      }),
    )
  })

  // Slug is globally unique (Collection.slug @unique) — no username needed
  // to look it up, even though the canonical URL nests it under one
  // (/u/:username/c/:slug) for readability. Matches the SPA's own
  // fetchCollection(slug) call.
  fastify.get('/api/og/collection/:slug', async (request, reply) => {
    const routeParams = parseRouteParams(SlugParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const { slug } = routeParams

    const collection = await fastify.prisma.collection.findUnique({
      where: { slug },
      select: {
        name: true,
        description: true,
        isPublic: true,
        visibility: true,
        coverUrl: true,
        coverKey: true,
        user: { select: { username: true, displayName: true, avatarUrl: true } },
      },
    })
    const fallbackUrl = `${config.appUrl.replace(/\/$/, '')}/u/${collection?.user.username ?? ''}/c/${slug}`
    if (!collection || (!collection.isPublic && collection.visibility !== 'UNLISTED')) {
      return notFoundPage(reply, fallbackUrl)
    }

    const url = `${config.appUrl.replace(/\/$/, '')}/u/${collection.user.username}/c/${slug}`
    const image = (await resolveCollectionCoverUrl(collection)) ?? collection.user.avatarUrl
    const owner = userName(collection.user)
    reply.header('Cache-Control', CACHE_CONTROL)
    return reply.type('text/html').send(
      ogPage({
        title: `${collection.name} by ${owner} on Tahti`,
        description:
          collection.description ||
          `Listen to ${collection.name}, a collection by ${owner} on Tahti.`,
        image,
        url,
        noindex: !collection.isPublic,
      }),
    )
  })
}

export default ogRoutes
