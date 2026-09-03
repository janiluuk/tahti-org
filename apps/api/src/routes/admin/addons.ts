// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Admin-only catalog management: register a widget, upload+publish a bundle
// version, moderate it (approve/reject/disable), and manage ADMIN-scope
// installs onto shared surfaces (e.g. the homepage). Publishing is admin-only
// in v1 — see packages/widget-sdk/README.md for the full author-facing flow.

import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@tahti/db'
import {
  AdminAddonInstallQuerySchema,
  CreateAdminAddonInstallSchema,
  AddonAdminItemSchema,
  AddonAdminListQuerySchema,
  AddonAdminListSchema,
  AddonIdParamSchema,
  AddonInstallListSchema,
  AddonInstallViewSchema,
  ModerateAddonSchema,
  PatchAddonInstallSchema,
  PrepareAddonUploadResponseSchema,
  PrepareAddonUploadSchema,
  PublishAddonVersionSchema,
  RegisterAddonSchema,
  RejectAddonSchema,
  SetAddonDefaultConfigSchema,
  openApiResponse,
  parseRouteParams,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { getObjectBuffer, presignedPutUrl } from '../../lib/minio.js'
import { assertValidWidgetBundle, sha256Hex, toInstallUpdateData } from '../../lib/addons.js'

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
  defaultConfigJson: true,
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
  return `addons/${slug}/${version}/bundle.js`
}

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: { issues: Array<{ message?: string }> },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const adminAddonsRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/admin/addons — full catalog, optionally filtered. The
  // admin UI's "install onto a surface" browser reuses this with
  // ?scope=ADMIN&status=APPROVED rather than a separate /store endpoint.
  fastify.get(
    '/api/admin/addons',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AddonAdminListSchema, 'AddonAdminList'),
      },
    },
    async (request, reply) => {
      const parsed = AddonAdminListQuerySchema.safeParse(request.query)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widgets = await fastify.prisma.addon.findMany({
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

  // POST /api/admin/addons — register a new widget (status DRAFT until
  // a version is published).
  fastify.post(
    '/api/admin/addons',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AddonAdminItemSchema, 'AddonAdminItem'),
      },
    },
    async (request, reply) => {
      const parsed = RegisterAddonSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const existing = await fastify.prisma.addon.findUnique({
        where: { slug: parsed.data.slug },
      })
      if (existing) return reply.status(409).send({ error: 'Slug already in use' })

      const widget = await fastify.prisma.addon.create({
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

  // POST /api/admin/addons/:id/prepare-upload
  fastify.post(
    '/api/admin/addons/:id/prepare-upload',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(PrepareAddonUploadResponseSchema, 'PrepareAddonUpload'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(AddonIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PrepareAddonUploadSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.addon.findUnique({
        where: { id: routeParams.id },
        select: { slug: true },
      })
      if (!widget) return reply.status(404).send({ error: 'Widget not found' })

      const alreadyPublished = await fastify.prisma.addonVersion.findUnique({
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

  // POST /api/admin/addons/:id/publish-version — always moves the
  // widget to PENDING, even a previously-APPROVED one: new content needs a
  // fresh review, and the sandbox route only ever trusts an approved hash.
  fastify.post(
    '/api/admin/addons/:id/publish-version',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AddonAdminItemSchema, 'AddonAdminItem'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(AddonIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PublishAddonVersionSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.addon.findUnique({ where: { id: routeParams.id } })
      if (!widget) return reply.status(404).send({ error: 'Widget not found' })

      const alreadyPublished = await fastify.prisma.addonVersion.findUnique({
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

      await fastify.prisma.addonVersion.create({
        data: {
          widgetId: widget.id,
          version: parsed.data.version,
          bundleKey,
          bundleHash,
          changelog: parsed.data.changelog,
        },
      })
      const updated = await fastify.prisma.addon.update({
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

  // POST /api/admin/addons/:id/approve
  fastify.post(
    '/api/admin/addons/:id/approve',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(AddonIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = ModerateAddonSchema.safeParse(request.body ?? {})
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.addon.findUnique({ where: { id: routeParams.id } })
      if (!widget) return reply.status(404).send({ error: 'Widget not found' })
      if (widget.status !== 'PENDING') {
        return reply.status(409).send({ error: 'Widget is not pending review' })
      }

      const updated = await fastify.prisma.addon.update({
        where: { id: routeParams.id },
        data: { status: 'APPROVED', moderationNote: parsed.data.moderationNote ?? null },
        select: ADMIN_ITEM_SELECT,
      })
      return reply.send(updated)
    },
  )

  // POST /api/admin/addons/:id/reject
  fastify.post(
    '/api/admin/addons/:id/reject',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(AddonIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = RejectAddonSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.addon.findUnique({ where: { id: routeParams.id } })
      if (!widget) return reply.status(404).send({ error: 'Widget not found' })
      if (widget.status !== 'PENDING') {
        return reply.status(409).send({ error: 'Widget is not pending review' })
      }

      const updated = await fastify.prisma.addon.update({
        where: { id: routeParams.id },
        data: { status: 'REJECTED', moderationNote: parsed.data.moderationNote },
        select: ADMIN_ITEM_SELECT,
      })
      return reply.send(updated)
    },
  )

  // POST /api/admin/addons/:id/disable — pulls it from its store and
  // immediately stops it rendering anywhere it's installed. Only a fresh
  // publish-version (-> PENDING -> approve) brings it back.
  fastify.post(
    '/api/admin/addons/:id/disable',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(AddonIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = ModerateAddonSchema.safeParse(request.body ?? {})
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.addon.findUnique({ where: { id: routeParams.id } })
      if (!widget) return reply.status(404).send({ error: 'Widget not found' })
      if (widget.status !== 'APPROVED') {
        return reply.status(409).send({ error: 'Widget is not currently approved' })
      }

      await fastify.prisma.$transaction([
        fastify.prisma.addon.update({
          where: { id: routeParams.id },
          data: { status: 'DISABLED', moderationNote: parsed.data.moderationNote ?? null },
        }),
        fastify.prisma.addonInstall.updateMany({
          where: { widgetId: routeParams.id },
          data: { enabled: false },
        }),
      ])
      const updated = await fastify.prisma.addon.findUniqueOrThrow({
        where: { id: routeParams.id },
        select: ADMIN_ITEM_SELECT,
      })
      return reply.send(updated)
    },
  )

  // POST /api/admin/addons/:id/default-config — board-only: sets (or
  // clears, with null) the starting configJson every NEW install of this
  // widget gets from here on, across every scope. Existing installs are
  // untouched — "default" seeds future installs, it doesn't retroactively
  // overwrite what artists/listeners have already configured.
  fastify.post(
    '/api/admin/addons/:id/default-config',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AddonAdminItemSchema, 'AddonAdminItem'),
      },
    },
    async (request, reply) => {
      const routeParams = parseRouteParams(AddonIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = SetAddonDefaultConfigSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.addon.findUnique({ where: { id: routeParams.id } })
      if (!widget) return reply.status(404).send({ error: 'Widget not found' })

      const updated = await fastify.prisma.addon.update({
        where: { id: routeParams.id },
        data: {
          defaultConfigJson:
            parsed.data.defaultConfigJson === null
              ? Prisma.DbNull
              : (parsed.data.defaultConfigJson as Prisma.InputJsonValue),
        },
        select: ADMIN_ITEM_SELECT,
      })
      return reply.send(updated)
    },
  )

  // ── ADMIN-scope installs (shared surfaces, e.g. the homepage) ───────────

  fastify.get(
    '/api/admin/addons/installs',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AddonInstallListSchema, 'AdminAddonInstallList'),
      },
    },
    async (request, reply) => {
      const parsed = AdminAddonInstallQuerySchema.safeParse(request.query)
      if (!parsed.success) return zodError(reply, parsed.error)

      const installs = await fastify.prisma.addonInstall.findMany({
        where: { adminSurface: parsed.data.surface },
        orderBy: { position: 'asc' },
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.send({ installs })
    },
  )

  fastify.post(
    '/api/admin/addons/installs',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        response: openApiResponse(AddonInstallViewSchema, 'AdminAddonInstallView'),
      },
    },
    async (request, reply) => {
      const parsed = CreateAdminAddonInstallSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const widget = await fastify.prisma.addon.findUnique({
        where: { id: parsed.data.widgetId },
      })
      if (!widget || widget.scope !== 'ADMIN' || widget.status !== 'APPROVED') {
        return reply.status(404).send({ error: 'Widget not found' })
      }

      const existing = await fastify.prisma.addonInstall.findUnique({
        where: {
          widgetId_adminSurface: { widgetId: widget.id, adminSurface: parsed.data.surface },
        },
      })
      if (existing) return reply.status(409).send({ error: 'Already installed on that surface' })

      const position = await fastify.prisma.addonInstall.count({
        where: { adminSurface: parsed.data.surface },
      })

      const install = await fastify.prisma.addonInstall.create({
        data: {
          widgetId: widget.id,
          adminSurface: parsed.data.surface,
          position,
          configJson: (widget.defaultConfigJson ?? {}) as Prisma.InputJsonValue,
        },
        include: { widget: { select: STORE_ITEM_SELECT } },
      })
      return reply.status(201).send(install)
    },
  )

  fastify.patch(
    '/api/admin/addons/installs/:id',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(AddonIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const parsed = PatchAddonInstallSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const existing = await fastify.prisma.addonInstall.findFirst({
        where: { id: routeParams.id, adminSurface: { not: null } },
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
    '/api/admin/addons/installs/:id',
    { preHandler: requireBoard },
    async (request, reply) => {
      const routeParams = parseRouteParams(AddonIdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })

      const { count } = await fastify.prisma.addonInstall.deleteMany({
        where: { id: routeParams.id, adminSurface: { not: null } },
      })
      if (count === 0) return reply.status(404).send({ error: 'Install not found' })
      return reply.status(204).send()
    },
  )
}

export default adminAddonsRoutes
