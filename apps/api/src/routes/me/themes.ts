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
  openApiNoContentResponse,
  openApiResponse,
  openApiResponses,
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
      schema: {
        tags: ['themes'],
        summary: "List the caller's themes",
        description: 'Private and in-review themes owned by the signed-in user.',
        response: openApiResponse(ThemeListSchema, 'ThemeList'),
      },
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
      schema: {
        tags: ['themes'],
        summary: 'Create a private theme',
        description:
          'Saves a new private theme. Answers 201. JSON body is validated in the handler, not by Fastify AJV.',
        response: openApiResponses([{ status: 201, schema: ThemeViewSchema, name: 'ThemeView' }]),
      },
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

  fastify.patch(
    '/api/me/themes/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['themes'],
        summary: 'Patch a private theme',
        description:
          'Updates name/vars/dark. Answers 409 while the theme is under review. JSON body is validated in the handler, not by Fastify AJV.',
        response: openApiResponse(ThemeViewSchema, 'ThemeView'),
      },
    },
    async (request, reply) => {
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
    },
  )

  fastify.delete(
    '/api/me/themes/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['themes'],
        summary: 'Delete a theme',
        description: "Deletes one of the caller's themes. Answers 204.",
        response: openApiNoContentResponse(),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.theme.deleteMany({
        where: { id: routeParams.id, userId: request.sessionUser!.id },
      })
      if (count === 0) return reply.status(404).send({ error: 'Theme not found' })
      return reply.status(204).send()
    },
  )

  // POST /api/me/themes/:id/submit-public — enters the admin review queue.
  fastify.post(
    '/api/me/themes/:id/submit-public',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['themes'],
        summary: 'Submit a theme for public review',
        description:
          'Moves a PRIVATE or REJECTED theme into PENDING_REVIEW. Does not publish it — the board approve path opens a tahti-registry pull request.',
        response: openApiResponse(ThemeViewSchema, 'ThemeView'),
      },
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
