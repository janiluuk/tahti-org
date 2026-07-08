// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import { StashListQuerySchema, StashPagedListSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedPutUrl, presignedGetUrl } from '../../lib/minio.js'

const PRESIGN_TTL_SEC = 900

const meStashRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/stash — list stash files with share counts
  fastify.get(
    '/api/me/stash',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'PERF-008: paginated stash file list',
        response: openApiResponse(StashPagedListSchema, 'StashPagedList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsedQuery = StashListQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply
          .status(400)
          .send({ error: parsedQuery.error.issues[0]?.message ?? 'Invalid query' })
      }
      const { page, limit } = parsedQuery.data

      const [total, files] = await Promise.all([
        fastify.prisma.stashFile.count({ where: { userId: user.id } }),
        fastify.prisma.stashFile.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
          include: { shares: true },
        }),
      ])

      return reply.send({
        page,
        limit,
        total,
        files: files.map((f) => ({
          id: f.id,
          filename: f.filename,
          contentType: f.contentType,
          sizeBytes: f.sizeBytes.toString(),
          format: f.format,
          bitDepth: f.bitDepth,
          sampleRate: f.sampleRate,
          createdAt: f.createdAt,
          updatedAt: f.updatedAt,
          shareCount: f.shares.length,
          shares: f.shares.map((s) => ({
            id: s.id,
            granteeUsername: s.granteeUsername,
            token: s.token,
            permission: s.permission,
            fileCount: s.fileCount,
            expiresAt: s.expiresAt,
            createdAt: s.createdAt,
          })),
        })),
      })
    },
  )

  // POST /api/me/stash/prepare — presigned PUT URL for uploading to stash
  fastify.post('/api/me/stash/prepare', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const body = request.body as {
      filename?: string
      contentType?: string
      sizeBytes?: number
      format?: string
    }

    if (!body.filename || !body.contentType) {
      return reply.status(400).send({ error: 'filename and contentType required' })
    }

    const ext = body.filename.includes('.') ? body.filename.split('.').pop() : 'bin'
    const objectKey = `stash/${user.id}/${nanoid(16)}.${ext}`

    const uploadUrl = await presignedPutUrl(objectKey, body.contentType, PRESIGN_TTL_SEC)
    const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

    return reply.send({ objectKey, uploadUrl, expiresAt })
  })

  // POST /api/me/stash — register a completed stash upload
  fastify.post('/api/me/stash', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const body = request.body as {
      objectKey?: string
      filename?: string
      contentType?: string
      sizeBytes?: number
      format?: string
      bitDepth?: number
      sampleRate?: number
    }

    if (!body.objectKey || !body.filename || !body.contentType || body.sizeBytes == null) {
      return reply
        .status(400)
        .send({ error: 'objectKey, filename, contentType, sizeBytes required' })
    }

    const expectedPrefix = `stash/${user.id}/`
    if (!body.objectKey.startsWith(expectedPrefix)) {
      return reply.status(403).send({ error: 'Object does not belong to your stash' })
    }

    const file = await fastify.prisma.stashFile.create({
      data: {
        userId: user.id,
        filename: body.filename,
        objectKey: body.objectKey,
        contentType: body.contentType,
        sizeBytes: BigInt(body.sizeBytes),
        format: body.format ?? null,
        bitDepth: body.bitDepth ?? null,
        sampleRate: body.sampleRate ?? null,
      },
    })

    return reply.status(201).send({
      id: file.id,
      filename: file.filename,
      createdAt: file.createdAt,
    })
  })

  // DELETE /api/me/stash/:id — delete a stash file
  fastify.delete('/api/me/stash/:id', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const { id } = request.params as { id: string }

    const file = await fastify.prisma.stashFile.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })

    if (!file || file.userId !== user.id) {
      return reply.status(404).send({ error: 'Not found' })
    }

    await fastify.prisma.stashFile.delete({ where: { id } })
    return reply.send({ ok: true })
  })

  // GET /api/me/stash/:id/download — presigned GET URL for downloading
  fastify.get('/api/me/stash/:id/download', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const { id } = request.params as { id: string }

    const file = await fastify.prisma.stashFile.findUnique({
      where: { id },
      select: { id: true, userId: true, objectKey: true, filename: true },
    })

    if (!file || file.userId !== user.id) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const url = await presignedGetUrl(file.objectKey, 300)
    return reply.send({ url, filename: file.filename })
  })

  // POST /api/me/stash/:id/share — create a share link
  fastify.post('/api/me/stash/:id/share', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const { id } = request.params as { id: string }
    const body = request.body as {
      granteeUsername?: string
      permission?: string
      expiresInDays?: number
    }

    const file = await fastify.prisma.stashFile.findUnique({
      where: { id },
      select: { id: true, userId: true },
    })

    if (!file || file.userId !== user.id) {
      return reply.status(404).send({ error: 'Not found' })
    }

    const expiresAt = body.expiresInDays
      ? new Date(Date.now() + body.expiresInDays * 86400_000)
      : null

    const share = await fastify.prisma.stashShare.create({
      data: {
        fileId: id,
        granteeUsername: body.granteeUsername ?? null,
        permission: body.permission ?? 'READ',
        expiresAt,
      },
    })

    return reply.status(201).send({
      id: share.id,
      token: share.token,
      permission: share.permission,
      expiresAt: share.expiresAt,
    })
  })

  // DELETE /api/me/stash/shares/:shareId — revoke a share
  fastify.delete(
    '/api/me/stash/shares/:shareId',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const { shareId } = request.params as { shareId: string }

      const share = await fastify.prisma.stashShare.findUnique({
        where: { id: shareId },
        include: { file: { select: { userId: true } } },
      })

      if (!share || share.file.userId !== user.id) {
        return reply.status(404).send({ error: 'Not found' })
      }

      await fastify.prisma.stashShare.delete({ where: { id: shareId } })
      return reply.send({ ok: true })
    },
  )
}

export default meStashRoutes
