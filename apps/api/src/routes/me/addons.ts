// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Install CRUD for the two self-service Addon scopes: a listener's own
// Discover-page widgets (LISTENER) and an artist's own public-page widgets
// (ARTIST). Admin-surface installs live in routes/admin/addons.ts;
// public "render someone else's installed widgets" feeds live in
// routes/addons/public.ts.

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import {
  CreateAddonInstallSchema,
  AddonIdParamSchema,
  AddonInstallListSchema,
  AddonInstallViewSchema,
  PatchAddonInstallSchema,
  openApiNoContentResponse,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { requireArtist, requireAuth } from '../../plugins/auth.js'
import { toInstallUpdateData } from '../../lib/addons.js'

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

const meAddonsRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Listener scope ─────────────────────────────────────────────────────

  fastify.get(
    '/api/me/addons/installs',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['addons'],
        summary: "List the caller's listener add-on installs",
        description: 'Discover-page widgets installed for the signed-in listener.',
        response: openApiResponse(AddonInstallListSchema, 'AddonInstallList'),
      },
    },
    async (request, reply) => {
      const installs = await fastify.prisma.addonInstall.findMany({
        where: { listenerUserId: request.sessionUser!.id },
        orderBy: { position: 'asc' },
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.send({ installs })
    },
  )

  fastify.post(
    '/api/me/addons/installs',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['addons'],
        summary: 'Install a listener add-on',
        description:
          'Installs an APPROVED LISTENER widget. Answers 201. JSON body is validated in the handler, not by Fastify AJV.',
        response: openApiResponses([
          { status: 201, schema: AddonInstallViewSchema, name: 'AddonInstallView' },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = CreateAddonInstallSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.addon.findUnique({
        where: { id: parsed.data.widgetId },
      })
      if (!widget || widget.scope !== 'LISTENER' || widget.status !== 'APPROVED') {
        return reply.status(404).send({ error: 'Widget not found' })
      }

      const existing = await fastify.prisma.addonInstall.findUnique({
        where: {
          widgetId_listenerUserId: { widgetId: widget.id, listenerUserId: request.sessionUser!.id },
        },
      })
      if (existing) return reply.status(409).send({ error: 'Already installed' })

      const position = await fastify.prisma.addonInstall.count({
        where: { listenerUserId: request.sessionUser!.id },
      })

      const install = await fastify.prisma.addonInstall.create({
        data: {
          widgetId: widget.id,
          listenerUserId: request.sessionUser!.id,
          position,
          configJson: (widget.defaultConfigJson ?? {}) as Prisma.InputJsonValue,
        },
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.status(201).send(install)
    },
  )

  fastify.patch(
    '/api/me/addons/installs/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['addons'],
        summary: 'Patch a listener add-on install',
        description:
          "Updates config/position for one of the caller's listener installs. JSON body is validated in the handler, not by Fastify AJV.",
        response: openApiResponse(AddonInstallViewSchema, 'AddonInstallView'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(AddonIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchAddonInstallSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const existing = await fastify.prisma.addonInstall.findFirst({
        where: { id: routeParams.id, listenerUserId: request.sessionUser!.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Install not found' })

      const install = await fastify.prisma.addonInstall.update({
        where: { id: routeParams.id },
        data: toInstallUpdateData(parsed.data),
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.send(install)
    },
  )

  fastify.delete(
    '/api/me/addons/installs/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['addons'],
        summary: 'Uninstall a listener add-on',
        description: "Removes one of the caller's listener installs. Answers 204.",
        response: openApiNoContentResponse(),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(AddonIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.addonInstall.deleteMany({
        where: { id: routeParams.id, listenerUserId: request.sessionUser!.id },
      })
      if (count === 0) return reply.status(404).send({ error: 'Install not found' })
      return reply.status(204).send()
    },
  )

  // ── Artist scope ───────────────────────────────────────────────────────

  fastify.get(
    '/api/me/channel/addons/installs',
    {
      preHandler: requireArtist,
      schema: {
        tags: ['addons'],
        summary: "List the channel's artist add-on installs",
        description: 'Public-page widgets installed on the signed-in artist channel.',
        response: openApiResponse(AddonInstallListSchema, 'AddonChannelInstallList'),
      },
    },
    async (request, reply) => {
      const installs = await fastify.prisma.addonInstall.findMany({
        where: { channelId: request.channel!.id },
        orderBy: { position: 'asc' },
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.send({ installs })
    },
  )

  fastify.post(
    '/api/me/channel/addons/installs',
    {
      preHandler: requireArtist,
      schema: {
        tags: ['addons'],
        summary: 'Install an artist add-on on the channel',
        description:
          'Installs an APPROVED ARTIST widget. Answers 201. JSON body is validated in the handler, not by Fastify AJV.',
        response: openApiResponses([
          { status: 201, schema: AddonInstallViewSchema, name: 'AddonChannelInstallView' },
        ]),
      },
    },
    async (request, reply) => {
      const parsed = CreateAddonInstallSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.addon.findUnique({
        where: { id: parsed.data.widgetId },
      })
      if (!widget || widget.scope !== 'ARTIST' || widget.status !== 'APPROVED') {
        return reply.status(404).send({ error: 'Widget not found' })
      }

      const existing = await fastify.prisma.addonInstall.findUnique({
        where: { widgetId_channelId: { widgetId: widget.id, channelId: request.channel!.id } },
      })
      if (existing) return reply.status(409).send({ error: 'Already installed' })

      const position = await fastify.prisma.addonInstall.count({
        where: { channelId: request.channel!.id },
      })

      const install = await fastify.prisma.addonInstall.create({
        data: {
          widgetId: widget.id,
          channelId: request.channel!.id,
          position,
          configJson: (widget.defaultConfigJson ?? {}) as Prisma.InputJsonValue,
        },
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.status(201).send(install)
    },
  )

  fastify.patch(
    '/api/me/channel/addons/installs/:id',
    {
      preHandler: requireArtist,
      schema: {
        tags: ['addons'],
        summary: 'Patch a channel add-on install',
        description:
          "Updates config/position for one artist-scope install on the caller's channel. JSON body is validated in the handler, not by Fastify AJV.",
        response: openApiResponse(AddonInstallViewSchema, 'AddonChannelInstallView'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(AddonIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchAddonInstallSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const existing = await fastify.prisma.addonInstall.findFirst({
        where: { id: routeParams.id, channelId: request.channel!.id },
      })
      if (!existing) return reply.status(404).send({ error: 'Install not found' })

      const install = await fastify.prisma.addonInstall.update({
        where: { id: routeParams.id },
        data: toInstallUpdateData(parsed.data),
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.send(install)
    },
  )

  fastify.delete(
    '/api/me/channel/addons/installs/:id',
    {
      preHandler: requireArtist,
      schema: {
        tags: ['addons'],
        summary: 'Uninstall a channel add-on',
        description: "Removes one artist-scope install from the caller's channel. Answers 204.",
        response: openApiNoContentResponse(),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(AddonIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.addonInstall.deleteMany({
        where: { id: routeParams.id, channelId: request.channel!.id },
      })
      if (count === 0) return reply.status(404).send({ error: 'Install not found' })
      return reply.status(204).send()
    },
  )
}

export default meAddonsRoutes
