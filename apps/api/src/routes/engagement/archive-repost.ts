// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { createHash } from 'node:crypto'
import { DownloadGatesQuerySchema, RepostAckBodySchema } from '@tahti/shared'
import { config } from '../../config.js'
import { resolveDownloadGateStatus } from '../../lib/download-gates.js'

function dailySalt(): string {
  const day = new Date().toISOString().slice(0, 10)
  return createHash('sha256').update(`${config.internalSecret}:${day}`).digest('hex')
}

function fingerprintFromRequest(fp: string | undefined, userAgent: string | undefined): string {
  const input = fp?.trim() || `${userAgent ?? 'unknown'}`
  return createHash('sha256').update(`${input}:${dailySalt()}`).digest('hex')
}

const archiveRepostRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/v1/c/:slug/archive/:itemId/download-gates',
    {
      schema: {
        tags: ['downloads'],
        description: 'M22: public download gate requirements for a track',
      },
    },
    async (request, reply) => {
      const { slug, itemId } = request.params as { slug: string; itemId: string }
      const parsedQuery = DownloadGatesQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: parsedQuery.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const query = parsedQuery.data

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true, userId: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id: itemId, channelId: channel.id, status: 'READY', isPublic: true },
        select: { id: true, repostToDownload: true, followToDownload: true },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const byFingerprint = fingerprintFromRequest(
        query.fp,
        request.headers['user-agent'] as string,
      )
      const byUserId = request.sessionUser?.id ?? null

      const gates = await resolveDownloadGateStatus(fastify.prisma, {
        artistUserId: channel.userId,
        archiveItemId: item.id,
        repostToDownload: item.repostToDownload,
        followToDownload: item.followToDownload,
        byUserId,
        byFingerprint,
        skipGates: byUserId === channel.userId,
      })

      return reply.send(gates)
    },
  )

  fastify.post(
    '/api/v1/c/:slug/archive/:itemId/repost-ack',
    {
      schema: {
        tags: ['downloads'],
        description: 'M22: acknowledge repost to satisfy download gate',
      },
    },
    async (request, reply) => {
      const { slug, itemId } = request.params as { slug: string; itemId: string }
      const parsedBody = RepostAckBodySchema.safeParse(request.body ?? {})
      if (!parsedBody.success) {
        return reply.status(400).send({
          error: parsedBody.error.issues[0]?.message ?? 'Invalid body',
        })
      }
      const parsedQuery = DownloadGatesQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: parsedQuery.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const fp = parsedBody.data.fp ?? parsedQuery.data.fp

      const channel = await fastify.prisma.channel.findUnique({
        where: { slug },
        select: { id: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const item = await fastify.prisma.archiveItem.findFirst({
        where: { id: itemId, channelId: channel.id, status: 'READY', isPublic: true },
        select: { id: true, repostToDownload: true },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })
      if (!item.repostToDownload) {
        return reply.status(400).send({ error: 'This item does not require a repost' })
      }

      const byFingerprint = fingerprintFromRequest(fp, request.headers['user-agent'] as string)
      await fastify.prisma.archiveRepostAck.upsert({
        where: {
          archiveItemId_byFingerprint: { archiveItemId: item.id, byFingerprint },
        },
        create: {
          archiveItemId: item.id,
          byFingerprint,
          byUserId: request.sessionUser?.id ?? null,
        },
        update: {},
      })

      return reply.send({ acknowledged: true })
    },
  )
}

export default archiveRepostRoutes
