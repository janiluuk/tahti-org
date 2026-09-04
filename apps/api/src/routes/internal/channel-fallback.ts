// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { PrismaClient } from '@tahti/db'
import {
  ChannelIdParamSchema,
  FallbackM3uBodySchema,
  PlainTextErrorSchema,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { config } from '../../config.js'
import { presignedGetUrl } from '../../lib/minio.js'
import {
  soundPlaybackKey,
  buildFallbackPlaybackRows,
  interleaveAnnouncements,
  renderFallbackM3u,
  applyFallbackRotationSync,
  TAHTI_RADIO_SLUG,
  TAHTI_SELECTS_SLUG,
} from '@tahti/shared'
import type { AnnouncementPlaybackRow, FallbackM3uEntry, FallbackPlaybackRow } from '@tahti/shared'

// reload_mode="rounds" in the Liquidsoap template means the playlist can go a long
// time between refetches for a small pool (300 rounds through a handful of tracks),
// so the presigned URLs handed out here need to comfortably outlive that — a short
// TTL would silently start 403ing again mid-rotation, exactly like the bug this
// replaced (tahti/mp3 isn't publicly readable, unlike covers/avatars/sound banners).
const FALLBACK_URL_TTL_SEC = 24 * 60 * 60

async function curatedRows(
  prisma: PrismaClient,
  channelId: string,
): Promise<FallbackPlaybackRow[]> {
  const curated = await prisma.curatedRotationItem.findMany({
    where: { channelId },
    orderBy: { position: 'asc' },
    select: {
      sound: {
        select: { id: true, title: true, mp3Key: true, flacKey: true, durationSec: true },
      },
    },
  })

  const rows: FallbackPlaybackRow[] = []
  for (const { sound } of curated) {
    const playbackKey = soundPlaybackKey(sound)
    if (!playbackKey) continue
    rows.push({
      id: sound.id,
      title: sound.title,
      playbackKey,
      durationSec: sound.durationSec,
    })
  }
  return rows
}

// Manage panel playlist switch: a Collection's sound-item-backed entries, in
// position order. Release-backed entries have no single playback file of their
// own (a release is itself a multi-track grouping) so they're skipped here —
// same limitation as any other single-file rotation source.
async function collectionRows(
  prisma: PrismaClient,
  collectionId: string,
): Promise<FallbackPlaybackRow[]> {
  const items = await prisma.collectionItem.findMany({
    where: { collectionId, soundId: { not: null } },
    orderBy: { position: 'asc' },
    select: {
      sound: {
        select: { id: true, title: true, mp3Key: true, flacKey: true, durationSec: true },
      },
    },
  })

  const rows: FallbackPlaybackRow[] = []
  for (const { sound } of items) {
    if (!sound) continue
    const playbackKey = soundPlaybackKey(sound)
    if (!playbackKey) continue
    rows.push({
      id: sound.id,
      title: sound.title,
      playbackKey,
      durationSec: sound.durationSec,
    })
  }
  return rows
}

// System (admin-managed) announcement clips, gated on the global kill-switch
// (AnnouncementSettings singleton — absent row means "on", matching its
// schema default) as well as each clip's own isEnabled.
async function systemAnnouncementRows(prisma: PrismaClient): Promise<AnnouncementPlaybackRow[]> {
  const settings = await prisma.announcementSettings.findUnique({ where: { id: 'global' } })
  if (settings && !settings.systemEnabled) return []

  const clips = await prisma.announcementClip.findMany({
    where: { channelId: null, isEnabled: true },
    select: {
      id: true,
      title: true,
      audioKey: true,
      durationSec: true,
      scheduleMode: true,
      everyNth: true,
    },
  })
  return clips.map((c) => ({
    id: c.id,
    title: c.title,
    playbackKey: c.audioKey,
    durationSec: c.durationSec,
    scheduleMode: c.scheduleMode,
    everyNth: c.everyNth,
  }))
}

// A channel's own announcement library — caller checks Channel.announcementsEnabled first.
async function ownAnnouncementRows(
  prisma: PrismaClient,
  channelId: string,
): Promise<FallbackPlaybackRow[]> {
  const clips = await prisma.announcementClip.findMany({
    where: { channelId, isEnabled: true },
    select: { id: true, title: true, audioKey: true, durationSec: true },
  })
  return clips.map((c) => ({
    id: c.id,
    title: c.title,
    playbackKey: c.audioKey,
    durationSec: c.durationSec,
  }))
}

async function toM3uEntries(rows: FallbackPlaybackRow[]): Promise<FallbackM3uEntry[]> {
  return Promise.all(
    rows.map(async (row) => ({
      title: row.title,
      durationSec: row.durationSec,
      // STREAM-013: "s3get:" prefix routes through the custom protocol resolver
      // registered in the .liq templates — Liquidsoap's stdlib http(s) resolver
      // corrupts these presigned URLs' query strings (see the template for the
      // full writeup). This M3U is only ever fetched by Liquidsoap, never a
      // browser, so the non-standard scheme is safe to hand out here.
      url: `s3get:${await presignedGetUrl(row.playbackKey, FALLBACK_URL_TTL_SEC)}`,
    })),
  )
}

// Liquidsoap calls this to get the current fallback playlist for a channel.
// Returns an extended M3U with presigned HTTP URLs to sound playback files (MP3 or FLAC).
const channelFallbackRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/internal/channels/:channelId/fallback.m3u',
    {
      schema: {
        tags: ['internal'],
        response: openApiResponses([
          { status: 200, schema: FallbackM3uBodySchema, name: 'FallbackM3uBody' },
          { status: 401, schema: PlainTextErrorSchema, name: 'PlainTextError' },
          { status: 404, schema: PlainTextErrorSchema, name: 'PlainTextError' },
        ]),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(ChannelIdParamSchema, request.params)
      if (!routeParams) return reply.status(401).send('invalid path')
      const { channelId } = routeParams

      // Liquidsoap's playlist() fetches a bare URL and can't attach an Authorization
      // header, so it authenticates via a ?secret= query param instead. Every other
      // internal caller keeps using the header.
      const auth = (request.headers['authorization'] as string | undefined) ?? ''
      const secretParam = (request.query as { secret?: string } | undefined)?.secret ?? ''
      const authorized =
        auth === `Bearer ${config.internalSecret}` || secretParam === config.internalSecret
      if (!authorized) {
        return reply.status(401).send('unauthorized')
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { id: channelId },
        select: {
          slug: true,
          fallbackMode: true,
          fallbackEnabled: true,
          activeFallbackCollectionId: true,
          announcementsEnabled: true,
        },
      })
      if (!channel) {
        return reply.status(404).send('channel not found')
      }

      // Tahti Radio is the platform's flagship always-on station, not a regular
      // artist channel — it must never go silent, so its relay to Tahti Selects
      // below is unconditional. fallbackEnabled is a per-artist "opt into 24/7
      // rotation" toggle that has no equivalent meaning for Tahti Radio itself,
      // so it must not be able to suppress that relay the way it's meant to
      // suppress a regular channel's own fallback rotation.
      const isTahtiRadio = channel.slug === TAHTI_RADIO_SLUG

      let rows: FallbackPlaybackRow[] = []
      let playlistOrderStable = false

      if (!channel.fallbackEnabled && !isTahtiRadio) {
        // No rotation at all — nothing to interleave announcements into either.
        const body = renderFallbackM3u([])
        return reply.header('Content-Type', 'audio/x-mpegurl').send(body)
      }

      // Curated channels (e.g. Tahti Selects) have an explicit, ordered, cross-channel
      // playlist instead of the regular per-channel isFallback/fallbackOrder rotation.
      // Every other channel has zero CuratedRotationItem rows, so this is additive only.
      const curated = await curatedRows(fastify.prisma, channelId)
      if (curated.length > 0) {
        rows = curated
        playlistOrderStable = true
      } else if (channel.activeFallbackCollectionId) {
        // Manage panel playlist switch: repoints the rotation at a chosen Collection
        // instead of the default isFallback set. An empty collection (or one with no
        // playable sound-item entries) falls through to the default rotation below
        // rather than going silent.
        const chosen = await collectionRows(fastify.prisma, channel.activeFallbackCollectionId)
        if (chosen.length > 0) {
          rows = chosen
          playlistOrderStable = true
        }
      }

      if (rows.length === 0) {
        const items = channel.fallbackEnabled
          ? await fastify.prisma.sound.findMany({
              where: {
                channelId,
                status: 'READY',
                OR: [{ mp3Key: { not: null } }, { flacKey: { not: null } }],
              },
              select: {
                id: true,
                title: true,
                mp3Key: true,
                flacKey: true,
                durationSec: true,
                isFallback: true,
                fallbackOrder: true,
                lastFallbackPlayedAt: true,
                createdAt: true,
              },
            })
          : []
        rows = buildFallbackPlaybackRows(items, channel.fallbackMode)
        playlistOrderStable = channel.fallbackMode !== 'shuffle'
      }

      // Tahti Radio has no sound of its own — when nobody's booked a live slot and
      // it has no fallback tracks either, relay the Tahti Selects rotation live (read
      // fresh each request, not a static snapshot) instead of falling through to
      // Liquidsoap's blank() and going silent while still reporting as LIVE.
      if (rows.length === 0 && isTahtiRadio) {
        const selects = await fastify.prisma.channel.findUnique({
          where: { slug: TAHTI_SELECTS_SLUG },
          select: { id: true },
        })
        if (selects) {
          rows = await curatedRows(fastify.prisma, selects.id)
          if (rows.length > 0) playlistOrderStable = true
        }
      }

      const broadcast = await fastify.prisma.broadcast.findFirst({
        where: { channelId, endedAt: null },
        orderBy: { startedAt: 'desc' },
        select: { startedAt: true, wentLiveAt: true },
      })

      // 24/7 placeholder broadcasts never get wentLiveAt — wall-clock sync keeps
      // rotation continuous across Liquidsoap restarts. Position math uses tracks
      // only; announcements are spliced in afterward (random spacing would break
      // deterministic sync). Skip shuffle pools: order shifts between rebuilds.
      let seekOffsetSec: number | undefined
      if (broadcast && broadcast.wentLiveAt == null && rows.length > 0 && playlistOrderStable) {
        const synced = applyFallbackRotationSync(rows, broadcast.startedAt.getTime(), Date.now())
        rows = synced.rows
        seekOffsetSec = synced.position?.offsetSec
      }

      const [systemAnnouncements, ownAnnouncements] = await Promise.all([
        systemAnnouncementRows(fastify.prisma),
        channel.announcementsEnabled ? ownAnnouncementRows(fastify.prisma, channelId) : [],
      ])
      rows = interleaveAnnouncements(rows, systemAnnouncements, ownAnnouncements)

      const body = renderFallbackM3u(await toM3uEntries(rows), seekOffsetSec)

      return reply.header('Content-Type', 'audio/x-mpegurl').send(body)
    },
  )
}

export default channelFallbackRoute
