// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import type { FastifyPluginAsync } from 'fastify'
import { requireBoard } from '../../plugins/auth.js'

const CreateNewsPostSchema = z.object({
  headline: z.string().trim().min(1).max(200),
  summary: z.string().trim().min(1).max(500),
  publish: z.boolean().optional(),
})

const UpdateNewsPostSchema = z.object({
  headline: z.string().trim().min(1).max(200).optional(),
  summary: z.string().trim().min(1).max(500).optional(),
  publish: z.boolean().optional(),
})

// Board-only management of the homepage news feed. Every post always carries
// a byline — authorName is captured from the writer's own displayName at
// creation time, never editable, so it stays an honest record of who wrote it
// even if the post text is later revised by someone else.
const adminNewsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/news',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (_request, reply) => {
      const posts = await fastify.prisma.newsPost.findMany({
        orderBy: { createdAt: 'desc' },
      })
      return reply.send(posts)
    },
  )

  fastify.post(
    '/api/admin/news',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const parsed = CreateNewsPostSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!

      const post = await fastify.prisma.newsPost.create({
        data: {
          headline: parsed.data.headline,
          summary: parsed.data.summary,
          authorId: user.id,
          authorName: user.displayName,
          publishedAt: parsed.data.publish ? new Date() : null,
        },
      })
      return reply.status(201).send(post)
    },
  )

  fastify.patch(
    '/api/admin/news/:id',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const parsed = UpdateNewsPostSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const existing = await fastify.prisma.newsPost.findUnique({ where: { id } })
      if (!existing) return reply.status(404).send({ error: 'Not found' })

      const { publish, ...rest } = parsed.data
      const post = await fastify.prisma.newsPost.update({
        where: { id },
        data: {
          ...rest,
          ...(publish === true && !existing.publishedAt ? { publishedAt: new Date() } : {}),
          ...(publish === false ? { publishedAt: null } : {}),
        },
      })
      return reply.send(post)
    },
  )

  fastify.delete(
    '/api/admin/news/:id',
    { preHandler: requireBoard, schema: { tags: ['admin'] } },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const existing = await fastify.prisma.newsPost.findUnique({ where: { id } })
      if (!existing) return reply.status(404).send({ error: 'Not found' })

      await fastify.prisma.newsPost.delete({ where: { id } })
      return reply.send({ ok: true as const })
    },
  )
}

export default adminNewsRoutes
