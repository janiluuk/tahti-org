// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ChannelListResponseSchema, openApiResponse, parseSocialLinksGenres } from '@tahti/shared'
import { getCachedJson } from '../../lib/json-cache.js'
import { config } from '../../config.js'
import { liveHlsUrl } from '../../lib/stream-quality.js'

const NOW_PLAYING_STALE_MS = 2 * 60 * 1000

const channelListRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/channels',
    {
      schema: {
        tags: ['channel'],
        description: 'Public channel directory — live now + recently active',
        response: openApiResponse(ChannelListResponseSchema, 'ChannelList'),
      },
    },
    async (_request, reply) => {
      const cardSelect = {
        slug: true,
        state: true,
        goneLiveAt: true,
        nextBroadcastAt: true,
        nextBroadcastNote: true,
        fallbackEnabled: true,
        nowPlayingTitle: true,
        nowPlayingArtistName: true,
        nowPlayingArtworkUrl: true,
        nowPlayingUpdatedAt: true,
        user: {
          select: {
            username: true,
            displayName: true,
            bio: true,
            avatarUrl: true,
            socialLinks: true,
            tier: true,
          },
        },
      } as const

      const result = await getCachedJson('channels:list', 10, async () => {
        const [liveChannels, replayingChannels, recentChannels] = await Promise.all([
          // goneLiveAt (not just state:'LIVE') is what actually means "a human is
          // broadcasting right now" — channel-fallback-reconciler.ts also sets
          // state:'LIVE' when it bootstraps a fallbackEnabled channel's 24/7
          // rotation, without touching goneLiveAt, so state alone can't tell a
          // real broadcast from the archive just looping (same distinction as
          // dashboard/layout.tsx's isOnline vs isReallyLive). Without the
          // goneLiveAt filter here, a rotation-only channel would show up
          // labeled "Live now" on Discover instead of "Replay".
          fastify.prisma.channel.findMany({
            where: { state: 'LIVE', goneLiveAt: { not: null }, user: { deletedAt: null } },
            orderBy: { goneLiveAt: 'desc' },
            take: 20,
            select: cardSelect,
          }),
          // Not really live, but airing their 24/7 archive rotation right now —
          // the "REPLAY" tier, same concept as Tahti Radio's own REPLAY badge.
          // Covers both the ordinary case (state left OFFLINE while fallback
          // audio streams) and the state:'LIVE'-but-goneLiveAt-null case above.
          fastify.prisma.channel.findMany({
            where: {
              OR: [
                { state: { not: 'LIVE' }, fallbackEnabled: true },
                { state: 'LIVE', goneLiveAt: null },
              ],
              user: { deletedAt: null },
            },
            orderBy: { goneLiveAt: 'desc' },
            take: 20,
            select: cardSelect,
          }),
          fastify.prisma.channel.findMany({
            // Exact OFFLINE match, not just "not LIVE" — a channel mid-PREVIEW (testing,
            // not yet public) must not surface in the public "recently active" list.
            // fallbackEnabled: false — those are covered by the "replaying" tier above,
            // not "recently active" (they're airing right now, not just recently).
            where: {
              state: 'OFFLINE',
              goneLiveAt: { not: null },
              fallbackEnabled: false,
              user: { deletedAt: null },
            },
            orderBy: { goneLiveAt: 'desc' },
            take: 20,
            select: cardSelect,
          }),
        ])

        const toCard = (ch: (typeof liveChannels)[0]) => {
          const { tier, ...userRest } = ch.user
          const nowPlayingFresh =
            ch.nowPlayingUpdatedAt != null &&
            Date.now() - ch.nowPlayingUpdatedAt.getTime() < NOW_PLAYING_STALE_MS
          const nowPlaying =
            nowPlayingFresh && ch.nowPlayingTitle && ch.nowPlayingArtistName
              ? {
                  title: ch.nowPlayingTitle,
                  artistName: ch.nowPlayingArtistName,
                  artworkUrl: ch.nowPlayingArtworkUrl,
                }
              : null

          return {
            slug: ch.slug,
            state: ch.state,
            goneLiveAt: ch.goneLiveAt?.toISOString() ?? null,
            nextBroadcastAt: ch.nextBroadcastAt?.toISOString() ?? null,
            nextBroadcastNote: ch.nextBroadcastNote,
            fallbackEnabled: ch.fallbackEnabled,
            genres: parseSocialLinksGenres(ch.user.socialLinks),
            hlsUrl: ch.state === 'LIVE' ? liveHlsUrl(config.hlsBaseUrl, ch.slug, tier) : null,
            nowPlaying,
            user: userRest,
          }
        }

        return {
          live: liveChannels.map(toCard),
          replaying: replayingChannels.map(toCard),
          recent: recentChannels.map(toCard),
        }
      })

      return reply.send(result)
    },
  )
}

export default channelListRoute
