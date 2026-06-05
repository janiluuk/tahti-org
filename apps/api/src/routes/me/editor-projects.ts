// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import {
  EditorProjectCreateSchema,
  EditorProjectDetailSchema,
  EditorProjectListSchema,
  EditorProjectRowSchema,
  EditorProjectUpdateSchema,
  IdParamSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { resolveArchiveEditorSource } from '../../lib/archive-editor-source.js'
import { presignedGetUrl } from '../../lib/minio.js'

const EMPTY_TIMELINE = { tracks: [] as unknown[] }

const meEditorProjectRoutes: FastifyPluginAsync = async (fastify) => {
  async function ownedProject(userId: string, projectId: string) {
    return fastify.prisma.editorProject.findFirst({
      where: { id: projectId, userId },
    })
  }

  async function ownedArchiveItem(userId: string, itemId: string) {
    return fastify.prisma.archiveItem.findFirst({
      where: { id: itemId, channel: { userId }, status: 'READY' },
      select: { id: true, title: true },
    })
  }

  fastify.get(
    '/api/me/editor/projects',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M21 v1: list multitrack editor projects',
        response: openApiResponse(EditorProjectListSchema, 'EditorProjectList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const rows = await fastify.prisma.editorProject.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: 'desc' },
        select: { id: true, title: true, archiveItemId: true, updatedAt: true },
      })
      return reply.send(
        rows.map((row) => ({
          ...row,
          updatedAt: row.updatedAt.toISOString(),
        })),
      )
    },
  )

  fastify.post(
    '/api/me/editor/projects',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M21 v1: create editor project (optionally seed from archive item)',
        response: openApiResponse(EditorProjectRowSchema, 'EditorProjectRow'),
      },
    },
    async (request, reply) => {
      const parsed = EditorProjectCreateSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const user = request.sessionUser!
      const { archiveItemId } = parsed.data
      let title = parsed.data.title?.trim()
      let timeline: Record<string, unknown> = { ...EMPTY_TIMELINE }

      if (archiveItemId) {
        const item = await ownedArchiveItem(user.id, archiveItemId)
        if (!item) return reply.status(404).send({ error: 'Archive item not found' })
        title = title ?? `${item.title} — edit`
        timeline = {
          tracks: [],
          seedArchiveItemId: archiveItemId,
        }
      }

      if (!title) title = 'Untitled session'

      const project = await fastify.prisma.editorProject.create({
        data: {
          userId: user.id,
          title,
          archiveItemId: archiveItemId ?? null,
          timeline: timeline as Prisma.InputJsonValue,
        },
        select: { id: true, title: true, archiveItemId: true, updatedAt: true },
      })

      return reply.status(201).send({
        ...project,
        updatedAt: project.updatedAt.toISOString(),
      })
    },
  )

  fastify.get(
    '/api/me/editor/projects/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M21 v1: load editor project with resolved audio sources',
        response: openApiResponse(EditorProjectDetailSchema, 'EditorProjectDetail'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const project = await ownedProject(user.id, id)
      if (!project) return reply.status(404).send({ error: 'Editor project not found' })

      const timeline = project.timeline as Record<string, unknown>
      const archiveIds = new Set<string>()
      if (project.archiveItemId) archiveIds.add(project.archiveItemId)
      const seedId = timeline.seedArchiveItemId
      if (typeof seedId === 'string') archiveIds.add(seedId)

      const sources: Array<{
        archiveItemId: string
        title: string
        url: string
        durationSec: number | null
      }> = []

      for (const archiveItemId of archiveIds) {
        const item = await ownedArchiveItem(user.id, archiveItemId)
        if (!item) continue
        const source = await resolveArchiveEditorSource(fastify.prisma, archiveItemId)
        if (!source) continue
        const url = await presignedGetUrl(source.sourceKey, 3600)
        sources.push({
          archiveItemId,
          title: item.title,
          url,
          durationSec: source.durationSec,
        })
      }

      return reply.send({
        id: project.id,
        title: project.title,
        archiveItemId: project.archiveItemId,
        timeline,
        sources,
        updatedAt: project.updatedAt.toISOString(),
      })
    },
  )

  fastify.patch(
    '/api/me/editor/projects/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M21 v1: autosave editor project timeline',
        response: openApiResponse(EditorProjectRowSchema, 'EditorProjectRow'),
      },
    },
    async (request, reply) => {
      const parsed = EditorProjectUpdateSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid request body',
        })
      }

      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const existing = await ownedProject(user.id, id)
      if (!existing) return reply.status(404).send({ error: 'Editor project not found' })

      const project = await fastify.prisma.editorProject.update({
        where: { id },
        data: {
          ...(parsed.data.title != null ? { title: parsed.data.title } : {}),
          ...(parsed.data.timeline != null
            ? { timeline: parsed.data.timeline as Prisma.InputJsonValue }
            : {}),
        },
        select: { id: true, title: true, archiveItemId: true, updatedAt: true },
      })

      return reply.send({
        ...project,
        updatedAt: project.updatedAt.toISOString(),
      })
    },
  )

  fastify.delete(
    '/api/me/editor/projects/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const existing = await ownedProject(user.id, id)
      if (!existing) return reply.status(404).send({ error: 'Editor project not found' })

      await fastify.prisma.editorProject.delete({ where: { id } })
      return reply.status(204).send()
    },
  )
}

export default meEditorProjectRoutes
