// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Install CRUD for the two self-service Disco-widget scopes: a listener's own
// Discover-page widgets (LISTENER) and an artist's own public-page widgets
// (ARTIST). Admin-surface installs live in routes/admin/disco-widgets.ts;
// public "render someone else's installed widgets" feeds live in
// routes/disco-widgets/public.ts.

import type { FastifyPluginAsync } from 'fastify'
import {
  CreateDiscoWidgetInstallSchema,
  DiscoWidgetIdParamSchema,
  DiscoWidgetInstallListSchema,
  DiscoWidgetInstallViewSchema,
  PatchDiscoWidgetInstallSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireArtist, requireAuth } from '../../plugins/auth.js'
import { toInstallUpdateData } from '../../lib/disco-widgets.js'

const STORE_ITEM_SELECT = {
  id: true,
  slug: true,
  name: true,
  description: true,
  authorName: true,
  categories: true,
  iconUrl: true,
  currentVersion: true,
} as const

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const meDiscoWidgetsRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Listener scope ─────────────────────────────────────────────────────

  fastify.get(
    '/api/me/disco-widgets/installs',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['disco-widgets'],
        response: openApiResponse(DiscoWidgetInstallListSchema, 'DiscoWidgetInstallList'),
      },
    },
    async (request, reply) => {
      const installs = await fastify.prisma.discoWidgetInstall.findMany({
        where: { listenerUserId: request.sessionUser!.id },
        orderBy: { position: 'asc' },
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.send({ installs })
    },
  )

  fastify.post(
    '/api/me/disco-widgets/installs',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['disco-widgets'],
        response: openApiResponse(DiscoWidgetInstallViewSchema, 'DiscoWidgetInstallView'),
      },
    },
    async (request, reply) => {
      const parsed = CreateDiscoWidgetInstallSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.discoWidget.findUnique({
        where: { id: parsed.data.widgetId },
      })
      if (!widget || widget.scope !== 'LISTENER' || widget.status !== 'APPROVED') {
        return reply.status(404).send({ error: 'Widget not found' })
      }

      const existing = await fastify.prisma.discoWidgetInstall.findUnique({
        where: {
          widgetId_listenerUserId: { widgetId: widget.id, listenerUserId: request.sessionUser!.id },
        },
      })
      if (existing) return reply.status(409).send({ error: 'Already installed' })

      const position = await fastify.prisma.discoWidgetInstall.count({
        where: { listenerUserId: request.sessionUser!.id },
      })

      const install = await fastify.prisma.discoWidgetInstall.create({
        data: { widgetId: widget.id, listenerUserId: request.sessionUser!.id, position },
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.status(201).send(install)
    },
  )

  fastify.patch(
    '/api/me/disco-widgets/installs/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(DiscoWidgetIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchDiscoWidgetInstallSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const existing = await fastify.prisma.discoWidgetInstall.findFirst({
        where: { id: routeParams.id, listenerUserId: request.sessionUser!.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Install not found' })

      const install = await fastify.prisma.discoWidgetInstall.update({
        where: { id: routeParams.id },
        data: toInstallUpdateData(parsed.data),
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.send(install)
    },
  )

  fastify.delete(
    '/api/me/disco-widgets/installs/:id',
    { preHandler: requireAuth },
    async (request, reply) => {
      const routeParams = parseRouteParams(DiscoWidgetIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.discoWidgetInstall.deleteMany({
        where: { id: routeParams.id, listenerUserId: request.sessionUser!.id },
      })
      if (count === 0) return reply.status(404).send({ error: 'Install not found' })
      return reply.status(204).send()
    },
  )

  // ── Artist scope ───────────────────────────────────────────────────────

  fastify.get(
    '/api/me/channel/disco-widgets/installs',
    {
      preHandler: requireArtist,
      schema: {
        tags: ['disco-widgets'],
        response: openApiResponse(DiscoWidgetInstallListSchema, 'DiscoWidgetChannelInstallList'),
      },
    },
    async (request, reply) => {
      const installs = await fastify.prisma.discoWidgetInstall.findMany({
        where: { channelId: request.channel!.id },
        orderBy: { position: 'asc' },
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.send({ installs })
    },
  )

  fastify.post(
    '/api/me/channel/disco-widgets/installs',
    {
      preHandler: requireArtist,
      schema: {
        tags: ['disco-widgets'],
        response: openApiResponse(DiscoWidgetInstallViewSchema, 'DiscoWidgetChannelInstallView'),
      },
    },
    async (request, reply) => {
      const parsed = CreateDiscoWidgetInstallSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.discoWidget.findUnique({
        where: { id: parsed.data.widgetId },
      })
      if (!widget || widget.scope !== 'ARTIST' || widget.status !== 'APPROVED') {
        return reply.status(404).send({ error: 'Widget not found' })
      }

      const existing = await fastify.prisma.discoWidgetInstall.findUnique({
        where: { widgetId_channelId: { widgetId: widget.id, channelId: request.channel!.id } },
      })
      if (existing) return reply.status(409).send({ error: 'Already installed' })

      const position = await fastify.prisma.discoWidgetInstall.count({
        where: { channelId: request.channel!.id },
      })

      const install = await fastify.prisma.discoWidgetInstall.create({
        data: { widgetId: widget.id, channelId: request.channel!.id, position },
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.status(201).send(install)
    },
  )

  fastify.patch(
    '/api/me/channel/disco-widgets/installs/:id',
    { preHandler: requireArtist },
    async (request, reply) => {
      const routeParams = parseRouteParams(DiscoWidgetIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchDiscoWidgetInstallSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const existing = await fastify.prisma.discoWidgetInstall.findFirst({
        where: { id: routeParams.id, channelId: request.channel!.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Install not found' })

      const install = await fastify.prisma.discoWidgetInstall.update({
        where: { id: routeParams.id },
        data: toInstallUpdateData(parsed.data),
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.send(install)
    },
  )

  fastify.delete(
    '/api/me/channel/disco-widgets/installs/:id',
    { preHandler: requireArtist },
    async (request, reply) => {
      const routeParams = parseRouteParams(DiscoWidgetIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.discoWidgetInstall.deleteMany({
        where: { id: routeParams.id, channelId: request.channel!.id },
      })
      if (count === 0) return reply.status(404).send({ error: 'Install not found' })
      return reply.status(204).send()
    },
  )
}

export default meDiscoWidgetsRoutes
