// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import {
  ArtistPostImageCompleteSchema,
  ArtistPostImagePrepareResponseSchema,
  ArtistPostImagePrepareSchema,
  ArtistPostListSchema,
  ArtistPostSchema,
  CreateArtistPostSchema,
  IdParamSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedPutUrl } from '../../lib/minio.js'
import { publicMediaUrl } from '../../lib/public-media-url.js'

const PRESIGN_TTL_SEC = 900
const MAX_IMAGES = 10

function serialize(post: {
  id: string
  title: string | null
  body: string
  images: string[]
  createdAt: Date
}) {
  return { ...post, createdAt: post.createdAt.toISOString() }
}

const mePostRoutes: FastifyPluginAsync = async (fastify) => {
  async function ownedPost(userId: string, postId: string) {
    return fastify.prisma.artistPost.findFirst({ where: { id: postId, userId } })
  }

  // GET /api/me/posts — all of the artist's own posts, newest first
  fastify.get(
    '/api/me/posts',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ArtistPostListSchema, 'ArtistPostList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const posts = await fastify.prisma.artistPost.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send(posts.map(serialize))
    },
  )

  // POST /api/me/posts — create a post (images attached afterward via /images/prepare+complete)
  fastify.post(
    '/api/me/posts',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponses([{ status: 201, schema: ArtistPostSchema, name: 'ArtistPost' }]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = CreateArtistPostSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const body = parsed.data

      const post = await fastify.prisma.artistPost.create({
        data: { userId: user.id, title: body.title?.trim() || null, body: body.body },
      })

      return reply.status(201).send(serialize(post))
    },
  )

  // DELETE /api/me/posts/:id
  fastify.delete(
    '/api/me/posts/:id',
    { preHandler: requireAuth, schema: { tags: ['channel'] } },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const post = await ownedPost(user.id, routeParams.id)
      if (!post) return reply.status(404).send({ error: 'Post not found' })

      await fastify.prisma.artistPost.delete({ where: { id: post.id } })
      return reply.status(204).send()
    },
  )

  // POST /api/me/posts/:id/images/prepare — presigned URL for one image
  fastify.post(
    '/api/me/posts/:id/images/prepare',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ArtistPostImagePrepareResponseSchema, 'ArtistPostImagePrepare'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const post = await ownedPost(user.id, routeParams.id)
      if (!post) return reply.status(404).send({ error: 'Post not found' })
      if (post.images.length >= MAX_IMAGES) {
        return reply.status(400).send({ error: `Maximum ${MAX_IMAGES} images per post` })
      }

      const parsed = ArtistPostImagePrepareSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const ext =
        parsed.data.contentType === 'image/png'
          ? 'png'
          : parsed.data.contentType === 'image/webp'
            ? 'webp'
            : 'jpg'
      const uploadKey = `posts/${user.username}/${post.id}/image-${nanoid(8)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadKey, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadKey, uploadUrl, expiresAt })
    },
  )

  // POST /api/me/posts/:id/images/complete — append the uploaded image to the post
  fastify.post(
    '/api/me/posts/:id/images/complete',
    {
      preHandler: requireAuth,
      schema: { tags: ['channel'], response: openApiResponse(ArtistPostSchema, 'ArtistPost') },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const post = await ownedPost(user.id, routeParams.id)
      if (!post) return reply.status(404).send({ error: 'Post not found' })

      const parsed = ArtistPostImageCompleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const prefix = `posts/${user.username}/${post.id}/`
      if (!parsed.data.uploadKey.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this post' })
      }

      const url = publicMediaUrl(parsed.data.uploadKey)
      if (!url) return reply.status(500).send({ error: 'Failed to resolve image URL' })
      const updated = await fastify.prisma.artistPost.update({
        where: { id: post.id },
        data: { images: { push: url } },
      })

      return reply.send(serialize(updated))
    },
  )
}

export default mePostRoutes
