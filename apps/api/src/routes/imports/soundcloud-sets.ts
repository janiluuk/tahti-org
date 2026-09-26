// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// SoundCloud playlists/sets for the Tahti Player desktop "download a set into
// the local library" flow: list and resolve the connected user's sets, and hand
// out per-track download links that redirect to SoundCloud's file without
// exposing the OAuth token. Only tracks SoundCloud marks as downloadable get a
// link; streams are never offered.

import type { FastifyPluginAsync, FastifyReply } from 'fastify'
import {
  SoundcloudPlaylistTracksResponseSchema,
  SoundcloudPlaylistsResponseSchema,
  SoundcloudResolvePlaylistResponseSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { decryptStreamKey } from '../../lib/stream-key-enc.js'
import {
  SOUNDCLOUD_API,
  SoundcloudApiError,
  isSoundcloudHost,
  mapPlaylist,
  mapTrack,
  soundcloudCollect,
  soundcloudGet,
  type ScPlaylist,
  type ScTrack,
} from '../../lib/soundcloud-api.js'
import { verifySoundcloudTicket } from '../../lib/soundcloud-download-ticket.js'

const MAX_PLAYLIST_PAGES = 5
const MAX_TRACK_PAGES = 25
const LINK_HOSTS = ['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com', 'on.soundcloud.com']

const soundcloudSetRoutes: FastifyPluginAsync = async (fastify) => {
  async function tokenFor(userId: string): Promise<string | null> {
    const row = await fastify.prisma.user.findUnique({
      where: { id: userId },
      select: { soundcloudAccessTokenEnc: true, deletedAt: true },
    })
    if (!row?.soundcloudAccessTokenEnc || row.deletedAt) return null
    return decryptStreamKey(row.soundcloudAccessTokenEnc)
  }

  async function sendUpstreamError(reply: FastifyReply, userId: string, err: unknown) {
    if (!(err instanceof SoundcloudApiError)) throw err
    if (err.status === 401) {
      await fastify.prisma.user.update({
        where: { id: userId },
        data: { soundcloudAccessTokenEnc: null },
      })
    }
    return reply.status(err.status).send({ error: err.message })
  }

  fastify.get(
    '/api/me/soundcloud/playlists',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description: "The connected user's SoundCloud playlists/sets, without tracks",
        response: openApiResponse(SoundcloudPlaylistsResponseSchema, 'SoundcloudPlaylistsResponse'),
      },
    },
    async (request, reply) => {
      const userId = request.sessionUser!.id
      const token = await tokenFor(userId)
      if (!token) return reply.status(403).send({ error: 'SoundCloud account not connected' })
      try {
        const playlists = await soundcloudCollect<ScPlaylist>(
          token,
          `${SOUNDCLOUD_API}/me/playlists?show_tracks=false&linked_partitioning=true&limit=50`,
          MAX_PLAYLIST_PAGES,
        )
        return reply.send({ playlists: playlists.map(mapPlaylist) })
      } catch (err) {
        return sendUpstreamError(reply, userId, err)
      }
    },
  )

  fastify.get<{ Params: { id: string } }>(
    '/api/me/soundcloud/playlists/:id/tracks',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description:
          'Tracks of one SoundCloud playlist in order; downloadable ones carry a short-lived download link',
        response: openApiResponse(
          SoundcloudPlaylistTracksResponseSchema,
          'SoundcloudPlaylistTracksResponse',
        ),
      },
    },
    async (request, reply) => {
      const { id } = request.params
      if (!/^\d+$/.test(id)) return reply.status(400).send({ error: 'Invalid playlist id' })
      const userId = request.sessionUser!.id
      const token = await tokenFor(userId)
      if (!token) return reply.status(403).send({ error: 'SoundCloud account not connected' })
      try {
        const tracks = await soundcloudCollect<ScTrack>(
          token,
          `${SOUNDCLOUD_API}/playlists/${id}/tracks?linked_partitioning=true&limit=200&access=playable,preview,blocked`,
          MAX_TRACK_PAGES,
        )
        const now = Date.now()
        return reply.send({ tracks: tracks.map((track) => mapTrack(track, userId, now)) })
      } catch (err) {
        return sendUpstreamError(reply, userId, err)
      }
    },
  )

  fastify.get<{ Querystring: { url?: string } }>(
    '/api/me/soundcloud/resolve',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['imports'],
        description: 'Resolve a pasted SoundCloud set link to a playlist',
        response: openApiResponse(
          SoundcloudResolvePlaylistResponseSchema,
          'SoundcloudResolvePlaylistResponse',
        ),
      },
    },
    async (request, reply) => {
      let link: URL
      try {
        link = new URL(request.query.url?.trim() ?? '')
      } catch {
        return reply.status(400).send({ error: 'Paste a SoundCloud set link' })
      }
      if (!isSoundcloudHost(link, LINK_HOSTS)) {
        return reply.status(400).send({ error: 'Paste a SoundCloud set link' })
      }
      const userId = request.sessionUser!.id
      const token = await tokenFor(userId)
      if (!token) return reply.status(403).send({ error: 'SoundCloud account not connected' })
      try {
        const resource = await soundcloudGet<ScPlaylist>(
          token,
          `${SOUNDCLOUD_API}/resolve?url=${encodeURIComponent(link.toString())}`,
        )
        if (resource.kind !== 'playlist') {
          return reply.status(422).send({ error: 'That link is not a SoundCloud set or playlist' })
        }
        return reply.send({ playlist: mapPlaylist(resource) })
      } catch (err) {
        return sendUpstreamError(reply, userId, err)
      }
    },
  )

  // Public on purpose: the desktop downloader has no Tahti session. The signed
  // ticket names the user and the track and expires; HEAD works too (Fastify
  // answers it with this handler), which the desktop app uses to size a set.
  fastify.get<{ Params: { trackId: string }; Querystring: { ticket?: string } }>(
    '/api/v1/imports/soundcloud/tracks/:trackId/download',
    { schema: { hide: true } },
    async (request, reply) => {
      reply.header('Cache-Control', 'no-store')
      reply.header('Referrer-Policy', 'no-referrer')
      const check = verifySoundcloudTicket(request.query.ticket ?? '')
      if (!check.ok || check.trackId !== request.params.trackId) {
        return !check.ok && check.reason === 'expired'
          ? reply.status(410).send({ error: 'Download link expired. Reload the set' })
          : reply.status(404).send({ error: 'Unknown download link' })
      }
      const token = await tokenFor(check.userId)
      if (!token) return reply.status(403).send({ error: 'SoundCloud account not connected' })

      try {
        // Re-check on every use: the uploader can turn downloads off at any time.
        const track = await soundcloudGet<ScTrack>(
          token,
          `${SOUNDCLOUD_API}/tracks/${check.trackId}`,
        )
        if (!track.downloadable || !track.download_url) {
          return reply.status(403).send({ error: 'This track is no longer offered for download' })
        }
        const downloadUrl = new URL(track.download_url)
        if (!isSoundcloudHost(downloadUrl)) {
          return reply.status(502).send({ error: 'Unexpected SoundCloud download link' })
        }
        const res = await fetch(downloadUrl, {
          headers: { Authorization: `OAuth ${token}` },
          redirect: 'manual',
        })
        const location = res.headers.get('location')
        await res.body?.cancel()
        if (res.status === 401) {
          throw new SoundcloudApiError(401, 'SoundCloud token expired. Reconnect SoundCloud')
        }
        if (res.status >= 300 && res.status < 400 && location) {
          return reply.redirect(new URL(location, downloadUrl).toString(), 302)
        }
        return reply.status(502).send({ error: 'SoundCloud did not hand out the file' })
      } catch (err) {
        return sendUpstreamError(reply, check.userId, err)
      }
    },
  )
}

export default soundcloudSetRoutes
