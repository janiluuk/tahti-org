// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Minimal, cacheable HTML documents carrying just <title>/<meta> tags, for
// non-JS-executing link-preview bots (Facebook, Twitter/X, Slack, Discord,
// iMessage) that would otherwise see the SPA's single static index.html for
// every /c, /u, /r route. Real browsers and JS-executing crawlers never hit
// these directly — the web edge only proxies known bot user agents here.
// See tahti-nuclear-player's packages/tahti-web/SEO-OG-NOTES.md for the plan
// this implements.

import type { FastifyPluginAsync } from 'fastify'
import {
  SlugParamSchema,
  SmartLinkSlugParamSchema,
  UsernameParamSchema,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../config.js'
import { resolveArtistUrl } from '../lib/artist-url.js'
import { resolveChannelUrl } from '../lib/channel-url.js'
import { resolveReleaseArtworkUrl } from '../lib/release-artwork.js'

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
}): string {
  const { title, description, image, url } = opts
  const imageTag = image ? `\n    <meta property="og:image" content="${escapeHtml(image)}" />` : ''
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <meta name="description" content="${escapeHtml(description)}" />
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
      select: { user: { select: { displayName: true, bio: true, avatarUrl: true } } },
    })
    if (!channel) return notFoundPage(reply, url)

    const name = channel.user.displayName
    reply.header('Cache-Control', CACHE_CONTROL)
    return reply.type('text/html').send(
      ogPage({
        title: `${name} live on Tahti`,
        description:
          channel.user.bio || `Listen to ${name}'s live channel, archive, and programme on Tahti.`,
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
      select: { displayName: true, bio: true, avatarUrl: true },
    })
    if (!user) return notFoundPage(reply, url)

    reply.header('Cache-Control', CACHE_CONTROL)
    return reply.type('text/html').send(
      ogPage({
        title: `${user.displayName} on Tahti`,
        description:
          user.bio ||
          `Explore ${user.displayName}'s music, releases, collections, and live channel on Tahti.`,
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
        user: { select: { displayName: true, avatarUrl: true } },
      },
    })
    if (!release) return notFoundPage(reply, url)

    const image = (await resolveReleaseArtworkUrl(release)) ?? release.user.avatarUrl
    reply.header('Cache-Control', CACHE_CONTROL)
    return reply.type('text/html').send(
      ogPage({
        title: `${release.title} by ${release.user.displayName} on Tahti`,
        description:
          release.description || `Listen to ${release.title} and find its official links on Tahti.`,
        image,
        url,
      }),
    )
  })
}

export default ogRoutes
