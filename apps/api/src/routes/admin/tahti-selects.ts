// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { TAHTI_SELECTS_SLUG } from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { spawnChannelLiquidsoap, stopOrchestratorChannel } from '../../lib/orchestrator.js'
import { buildTopList } from '../../lib/top-lists.js'

const AUTO_PLAYLIST_SIZE = 10

async function selectTopPlayedSoundIds(
  prisma: Parameters<FastifyPluginAsync>[0]['prisma'],
  limit: number,
  excludedIds: string[] = [],
): Promise<string[]> {
  const ranked = await buildTopList(prisma, { limit: 100 })
  const rankedIds = ranked.map((entry) => entry.soundId).filter((id) => !excludedIds.includes(id))
  const playableRanked = await prisma.sound.findMany({
    where: {
      id: { in: rankedIds },
      isPublic: true,
      status: 'READY',
      OR: [{ mp3Key: { not: null } }, { flacKey: { not: null } }],
    },
    select: { id: true },
  })
  const playableSet = new Set(playableRanked.map((item) => item.id))
  const selected = rankedIds.filter((id) => playableSet.has(id)).slice(0, limit)

  if (selected.length < limit) {
    const fallback = await prisma.sound.findMany({
      where: {
        id: { notIn: [...excludedIds, ...selected] },
        isPublic: true,
        status: 'READY',
        OR: [{ mp3Key: { not: null } }, { flacKey: { not: null } }],
      },
      orderBy: { createdAt: 'desc' },
      take: limit - selected.length,
      select: { id: true },
    })
    selected.push(...fallback.map((item) => item.id))
  }

  return selected
}

async function generateTopPlayedRotation(
  prisma: Parameters<FastifyPluginAsync>[0]['prisma'],
  channelId: string,
  addedById: string,
  mode: 'add' | 'replace',
) {
  const current = await prisma.curatedRotationItem.findMany({
    where: { channelId },
    orderBy: { position: 'asc' },
    select: { soundId: true },
  })
  const retainedIds = mode === 'add' ? current.map((item) => item.soundId) : []
  const pickedIds = await selectTopPlayedSoundIds(prisma, AUTO_PLAYLIST_SIZE, retainedIds)

  await prisma.$transaction(async (transaction) => {
    if (mode === 'replace') {
      await transaction.curatedRotationItem.deleteMany({ where: { channelId } })
    }
    const startPosition = mode === 'add' ? current.length : 0
    if (pickedIds.length > 0) {
      await transaction.curatedRotationItem.createMany({
        data: pickedIds.map((soundId, index) => ({
          channelId,
          soundId,
          position: startPosition + index,
          addedById,
        })),
      })
    }
  })

  return pickedIds.length
}

async function getTahtiSelectsChannelId(
  prisma: Parameters<FastifyPluginAsync>[0]['prisma'],
): Promise<string | null> {
  const channel = await prisma.channel.findUnique({
    where: { slug: TAHTI_SELECTS_SLUG },
    select: { id: true },
  })
  return channel?.id ?? null
}

const adminTahtiSelectsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/tahti-selects — current curated rotation, ordered
  fastify.get(
    '/api/admin/tahti-selects',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (_request, reply) => {
      const channelId = await getTahtiSelectsChannelId(fastify.prisma)
      if (!channelId) return reply.send({ items: [] })

      const items = await fastify.prisma.curatedRotationItem.findMany({
        where: { channelId },
        orderBy: { position: 'asc' },
        select: {
          id: true,
          position: true,
          createdAt: true,
          addedBy: { select: { displayName: true } },
          sound: {
            select: {
              id: true,
              title: true,
              durationSec: true,
              license: true,
              artistName: true,
              channel: { select: { slug: true, user: { select: { displayName: true } } } },
            },
          },
        },
      })

      return reply.send({
        items: items.map((item) => ({
          id: item.id,
          position: item.position,
          addedAt: item.createdAt,
          addedBy: item.addedBy.displayName,
          soundId: item.sound.id,
          title: item.sound.title,
          durationSec: item.sound.durationSec,
          license: item.sound.license,
          artistName: item.sound.artistName ?? item.sound.channel.user.displayName,
          channelSlug: item.sound.channel.slug,
        })),
      })
    },
  )

  // GET /api/admin/tahti-selects/browse?q= — search public sound items to add
  fastify.get(
    '/api/admin/tahti-selects/browse',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { q } = request.query as { q?: string }
      const items = await fastify.prisma.sound.findMany({
        where: {
          isPublic: true,
          status: 'READY',
          ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          title: true,
          durationSec: true,
          license: true,
          artistName: true,
          channel: { select: { slug: true, user: { select: { displayName: true } } } },
        },
      })

      return reply.send({
        items: items.map((item) => ({
          id: item.id,
          title: item.title,
          durationSec: item.durationSec,
          license: item.license,
          artistName: item.artistName ?? item.channel.user.displayName,
          channelSlug: item.channel.slug,
        })),
      })
    },
  )

  // POST /api/admin/tahti-selects/items — add { soundId } to the rotation
  fastify.post(
    '/api/admin/tahti-selects/items',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { soundId } = request.body as { soundId?: string }
      if (!soundId) return reply.status(400).send({ error: 'soundId required' })

      const channelId = await getTahtiSelectsChannelId(fastify.prisma)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Selects channel not found' })

      const sound = await fastify.prisma.sound.findUnique({
        where: { id: soundId },
        select: { isPublic: true },
      })
      if (!sound) return reply.status(404).send({ error: 'Sound item not found' })
      if (!sound.isPublic) {
        return reply.status(400).send({ error: 'Only public sound items can be curated' })
      }

      const existing = await fastify.prisma.curatedRotationItem.findUnique({
        where: { channelId_soundId: { channelId, soundId } },
      })
      if (existing) return reply.status(409).send({ error: 'Already in rotation' })

      const last = await fastify.prisma.curatedRotationItem.findFirst({
        where: { channelId },
        orderBy: { position: 'desc' },
        select: { position: true },
      })

      const item = await fastify.prisma.curatedRotationItem.create({
        data: {
          channelId,
          soundId,
          position: (last?.position ?? -1) + 1,
          addedById: request.sessionUser!.id,
        },
      })

      return reply.status(201).send({ ok: true as const, id: item.id })
    },
  )

  // DELETE /api/admin/tahti-selects/items/:id — remove from rotation
  fastify.delete(
    '/api/admin/tahti-selects/items/:id',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const item = await fastify.prisma.curatedRotationItem.findUnique({ where: { id } })
      if (!item) return reply.status(404).send({ error: 'Not found' })

      await fastify.prisma.curatedRotationItem.delete({ where: { id } })
      return reply.send({ ok: true as const })
    },
  )

  // PATCH /api/admin/tahti-selects/items/:id/reorder — { position }
  fastify.put(
    '/api/admin/tahti-selects/reorder',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const itemIds = (request.body as { itemIds?: unknown }).itemIds
      if (!Array.isArray(itemIds) || itemIds.some((id) => typeof id !== 'string')) {
        return reply.status(400).send({ error: 'itemIds array required' })
      }
      const channelId = await getTahtiSelectsChannelId(fastify.prisma)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Selects channel not found' })
      const current = await fastify.prisma.curatedRotationItem.findMany({
        where: { channelId },
        select: { id: true },
      })
      const currentIds = new Set(current.map((item) => item.id))
      if (itemIds.length !== currentIds.size || itemIds.some((id) => !currentIds.has(id))) {
        return reply.status(400).send({ error: 'itemIds must match the current rotation' })
      }
      await fastify.prisma.$transaction(
        itemIds.map((id, position) =>
          fastify.prisma.curatedRotationItem.update({ where: { id }, data: { position } }),
        ),
      )
      return reply.send({ ok: true as const })
    },
  )

  fastify.patch(
    '/api/admin/tahti-selects/items/:id/reorder',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { position } = request.body as { position?: number }
      if (typeof position !== 'number' || position < 0) {
        return reply.status(400).send({ error: 'position required' })
      }

      const item = await fastify.prisma.curatedRotationItem.findUnique({ where: { id } })
      if (!item) return reply.status(404).send({ error: 'Not found' })

      const siblings = await fastify.prisma.curatedRotationItem.findMany({
        where: { channelId: item.channelId },
        orderBy: { position: 'asc' },
        select: { id: true },
      })
      const reordered = siblings.filter((s) => s.id !== id).map((s) => s.id)
      reordered.splice(Math.min(position, reordered.length), 0, id)

      await fastify.prisma.$transaction(
        reordered.map((itemId, index) =>
          fastify.prisma.curatedRotationItem.update({
            where: { id: itemId },
            data: { position: index },
          }),
        ),
      )

      return reply.send({ ok: true as const })
    },
  )

  // POST /api/admin/tahti-selects/stream/start — spawn the always-on rotation Liquidsoap
  // container (the curated playlist above becomes an actual HLS/Icecast stream).
  fastify.post(
    '/api/admin/tahti-selects/stream/start',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const channel = await fastify.prisma.channel.findUnique({
        where: { slug: TAHTI_SELECTS_SLUG },
        select: { id: true, slug: true },
      })
      if (!channel) {
        return reply.status(404).send({
          error:
            'Tahti Selects channel not found — run scripts/seed-tahti-selects-content.ts first',
        })
      }

      const rotationCount = await fastify.prisma.curatedRotationItem.count({
        where: { channelId: channel.id },
      })
      if (rotationCount === 0) {
        const added = await generateTopPlayedRotation(
          fastify.prisma,
          channel.id,
          request.sessionUser!.id,
          'replace',
        )
        if (added === 0) {
          return reply.status(409).send({
            error: 'No playable public tracks are available for Tahti Selects',
          })
        }
      }

      // Rotation channels use a persistent placeholder broadcast (never ended) so the
      // existing watchdog/orchestrator-restart paths, which require a broadcastId, work
      // unmodified — see infra/liquidsoap-rotation.liq.template.
      let broadcast = await fastify.prisma.broadcast.findFirst({
        where: { channelId: channel.id, endedAt: null },
      })
      if (!broadcast) {
        broadcast = await fastify.prisma.broadcast.create({
          data: { channelId: channel.id, source: 'ICECAST' },
        })
      }

      try {
        await spawnChannelLiquidsoap(channel.id, channel.slug, broadcast.id, 'rotation')
      } catch (err) {
        fastify.log.error({ err }, 'orchestrator spawn failed (tahti-selects rotation)')
        return reply
          .status(502)
          .send({ error: 'Orchestrator spawn failed — check the orchestrator service is running' })
      }

      return reply.send({ ok: true as const, channelId: channel.id, broadcastId: broadcast.id })
    },
  )

  fastify.post(
    '/api/admin/tahti-selects/generate',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const mode = (request.body as { mode?: string }).mode
      if (mode !== 'add' && mode !== 'replace') {
        return reply.status(400).send({ error: 'mode must be add or replace' })
      }
      const channelId = await getTahtiSelectsChannelId(fastify.prisma)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Selects channel not found' })

      const added = await generateTopPlayedRotation(
        fastify.prisma,
        channelId,
        request.sessionUser!.id,
        mode,
      )
      return reply.send({ ok: true as const, added, mode })
    },
  )

  // POST /api/admin/tahti-selects/stream/stop
  fastify.post(
    '/api/admin/tahti-selects/stream/stop',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (_request, reply) => {
      const channelId = await getTahtiSelectsChannelId(fastify.prisma)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Selects channel not found' })

      await stopOrchestratorChannel(channelId)
      return reply.send({ ok: true as const })
    },
  )
}

export default adminTahtiSelectsRoutes
