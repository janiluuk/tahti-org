// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma, Theme } from '@tahti/db'
import {
  CreateThemeSchema,
  IdParamSchema,
  PatchThemeSchema,
  ThemeListSchema,
  ThemeViewSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { notifyUserThemeUnderReview } from '@tahti/db'

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

function toView(theme: Theme) {
  return {
    id: theme.id,
    name: theme.name,
    vars: theme.varsJson as Record<string, string>,
    dark: theme.darkJson as Record<string, string>,
    visibility: theme.visibility,
    moderationNote: theme.moderationNote,
    prStatus: theme.prStatus,
    prUrl: theme.prUrl,
    createdAt: theme.createdAt,
    updatedAt: theme.updatedAt,
  }
}

const meThemesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/themes',
    {
      preHandler: requireAuth,
      schema: { tags: ['themes'], response: openApiResponse(ThemeListSchema, 'ThemeList') },
    },
    async (request, reply) => {
      const themes = await fastify.prisma.theme.findMany({
        where: { userId: request.sessionUser!.id },
        orderBy: { createdAt: 'desc' },
      })
      return reply.send({ themes: themes.map(toView) })
    },
  )

  fastify.post(
    '/api/me/themes',
    {
      preHandler: requireAuth,
      schema: { tags: ['themes'], response: openApiResponse(ThemeViewSchema, 'ThemeView') },
    },
    async (request, reply) => {
      const parsed = CreateThemeSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const theme = await fastify.prisma.theme.create({
        data: {
          userId: request.sessionUser!.id,
          name: parsed.data.name,
          varsJson: parsed.data.vars as Prisma.InputJsonValue,
          darkJson: parsed.data.dark as Prisma.InputJsonValue,
        },
      })
      return reply.status(201).send(toView(theme))
    },
  )

  fastify.patch('/api/me/themes/:id', { preHandler: requireAuth }, async (request, reply) => {
    const routeParams = parseRouteParams(IdParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
    const parsed = PatchThemeSchema.safeParse(request.body)
    if (!parsed.success) return zodError(reply, parsed.error)

    const existing = await fastify.prisma.theme.findFirst({
      where: { id: routeParams.id, userId: request.sessionUser!.id },
    })
    if (!existing) return reply.status(404).send({ error: 'Theme not found' })
    if (existing.visibility === 'PENDING_REVIEW') {
      return reply.status(409).send({ error: 'Cannot edit a theme while it is under review' })
    }

    const theme = await fastify.prisma.theme.update({
      where: { id: routeParams.id },
      data: {
        ...(parsed.data.name !== undefined ? { name: parsed.data.name } : {}),
        ...(parsed.data.vars !== undefined
          ? { varsJson: parsed.data.vars as Prisma.InputJsonValue }
          : {}),
        ...(parsed.data.dark !== undefined
          ? { darkJson: parsed.data.dark as Prisma.InputJsonValue }
          : {}),
      },
    })
    return reply.send(toView(theme))
  })

  fastify.delete('/api/me/themes/:id', { preHandler: requireAuth }, async (request, reply) => {
    const routeParams = parseRouteParams(IdParamSchema, request.params)
    if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

    const { count } = await fastify.prisma.theme.deleteMany({
      where: { id: routeParams.id, userId: request.sessionUser!.id },
    })
    if (count === 0) return reply.status(404).send({ error: 'Theme not found' })
    return reply.status(204).send()
  })

  // POST /api/me/themes/:id/submit-public — enters the admin review queue.
  fastify.post(
    '/api/me/themes/:id/submit-public',
    {
      preHandler: requireAuth,
      schema: { tags: ['themes'], response: openApiResponse(ThemeViewSchema, 'ThemeView') },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const existing = await fastify.prisma.theme.findFirst({
        where: { id: routeParams.id, userId: request.sessionUser!.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Theme not found' })
      if (existing.visibility !== 'PRIVATE' && existing.visibility !== 'REJECTED') {
        return reply.status(409).send({ error: 'Theme is already under review' })
      }

      const theme = await fastify.prisma.theme.update({
        where: { id: routeParams.id },
        data: { visibility: 'PENDING_REVIEW', moderationNote: null },
      })
      await notifyUserThemeUnderReview(fastify.prisma, request.sessionUser!.id, theme).catch((e) =>
        fastify.log.warn(e, 'theme-under-review notification failed'),
      )
      return reply.send(toView(theme))
    },
  )
}

export default meThemesRoutes
