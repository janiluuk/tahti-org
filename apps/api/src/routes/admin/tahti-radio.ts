// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminTahtiRadioBrowseResponseSchema,
  AdminTahtiRadioRotationResponseSchema,
  TAHTI_RADIO_SLUG,
  openApiResponse,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import {
  addCuratedRotationItem,
  browseReadyPublicSoundsForAdmin,
  deleteCuratedRotationItem,
  getCuratedChannelIdBySlug,
  listCuratedRotationForAdmin,
  reorderCuratedRotationItemByPosition,
  reorderCuratedRotationItems,
} from '../../lib/curated-rotation-admin.js'

const adminTahtiRadioRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/tahti-radio',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminTahtiRadioRotationResponseSchema, 'AdminTahtiRadioRotation'),
      },
    },
    async (_request, reply) => {
      const channelId = await getCuratedChannelIdBySlug(fastify.prisma, TAHTI_RADIO_SLUG)
      if (!channelId) return reply.send({ items: [] })
      const items = await listCuratedRotationForAdmin(fastify.prisma, channelId)
      return reply.send({ items })
    },
  )

  fastify.get(
    '/api/admin/tahti-radio/browse',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AdminTahtiRadioBrowseResponseSchema, 'AdminTahtiRadioBrowse'),
      },
    },
    async (request, reply) => {
      const { q } = request.query as { q?: string }
      const items = await browseReadyPublicSoundsForAdmin(fastify.prisma, q)
      return reply.send({ items })
    },
  )

  fastify.post(
    '/api/admin/tahti-radio/items',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { soundId } = request.body as { soundId?: string }
      if (!soundId) return reply.status(400).send({ error: 'soundId required' })

      const channelId = await getCuratedChannelIdBySlug(fastify.prisma, TAHTI_RADIO_SLUG)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Radio channel not found' })

      const result = await addCuratedRotationItem(fastify.prisma, {
        channelId,
        soundId,
        addedById: request.sessionUser!.id,
      })
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.status(201).send({ ok: true as const, id: result.id })
    },
  )

  fastify.delete(
    '/api/admin/tahti-radio/items/:id',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const channelId = await getCuratedChannelIdBySlug(fastify.prisma, TAHTI_RADIO_SLUG)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Radio channel not found' })

      const result = await deleteCuratedRotationItem(fastify.prisma, { id, channelId })
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({ ok: true as const })
    },
  )

  fastify.put(
    '/api/admin/tahti-radio/reorder',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const itemIds = (request.body as { itemIds?: unknown }).itemIds
      if (!Array.isArray(itemIds) || itemIds.some((id) => typeof id !== 'string')) {
        return reply.status(400).send({ error: 'itemIds array required' })
      }
      const channelId = await getCuratedChannelIdBySlug(fastify.prisma, TAHTI_RADIO_SLUG)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Radio channel not found' })

      const result = await reorderCuratedRotationItems(fastify.prisma, {
        channelId,
        itemIds,
      })
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({ ok: true as const })
    },
  )

  fastify.patch(
    '/api/admin/tahti-radio/items/:id/reorder',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { position } = request.body as { position?: number }
      if (typeof position !== 'number' || position < 0) {
        return reply.status(400).send({ error: 'position required' })
      }
      const channelId = await getCuratedChannelIdBySlug(fastify.prisma, TAHTI_RADIO_SLUG)
      if (!channelId) return reply.status(404).send({ error: 'Tahti Radio channel not found' })

      const result = await reorderCuratedRotationItemByPosition(fastify.prisma, {
        id,
        channelId,
        position,
      })
      if (!result.ok) return reply.status(result.status).send({ error: result.error })
      return reply.send({ ok: true as const })
    },
  )
}

export default adminTahtiRadioRoutes
