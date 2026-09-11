// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { createDefaultEditList, validateEditList } from '@tahti/audio-edit'
import {
  SoundEditListDraftPatchResponseSchema,
  SoundEditListDraftPatchSchema,
  SoundEditListDraftResponseSchema,
  IdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveSoundEditorSource } from '../../lib/sound-editor-source.js'
import { enqueueBackfillEditorPeaks } from '../../lib/queue.js'
import { ownedItem } from './sound-editor-helpers.js'

const meSoundEditorDraftRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/sound/:id/editor/draft',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Pro editor v3: load persisted EditList draft',
        response: openApiResponse(SoundEditListDraftResponseSchema, 'SoundEditListDraft'),
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

      const duration = source.durationSec ?? item.durationSec ?? 60
      const stored = item.editList
      const validation = stored ? validateEditList(stored) : { ok: false as const, issues: [] }
      const editList =
        validation.ok && validation.edit
          ? validation.edit
          : createDefaultEditList(Math.max(1, duration))

      if (!item.editorPeaks) {
        void enqueueBackfillEditorPeaks(id).catch(() => {})
      }

      return reply.send({
        editList: { ...editList, sourceDuration: Math.max(editList.sourceDuration, duration) },
        updatedAt: item.updatedAt.toISOString(),
        tracklist: Array.isArray(item.tracklist) ? item.tracklist : null,
        editorPeaks: item.editorPeaks ?? null,
      })
    },
  )

  fastify.patch(
    '/api/me/sound/:id/editor/draft',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Pro editor v3: autosave EditList draft',
        response: openApiResponse(SoundEditListDraftPatchResponseSchema, 'SoundEditListDraftPatch'),
      },
    },
    async (request, reply) => {
      const parsed = SoundEditListDraftPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const validation = validateEditList(parsed.data.editList)
      if (!validation.ok) {
        return reply.status(400).send({
          error: validation.issues[0]?.message ?? 'Invalid edit list',
          issues: validation.issues,
        })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await ownedItem(fastify, user.id, id)
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      const { expectedUpdatedAt } = parsed.data

      if (expectedUpdatedAt) {
        const result = await fastify.prisma.sound.updateMany({
          where: { id, updatedAt: new Date(expectedUpdatedAt) },
          data: { editList: validation.edit },
        })
        if (result.count === 0) {
          const current = await fastify.prisma.sound.findUnique({
            where: { id },
            select: { updatedAt: true },
          })
          return reply.status(409).send({
            error: 'Draft was updated elsewhere — reload to avoid overwriting',
            updatedAt: current?.updatedAt.toISOString() ?? null,
          })
        }
        const updated = await fastify.prisma.sound.findUniqueOrThrow({
          where: { id },
          select: { updatedAt: true },
        })
        return reply.send({ ok: true as const, updatedAt: updated.updatedAt.toISOString() })
      }

      const updated = await fastify.prisma.sound.update({
        where: { id },
        data: { editList: validation.edit },
        select: { updatedAt: true },
      })

      return reply.send({ ok: true as const, updatedAt: updated.updatedAt.toISOString() })
    },
  )
}

export default meSoundEditorDraftRoutes
