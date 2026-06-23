// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { PrismaClient } from '@tahti/db'
import {
  ChannelProgrammePatchSchema,
  ChannelProgrammePromoteSchema,
  ChannelProgrammeViewSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'

const ARCHIVE_ITEM_SELECT = {
  id: true,
  title: true,
  status: true,
  durationSec: true,
  isFallback: true,
  fallbackOrder: true,
  lastFallbackPlayedAt: true,
  createdAt: true,
} as const

async function fetchProgrammeView(prisma: PrismaClient, channelId: string, userId: string) {
  const [channel, items, tracks] = await Promise.all([
    prisma.channel.findUnique({
      where: { id: channelId },
      select: { fallbackMode: true, fallbackEnabled: true },
    }),
    prisma.archiveItem.findMany({
      where: { channelId, status: 'READY' },
      orderBy: [{ fallbackOrder: 'asc' }, { createdAt: 'asc' }],
      select: ARCHIVE_ITEM_SELECT,
    }),
    prisma.releaseTrack.findMany({
      where: { release: { userId }, status: 'READY' },
      orderBy: [{ createdAt: 'asc' }],
      select: {
        id: true,
        title: true,
        durationSec: true,
        archiveItemId: true,
        release: { select: { id: true, title: true } },
      },
    }),
  ])

  return {
    fallbackMode: channel?.fallbackMode ?? 'shuffle',
    fallbackEnabled: channel?.fallbackEnabled ?? true,
    items,
    library: tracks.map((t) => ({
      releaseTrackId: t.id,
      releaseId: t.release.id,
      releaseTitle: t.release.title,
      trackTitle: t.title,
      durationSec: t.durationSec,
      archiveItemId: t.archiveItemId,
    })),
  }
}

const meProgrammeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/channel/programme',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M22: fallback programme (offline playback order)',
        response: openApiResponse(ChannelProgrammeViewSchema, 'ChannelProgramme'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      return reply.send(await fetchProgrammeView(fastify.prisma, channel.id, user.id))
    },
  )

  fastify.patch(
    '/api/me/channel/programme',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ChannelProgrammeViewSchema, 'ChannelProgramme'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = ChannelProgrammePatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      if (
        parsed.data.fallbackMode === undefined &&
        parsed.data.fallbackEnabled === undefined &&
        parsed.data.items === undefined
      ) {
        return reply.status(400).send({ error: 'fallbackMode, fallbackEnabled, or items required' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      if (parsed.data.fallbackMode !== undefined || parsed.data.fallbackEnabled !== undefined) {
        await fastify.prisma.channel.update({
          where: { id: channel.id },
          data: {
            ...(parsed.data.fallbackMode !== undefined
              ? { fallbackMode: parsed.data.fallbackMode }
              : {}),
            ...(parsed.data.fallbackEnabled !== undefined
              ? { fallbackEnabled: parsed.data.fallbackEnabled }
              : {}),
          },
        })
      }

      if (parsed.data.items !== undefined) {
        const ids = parsed.data.items.map((i) => i.archiveItemId)
        const owned = await fastify.prisma.archiveItem.findMany({
          where: { channelId: channel.id, id: { in: ids } },
          select: { id: true },
        })
        const ownedIds = new Set(owned.map((o) => o.id))
        for (const row of parsed.data.items) {
          if (!ownedIds.has(row.archiveItemId)) {
            return reply.status(400).send({ error: `Unknown archive item ${row.archiveItemId}` })
          }
        }

        await fastify.prisma.$transaction(
          parsed.data.items.map((row) =>
            fastify.prisma.archiveItem.update({
              where: { id: row.archiveItemId },
              data: {
                isFallback: row.isFallback,
                ...(row.fallbackOrder !== undefined ? { fallbackOrder: row.fallbackOrder } : {}),
              },
            }),
          ),
        )
      }

      return reply.send(await fetchProgrammeView(fastify.prisma, channel.id, user.id))
    },
  )

  // M33: pull a published release track into the 24/7 rotation alongside archive sets.
  // Reuses ArchiveItem as the single rotation/playback source of truth — the worker's
  // fallback cache (archive-fallback-cache.ts) and Liquidsoap never need to know a row
  // originated from the release library.
  fastify.post(
    '/api/me/channel/programme/library',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M33: add a release track to the 24/7 rotation',
        response: openApiResponse(ChannelProgrammeViewSchema, 'ChannelProgramme'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = ChannelProgrammePromoteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const track = await fastify.prisma.releaseTrack.findFirst({
        where: { id: parsed.data.releaseTrackId, release: { userId: user.id }, status: 'READY' },
        select: {
          id: true,
          title: true,
          durationSec: true,
          streamKey: true,
          flacKey: true,
          archiveItemId: true,
          release: { select: { title: true } },
        },
      })
      if (!track) return reply.status(404).send({ error: 'Release track not found' })

      if (track.archiveItemId) {
        await fastify.prisma.archiveItem.update({
          where: { id: track.archiveItemId },
          data: { isFallback: true },
        })
        return reply.send(await fetchProgrammeView(fastify.prisma, channel.id, user.id))
      }

      if (!track.streamKey && !track.flacKey) {
        return reply.status(400).send({ error: 'Track has no playable audio yet' })
      }

      const maxOrder = await fastify.prisma.archiveItem.aggregate({
        where: { channelId: channel.id },
        _max: { fallbackOrder: true },
      })

      const archiveItem = await fastify.prisma.archiveItem.create({
        data: {
          channelId: channel.id,
          title: `${track.release.title} — ${track.title}`,
          durationSec: track.durationSec,
          mp3Key: track.streamKey,
          flacKey: track.flacKey,
          status: 'READY',
          contentType: 'ORIGINAL',
          source: 'UPLOAD',
          isPublic: false,
          isFallback: true,
          fallbackOrder: (maxOrder._max.fallbackOrder ?? -1) + 1,
        },
        select: { id: true },
      })
      await fastify.prisma.releaseTrack.update({
        where: { id: track.id },
        data: { archiveItemId: archiveItem.id },
      })

      return reply.send(await fetchProgrammeView(fastify.prisma, channel.id, user.id))
    },
  )
}

export default meProgrammeRoutes
