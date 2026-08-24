// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Admin-only catalog management: register a widget, upload+publish a bundle
// version, moderate it (approve/reject/disable), and manage ADMIN-scope
// installs onto shared surfaces (e.g. the homepage). Publishing is admin-only
// in v1 — see packages/widget-sdk/README.md for the full author-facing flow.

import type { FastifyPluginAsync } from 'fastify'
import {
  AdminDiscoWidgetInstallQuerySchema,
  CreateAdminDiscoWidgetInstallSchema,
  DiscoWidgetAdminItemSchema,
  DiscoWidgetAdminListQuerySchema,
  DiscoWidgetAdminListSchema,
  DiscoWidgetIdParamSchema,
  DiscoWidgetInstallListSchema,
  DiscoWidgetInstallViewSchema,
  ModerateDiscoWidgetSchema,
  PatchDiscoWidgetInstallSchema,
  PrepareDiscoWidgetUploadResponseSchema,
  PrepareDiscoWidgetUploadSchema,
  PublishDiscoWidgetVersionSchema,
  RegisterDiscoWidgetSchema,
  RejectDiscoWidgetSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { getObjectBuffer, presignedPutUrl } from '../../lib/minio.js'
import { assertValidWidgetBundle, sha256Hex, toInstallUpdateData } from '../../lib/disco-widgets.js'

const PRESIGN_TTL_SEC = 900

const ADMIN_ITEM_SELECT = {
  id: true,
  slug: true,
  scope: true,
  status: true,
  name: true,
  description: true,
  authorName: true,
  categories: true,
  iconUrl: true,
  currentVersion: true,
  bundleSizeBytes: true,
  moderationNote: true,
  createdAt: true,
  updatedAt: true,
} as const

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

function bundleKeyFor(slug: string, version: string): string {
  return `disco-widgets/${slug}/${version}/bundle.js`
}

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const adminDiscoWidgetsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/disco-widgets — full catalog, optionally filtered. The
  // admin UI's "install onto a surface" browser reuses this with
  // ?scope=ADMIN&status=APPROVED rather than a separate /store endpoint.
  fastify.get(
    '/api/admin/disco-widgets',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(DiscoWidgetAdminListSchema, 'DiscoWidgetAdminList'),
      },
    },
    async (request, reply) => {
      const parsed = DiscoWidgetAdminListQuerySchema.safeParse(request.query)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widgets = await fastify.prisma.discoWidget.findMany({
        where: {
          ...(parsed.data.scope ? { scope: parsed.data.scope } : {}),
          ...(parsed.data.status ? { status: parsed.data.status } : {}),
        },
        orderBy: { createdAt: 'desc' },
        select: ADMIN_ITEM_SELECT,
      })
      return reply.send({ widgets })
    },
  )

  // POST /api/admin/disco-widgets — register a new widget (status DRAFT until
  // a version is published).
  fastify.post(
    '/api/admin/disco-widgets',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(DiscoWidgetAdminItemSchema, 'DiscoWidgetAdminItem'),
      },
    },
    async (request, reply) => {
      const parsed = RegisterDiscoWidgetSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const existing = await fastify.prisma.discoWidget.findUnique({
        where: { slug: parsed.data.slug },
      })
      if (existing) return reply.status(409).send({ error: 'Slug already in use' })

      const widget = await fastify.prisma.discoWidget.create({
        data: {
          ...parsed.data,
          currentVersion: '0.0.0',
          bundleKey: '',
          bundleHash: '',
          bundleSizeBytes: 0,
        },
        select: ADMIN_ITEM_SELECT,
      })
      return reply.status(201).send(widget)
    },
  )

  // POST /api/admin/disco-widgets/:id/prepare-upload
  fastify.post(
    '/api/admin/disco-widgets/:id/prepare-upload',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(
          PrepareDiscoWidgetUploadResponseSchema,
          'PrepareDiscoWidgetUpload',
        ),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(DiscoWidgetIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PrepareDiscoWidgetUploadSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.discoWidget.findUnique({
        where: { id: routeParams.id },
        select: { slug: true },
      })
      if (!widget) return reply.status(404).send({ error: 'Widget not found' })

      const alreadyPublished = await fastify.prisma.discoWidgetVersion.findUnique({
        where: { widgetId_version: { widgetId: routeParams.id, version: parsed.data.version } },
      })
      if (alreadyPublished) {
        return reply.status(409).send({ error: 'That version is already published — bump it' })
      }

      const bundleKey = bundleKeyFor(widget.slug, parsed.data.version)
      const uploadUrl = await presignedPutUrl(
        bundleKey,
        'application/javascript',
        PRESIGN_TTL_SEC,
        parsed.data.fileSizeBytes,
      )
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()
      return reply.send({ uploadUrl, bundleKey, expiresAt })
    },
  )

  // POST /api/admin/disco-widgets/:id/publish-version — always moves the
  // widget to PENDING, even a previously-APPROVED one: new content needs a
  // fresh review, and the sandbox route only ever trusts an approved hash.
  fastify.post(
    '/api/admin/disco-widgets/:id/publish-version',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(DiscoWidgetAdminItemSchema, 'DiscoWidgetAdminItem'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(DiscoWidgetIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PublishDiscoWidgetVersionSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.discoWidget.findUnique({ where: { id: routeParams.id } })
      if (!widget) return reply.status(404).send({ error: 'Widget not found' })

      const alreadyPublished = await fastify.prisma.discoWidgetVersion.findUnique({
        where: { widgetId_version: { widgetId: widget.id, version: parsed.data.version } },
      })
      if (alreadyPublished) {
        return reply.status(409).send({ error: 'That version is already published — bump it' })
      }

      const bundleKey = bundleKeyFor(widget.slug, parsed.data.version)
      let bytes: Buffer
      try {
        bytes = await getObjectBuffer(bundleKey)
      } catch {
        return reply
          .status(404)
          .send({ error: 'Upload not found — call prepare-upload and PUT the bundle first' })
      }

      try {
        await assertValidWidgetBundle(bytes.toString('utf8'))
      } catch {
        return reply.status(400).send({ error: 'Bundle is not a syntactically valid ES module' })
      }

      const bundleHash = sha256Hex(bytes)

      await fastify.prisma.discoWidgetVersion.create({
        data: {
          widgetId: widget.id,
          version: parsed.data.version,
          bundleKey,
          bundleHash,
          changelog: parsed.data.changelog,
        },
      })
      const updated = await fastify.prisma.discoWidget.update({
        where: { id: widget.id },
        data: {
          currentVersion: parsed.data.version,
          bundleKey,
          bundleHash,
          bundleSizeBytes: bytes.length,
          status: 'PENDING',
          moderationNote: null,
        },
        select: ADMIN_ITEM_SELECT,
      })
      return reply.send(updated)
    },
  )

  // POST /api/admin/disco-widgets/:id/approve
  fastify.post(
    '/api/admin/disco-widgets/:id/approve',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(DiscoWidgetIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = ModerateDiscoWidgetSchema.safeParse(request.body ?? {})
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.discoWidget.findUnique({ where: { id: routeParams.id } })
      if (!widget) return reply.status(404).send({ error: 'Widget not found' })
      if (widget.status !== 'PENDING') {
        return reply.status(409).send({ error: 'Widget is not pending review' })
      }

      const updated = await fastify.prisma.discoWidget.update({
        where: { id: routeParams.id },
        data: { status: 'APPROVED', moderationNote: parsed.data.moderationNote ?? null },
        select: ADMIN_ITEM_SELECT,
      })
      return reply.send(updated)
    },
  )

  // POST /api/admin/disco-widgets/:id/reject
  fastify.post(
    '/api/admin/disco-widgets/:id/reject',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(DiscoWidgetIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = RejectDiscoWidgetSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.discoWidget.findUnique({ where: { id: routeParams.id } })
      if (!widget) return reply.status(404).send({ error: 'Widget not found' })
      if (widget.status !== 'PENDING') {
        return reply.status(409).send({ error: 'Widget is not pending review' })
      }

      const updated = await fastify.prisma.discoWidget.update({
        where: { id: routeParams.id },
        data: { status: 'REJECTED', moderationNote: parsed.data.moderationNote },
        select: ADMIN_ITEM_SELECT,
      })
      return reply.send(updated)
    },
  )

  // POST /api/admin/disco-widgets/:id/disable — pulls it from its store and
  // immediately stops it rendering anywhere it's installed. Only a fresh
  // publish-version (-> PENDING -> approve) brings it back.
  fastify.post(
    '/api/admin/disco-widgets/:id/disable',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(DiscoWidgetIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = ModerateDiscoWidgetSchema.safeParse(request.body ?? {})
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.discoWidget.findUnique({ where: { id: routeParams.id } })
      if (!widget) return reply.status(404).send({ error: 'Widget not found' })
      if (widget.status !== 'APPROVED') {
        return reply.status(409).send({ error: 'Widget is not currently approved' })
      }

      await fastify.prisma.$transaction([
        fastify.prisma.discoWidget.update({
          where: { id: routeParams.id },
          data: { status: 'DISABLED', moderationNote: parsed.data.moderationNote ?? null },
        }),
        fastify.prisma.discoWidgetInstall.updateMany({
          where: { widgetId: routeParams.id },
          data: { enabled: false },
        }),
      ])
      const updated = await fastify.prisma.discoWidget.findUniqueOrThrow({
        where: { id: routeParams.id },
        select: ADMIN_ITEM_SELECT,
      })
      return reply.send(updated)
    },
  )

  // ── ADMIN-scope installs (shared surfaces, e.g. the homepage) ───────────

  fastify.get(
    '/api/admin/disco-widgets/installs',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(DiscoWidgetInstallListSchema, 'AdminDiscoWidgetInstallList'),
      },
    },
    async (request, reply) => {
      const parsed = AdminDiscoWidgetInstallQuerySchema.safeParse(request.query)
      if (!parsed.success) return zodError(reply, parsed.error)

      const installs = await fastify.prisma.discoWidgetInstall.findMany({
        where: { adminSurface: parsed.data.surface },
        orderBy: { position: 'asc' },
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.send({ installs })
    },
  )

  fastify.post(
    '/api/admin/disco-widgets/installs',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(DiscoWidgetInstallViewSchema, 'AdminDiscoWidgetInstallView'),
      },
    },
    async (request, reply) => {
      const parsed = CreateAdminDiscoWidgetInstallSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.discoWidget.findUnique({
        where: { id: parsed.data.widgetId },
      })
      if (!widget || widget.scope !== 'ADMIN' || widget.status !== 'APPROVED') {
        return reply.status(404).send({ error: 'Widget not found' })
      }

      const existing = await fastify.prisma.discoWidgetInstall.findUnique({
        where: {
          widgetId_adminSurface: { widgetId: widget.id, adminSurface: parsed.data.surface },
        },
      })
      if (existing) return reply.status(409).send({ error: 'Already installed on that surface' })

      const position = await fastify.prisma.discoWidgetInstall.count({
        where: { adminSurface: parsed.data.surface },
      })

      const install = await fastify.prisma.discoWidgetInstall.create({
        data: { widgetId: widget.id, adminSurface: parsed.data.surface, position },
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.status(201).send(install)
    },
  )

  fastify.patch(
    '/api/admin/disco-widgets/installs/:id',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(DiscoWidgetIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchDiscoWidgetInstallSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const existing = await fastify.prisma.discoWidgetInstall.findFirst({
        where: { id: routeParams.id, adminSurface: { not: null } },
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
    '/api/admin/disco-widgets/installs/:id',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(DiscoWidgetIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.discoWidgetInstall.deleteMany({
        where: { id: routeParams.id, adminSurface: { not: null } },
      })
      if (count === 0) return reply.status(404).send({ error: 'Install not found' })
      return reply.status(204).send()
    },
  )
}

export default adminDiscoWidgetsRoutes
