// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Theme } from '@tahti/db'
import {
  AdminThemeListQuerySchema,
  AdminThemeListSchema,
  IdParamSchema,
  RejectThemeSchema,
  ThemeViewSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { notifyUserThemeApproved, notifyUserThemeRejected } from '@tahti/db'
import { enqueueOpenThemePullRequest } from '../../lib/queue.js'

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

const adminThemesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/admin/themes',
    {
      preHandler: requireBoard,
      schema: { tags: ['admin'], response: openApiResponse(AdminThemeListSchema, 'AdminThemeList') },
    },
    async (request, reply) => {
      const parsed = AdminThemeListQuerySchema.safeParse(request.query)
      if (!parsed.success) return zodError(reply, parsed.error)

      const themes = await fastify.prisma.theme.findMany({
        where: parsed.data.visibility ? { visibility: parsed.data.visibility } : {},
        orderBy: { createdAt: 'desc' },
        include: { user: { select: { username: true, displayName: true } } },
      })
      return reply.send({
        themes: themes.map((t) => ({ ...toView(t), authorUsername: t.user.username })),
      })
    },
  )

  fastify.post(
    '/api/admin/themes/:id/approve',
    {
      preHandler: requireBoard,
      schema: { tags: ['admin'], response: openApiResponse(ThemeViewSchema, 'ThemeView') },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const existing = await fastify.prisma.theme.findUnique({ where: { id: routeParams.id } })
      if (!existing) return reply.status(404).send({ error: 'Theme not found' })
      if (existing.visibility !== 'PENDING_REVIEW') {
        return reply.status(409).send({ error: 'Theme is not pending review' })
      }

      const theme = await fastify.prisma.theme.update({
        where: { id: routeParams.id },
        data: { prStatus: 'PENDING' },
      })
      await enqueueOpenThemePullRequest({ themeId: theme.id })
      await notifyUserThemeApproved(fastify.prisma, theme.userId, theme).catch((e) =>
        fastify.log.warn(e, 'theme-approved notification failed'),
      )
      return reply.send(toView(theme))
    },
  )

  fastify.post(
    '/api/admin/themes/:id/reject',
    {
      preHandler: requireBoard,
      schema: { tags: ['admin'], response: openApiResponse(ThemeViewSchema, 'ThemeView') },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = RejectThemeSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const existing = await fastify.prisma.theme.findUnique({ where: { id: routeParams.id } })
      if (!existing) return reply.status(404).send({ error: 'Theme not found' })
      if (existing.visibility !== 'PENDING_REVIEW') {
        return reply.status(409).send({ error: 'Theme is not pending review' })
      }

      const theme = await fastify.prisma.theme.update({
        where: { id: routeParams.id },
        data: { visibility: 'REJECTED', moderationNote: parsed.data.moderationNote },
      })
      await notifyUserThemeRejected(
        fastify.prisma,
        theme.userId,
        theme,
        parsed.data.moderationNote,
      ).catch((e) => fastify.log.warn(e, 'theme-rejected notification failed'))
      return reply.send(toView(theme))
    },
  )
}

export default adminThemesRoutes
