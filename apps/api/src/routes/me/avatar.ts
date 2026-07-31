// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { Readable } from 'node:stream'
import { nanoid } from 'nanoid'
import {
  AvatarProxyQuerySchema,
  AvatarUploadCompleteResponseSchema,
  AvatarUploadCompleteSchema,
  AvatarUploadPrepareResponseSchema,
  AvatarUploadPrepareSchema,
  ImageFromUrlSchema,
  ImageUploadPrepareResponseSchema,
  LogoUploadCompleteResponseSchema,
  LogoUploadCompleteSchema,
  LogoUploadPrepareSchema,
  openApiResponse,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { presignedPutUrl, putObjectBuffer } from '../../lib/minio.js'
import { publicMediaUrl } from '../../lib/public-media-url.js'
import { extFromMime, fetchImageFromUrl } from '../../lib/fetch-image-url.js'
import { extractPalette } from '../../lib/palette-extract.js'

const PRESIGN_TTL_SEC = 900
const PROXY_FETCH_TIMEOUT_MS = 8000
const PROXY_MAX_BYTES = 12 * 1024 * 1024
const ALLOWED_PROXY_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif'])

/** Fire-and-forget: extract a palette from the new avatar and persist it. */
function refreshAvatarPalette(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: { user: { update: (args: any) => Promise<unknown> } },
  userId: string,
  imageUrl: string,
  log: { warn: (err: unknown, msg: string) => void },
) {
  extractPalette(imageUrl)
    .then((palette) => {
      if (!palette) return
      return prisma.user.update({
        where: { id: userId },
        data: { avatarPaletteJson: JSON.stringify(palette) },
      })
    })
    .catch((err) => log.warn(err, 'avatar palette extract failed'))
}

const meAvatarRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/profile/avatar/proxy — fetch an arbitrary pasted image URL server-side
  // and re-serve it same-origin, so the browser's crop canvas isn't CORS-tainted.
  fastify.get(
    '/api/me/profile/avatar/proxy',
    {
      preHandler: requireAuth,
      schema: { tags: ['channel'], description: 'Same-origin proxy for pasted avatar image URLs' },
    },
    async (request, reply) => {
      const parsed = AvatarProxyQuerySchema.safeParse(request.query)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid URL' })
      }

      let upstream: Response
      try {
        upstream = await fetch(parsed.data.url, {
          signal: AbortSignal.timeout(PROXY_FETCH_TIMEOUT_MS),
        })
      } catch {
        return reply.status(502).send({ error: 'Could not fetch that URL' })
      }
      if (!upstream.ok || !upstream.body) {
        return reply.status(502).send({ error: 'Could not fetch that URL' })
      }

      const contentType = upstream.headers.get('content-type')?.split(';')[0]?.trim() ?? ''
      if (!ALLOWED_PROXY_MIME.has(contentType)) {
        return reply.status(415).send({ error: 'URL does not point to a JPEG, PNG, WebP, or GIF' })
      }
      const contentLength = Number(upstream.headers.get('content-length') ?? '0')
      if (contentLength > PROXY_MAX_BYTES) {
        return reply.status(413).send({ error: 'Image is too large' })
      }

      reply.header('Content-Type', contentType)
      reply.header('Cache-Control', 'private, no-store')
      return reply.send(Readable.fromWeb(upstream.body as import('node:stream/web').ReadableStream))
    },
  )

  fastify.post(
    '/api/me/profile/avatar/prepare',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(AvatarUploadPrepareResponseSchema, 'AvatarUploadPrepare'),
      },
    },
    async (request, reply) => {
      const parsed = AvatarUploadPrepareSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!

      const ext = parsed.data.filename.includes('.') ? parsed.data.filename.split('.').pop() : 'jpg'
      const uploadKey = `avatars/${user.username}/avatar-${nanoid(8)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadKey, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadKey, uploadUrl, expiresAt })
    },
  )

  fastify.post(
    '/api/me/profile/avatar/complete',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(AvatarUploadCompleteResponseSchema, 'AvatarUploadComplete'),
      },
    },
    async (request, reply) => {
      const parsed = AvatarUploadCompleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!

      const prefix = `avatars/${user.username}/`
      if (!parsed.data.uploadKey.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this account' })
      }
      if (parsed.data.posterUploadKey && !parsed.data.posterUploadKey.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this account' })
      }

      const avatarUrl = publicMediaUrl(parsed.data.uploadKey)
      if (!avatarUrl) {
        return reply.status(500).send({ error: 'Failed to resolve avatar URL' })
      }
      // Always set alongside avatarUrl (to null when absent) so switching from
      // an animated GIF back to a static avatar clears the stale poster frame.
      const avatarPosterUrl = parsed.data.posterUploadKey
        ? publicMediaUrl(parsed.data.posterUploadKey)
        : null
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl, avatarPosterUrl },
      })

      // Prefer the static poster for palette extraction when the avatar is an
      // animated GIF — Vibrant reads a single frame more reliably that way.
      refreshAvatarPalette(fastify.prisma, user.id, avatarPosterUrl ?? avatarUrl, fastify.log)

      return reply.send({ avatarUrl, avatarPosterUrl })
    },
  )

  fastify.post(
    '/api/me/profile/avatar/from-url',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(AvatarUploadCompleteResponseSchema, 'AvatarUploadFromUrl'),
      },
    },
    async (request, reply) => {
      const parsed = ImageFromUrlSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!

      const fetched = await fetchImageFromUrl(parsed.data.sourceUrl)
      if (!fetched.ok) return reply.status(422).send({ error: fetched.error })

      const uploadKey = `avatars/${user.username}/avatar-${nanoid(8)}.${extFromMime(fetched.contentType)}`
      await putObjectBuffer(uploadKey, fetched.bytes, fetched.contentType)

      const avatarUrl = publicMediaUrl(uploadKey)
      if (!avatarUrl) {
        return reply.status(500).send({ error: 'Failed to resolve avatar URL' })
      }
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: { avatarUrl, avatarPosterUrl: null },
      })

      refreshAvatarPalette(fastify.prisma, user.id, avatarUrl, fastify.log)

      return reply.send({ avatarUrl, avatarPosterUrl: null })
    },
  )

  // Logo upload — PNG/WebP only so alpha is preserved for overlays on avatar/cover.
  fastify.post(
    '/api/me/profile/logo/prepare',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(ImageUploadPrepareResponseSchema, 'LogoUploadPrepare'),
      },
    },
    async (request, reply) => {
      const parsed = LogoUploadPrepareSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!

      const ext = parsed.data.contentType === 'image/webp' ? 'webp' : 'png'
      const uploadKey = `avatars/${user.username}/logo-${nanoid(8)}.${ext}`
      const uploadUrl = await presignedPutUrl(uploadKey, parsed.data.contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      return reply.send({ uploadKey, uploadUrl, expiresAt })
    },
  )

  fastify.post(
    '/api/me/profile/logo/complete',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(LogoUploadCompleteResponseSchema, 'LogoUploadComplete'),
      },
    },
    async (request, reply) => {
      const parsed = LogoUploadCompleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }
      const user = request.sessionUser!

      const prefix = `avatars/${user.username}/`
      if (!parsed.data.uploadKey.startsWith(prefix)) {
        return reply.status(403).send({ error: 'Upload does not belong to this account' })
      }

      const logoUrl = publicMediaUrl(parsed.data.uploadKey)
      if (!logoUrl) {
        return reply.status(500).send({ error: 'Failed to resolve logo URL' })
      }
      // Default placement to AVATAR when first setting a logo with no prior placement.
      const existing = await fastify.prisma.user.findUnique({
        where: { id: user.id },
        select: { logoPlacement: true },
      })
      await fastify.prisma.user.update({
        where: { id: user.id },
        data: {
          logoUrl,
          logoPlacement: existing?.logoPlacement ?? 'AVATAR',
        },
      })

      return reply.send({ logoUrl })
    },
  )
}

export default meAvatarRoutes
