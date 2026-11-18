// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminTahtiSelectsBrowseResponseSchema,
  AdminTahtiSelectsRotationResponseSchema,
  TAHTI_SELECTS_SLUG,
  openApiResponse,
} from '@tahti/shared'
import { notifyArtistOfSelectsPick } from '@tahti/db'
import { requireBoard } from '../../plugins/auth.js'
import { spawnChannelLiquidsoap, stopOrchestratorChannel } from '../../lib/orchestrator.js'
import { buildTopList } from '../../lib/top-lists.js'
import {
  addCuratedRotationItem,
  browseReadyPublicSoundsForAdmin,
  deleteCuratedRotationItem,
  getCuratedChannelIdBySlug,
  listCuratedRotationForAdmin,
  reorderCuratedRotationItemByPosition,
  reorderCuratedRotationItems,
} from '../../lib/curated-rotation-admin.js'

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

const adminTahtiSelectsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/tahti-selects',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(
          AdminTahtiSelectsRotationResponseSchema,
          'AdminTahtiSelectsRotation',
        ),
      },
    },
    async (_request, reply) => {
      const channelId = await getCuratedChannelIdBySlug(fastify.prisma, TAHTI_SELECTS_SLUG)
      if (!channelId) return reply.send({ items: [] })
      const items = await listCuratedRotationForAdmin(fastify.prisma, channelId)
      return reply.send({ items })
    },
  )

  fastify.get(
    '/api/admin/tahti-selects/browse',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminTahtiSelectsBrowseResponseSchema, 'AdminTahtiSelectsBrowse'),
      },
    },
    async (request, reply) => {
      const { q } = request.query as { q?: string }
      const items = await browseReadyPublicSoundsForAdmin(fastify.prisma, q)
      return reply.send({ items })
    },
  )

  fastify.post(
    '/api/admin/tahti-selects/items',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { soundId } = request.body as { soundId?: string }
      if (!soundId) return reply.status(400).send({ error: 'soundId required' })

      const channelId = await getCuratedChannelIdBySlug(fastify.prisma, TAHTI_SELECTS_SLUG)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Selects channel not found' })

      const result = await addCuratedRotationItem(fastify.prisma, {
        channelId,
        soundId,
        addedById: request.sessionUser!.id,
      })
      if (!result.ok) return reply.status(result.status).send({ error: result.error })

      await notifyArtistOfSelectsPick(fastify.prisma, {
        soundId,
        channelSlug: TAHTI_SELECTS_SLUG,
      }).catch((err: unknown) => fastify.log.warn({ err }, 'Tahti Selects notice failed'))

      return reply.status(201).send({ ok: true as const, id: result.id })
    },
  )

  fastify.delete(
    '/api/admin/tahti-selects/items/:id',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const channelId = await getCuratedChannelIdBySlug(fastify.prisma, TAHTI_SELECTS_SLUG)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Selects channel not found' })

      const result = await deleteCuratedRotationItem(fastify.prisma, { id, channelId })
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({ ok: true as const })
    },
  )

  fastify.put(
    '/api/admin/tahti-selects/reorder',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const itemIds = (request.body as { itemIds?: unknown }).itemIds
      if (!Array.isArray(itemIds) || itemIds.some((id) => typeof id !== 'string')) {
        return reply.status(400).send({ error: 'itemIds array required' })
      }
      const channelId = await getCuratedChannelIdBySlug(fastify.prisma, TAHTI_SELECTS_SLUG)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Selects channel not found' })

      const result = await reorderCuratedRotationItems(fastify.prisma, {
        channelId,
        itemIds,
      })
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
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

      const channelId = await getCuratedChannelIdBySlug(fastify.prisma, TAHTI_SELECTS_SLUG)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Selects channel not found' })

      const result = await reorderCuratedRotationItemByPosition(fastify.prisma, {
        id,
        channelId,
        position,
      })
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({ ok: true as const })
    },
  )

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
      const channelId = await getCuratedChannelIdBySlug(fastify.prisma, TAHTI_SELECTS_SLUG)
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

  fastify.post(
    '/api/admin/tahti-selects/stream/stop',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (_request, reply) => {
      const channelId = await getCuratedChannelIdBySlug(fastify.prisma, TAHTI_SELECTS_SLUG)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Selects channel not found' })

      await stopOrchestratorChannel(channelId)
      return reply.send({ ok: true as const })
    },
  )
}

export default adminTahtiSelectsRoutes
