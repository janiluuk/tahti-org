// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  SoundEditorSourceSchema,
  IdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveSoundEditorSource } from '../../lib/sound-editor-source.js'
import { getObjectStream, presignedGetUrl } from '../../lib/minio.js'
import { ownedItem } from './sound-editor-helpers.js'

const meSoundEditorSourceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/sound/:id/editor/source',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M21 v0: presigned URL to preview sound audio for trim editor',
        response: openApiResponse(SoundEditorSourceSchema, 'SoundEditorSource'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await ownedItem(fastify, user.id, id)
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      const source = await resolveSoundEditorSource(fastify.prisma, id)
      if (!source) {
        return reply.status(409).send({ error: 'Sound item is not ready for editing' })
      }

      const url = await presignedGetUrl(source.sourceKey, 3600)
      const sourceFileSizeBytes = source.fileSizeBytes != null ? Number(source.fileSizeBytes) : null
      return reply.send({
        url,
        durationSec: source.durationSec,
        title: source.title,
        sourceKey: source.sourceKey,
        sourceFileSizeBytes,
      })
    },
  )

  fastify.get(
    '/api/me/sound/:id/editor/stream',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Pro editor: same-origin audio stream with CORP for COEP pages',
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await ownedItem(fastify, user.id, id)
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      const source = await resolveSoundEditorSource(fastify.prisma, id)
      if (!source) {
        return reply.status(409).send({ error: 'Sound item is not ready for editing' })
      }

      const { body, contentType, contentLength } = await getObjectStream(source.sourceKey)
      reply.header('Cross-Origin-Resource-Policy', 'cross-origin')
      reply.header('Content-Type', contentType)
      reply.header('Cache-Control', 'private, no-store')
      if (contentLength != null) reply.header('Content-Length', String(contentLength))
      return reply.send(body)
    },
  )
}

export default meSoundEditorSourceRoutes
