// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import { requireAuth } from '../../plugins/auth.js'
import {
  buildReleaseExportPack,
  catalogPatchFromBody,
  releaseCatalogSelect,
} from '../../lib/release-catalog.js'
import {
  IdParamSchema,
  computeReleaseChecklist,
  CreateReleaseSchema,
  MeReleaseDetailSchema,
  MeReleaseListSchema,
  PatchReleaseSchema,
  ReleaseCatalogViewSchema,
  ReleaseImportBodySchema,
  ReleaseImportResultSchema,
  ReleaseVisualPatchSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { resolveReleaseArtworkUrl } from '../../lib/release-artwork.js'
import { parseReleaseImportCsv } from '../../lib/release-import.js'
import { queueReleaseSocialPost } from '../../lib/social-post.js'

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
}

function zodError(
  reply: { status: (n: number) => { send: (b: unknown) => unknown } },
  err: {
    issues: Array<{ message?: string }>
  },
) {
  return reply.status(400).send({ error: err.issues[0]?.message ?? 'Invalid request body' })
}

const meReleaseRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/releases',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(MeReleaseListSchema, 'MeReleaseList'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const releases = await fastify.prisma.release.findMany({
        where: { userId: user.id },
        orderBy: { releaseDate: 'desc' },
        select: {
          id: true,
          title: true,
          type: true,
          state: true,
          releaseDate: true,
          description: true,
          artworkUrl: true,
          artworkKey: true,
          smartLinkSlug: true,
          smartLinkViewCount: true,
          smartLinkTargets: true,
          upc: true,
          musicbrainzReleaseId: true,
          musicbrainzArtistId: true,
          discogsReleaseId: true,
          pLine: true,
          cLine: true,
          labelImprint: true,
          credits: true,
          revelatorStatus: true,
          revelatorId: true,
          visualPreset: true,
          colorSchemeJson: true,
          paletteJson: true,
          tracks: {
            orderBy: { position: 'asc' },
            select: { id: true, position: true, title: true, isrc: true, status: true },
          },
          _count: { select: { tracks: true } },
        },
      })
      return reply.send(
        await Promise.all(
          releases.map(async (r) => ({
            ...r,
            artworkUrl: await resolveReleaseArtworkUrl(r),
            checklist: computeReleaseChecklist(r),
          })),
        ),
      )
    },
  )

  fastify.post(
    '/api/me/releases',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponses([
          { status: 201, schema: MeReleaseDetailSchema, name: 'MeReleaseDetail' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = CreateReleaseSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const body = parsed.data

      if (Number.isNaN(body.releaseDate.getTime())) {
        return reply.status(400).send({ error: 'Invalid releaseDate' })
      }

      const baseSlug = `${user.username}-${slugify(body.title)}`
      let smartLinkSlug = baseSlug
      for (let i = 0; i < 5; i++) {
        const clash = await fastify.prisma.release.findUnique({ where: { smartLinkSlug } })
        if (!clash) break
        smartLinkSlug = `${baseSlug}-${nanoid(6)}`
      }

      const tracks = (body.tracks ?? []).slice(0, 50)
      const release = await fastify.prisma.release.create({
        data: {
          userId: user.id,
          title: body.title,
          type: body.type,
          releaseDate: body.releaseDate,
          description: body.description ?? null,
          artworkUrl: body.artworkUrl ?? null,
          smartLinkSlug,
          tracks: {
            create: tracks.map((t, i) => ({
              position: i + 1,
              title: t.title,
              durationSec: t.durationSec ?? null,
              archiveItemId: t.archiveItemId ?? null,
            })),
          },
        },
        include: { tracks: { orderBy: { position: 'asc' } } },
      })

      return reply.status(201).send(release)
    },
  )

  fastify.patch(
    '/api/me/releases/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(MeReleaseDetailSchema, 'MeReleaseDetail'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams
      const parsed = PatchReleaseSchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)
      const body = parsed.data

      const existing = await fastify.prisma.release.findFirst({
        where: { id, userId: user.id },
        include: { _count: { select: { tracks: true } } },
      })
      if (!existing) return reply.status(404).send({ error: 'Release not found' })

      const data: {
        state?: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
        publishedAt?: Date | null
        smartLinkTargets?: Record<string, string>
        description?: string | null
      } = {}

      if (body.smartLinkTargets !== undefined) {
        data.smartLinkTargets = body.smartLinkTargets ?? {}
      }
      if (body.description !== undefined) {
        data.description = body.description || null
      }

      if (body.state) {
        if (body.state === 'PUBLISHED' && existing._count.tracks < 1) {
          return reply.status(400).send({ error: 'Add at least one track before publishing' })
        }
        data.state = body.state
        data.publishedAt = body.state === 'PUBLISHED' ? new Date() : null
      }

      const release = await fastify.prisma.release.update({
        where: { id },
        data,
        include: { tracks: { orderBy: { position: 'asc' } } },
      })

      if (body.state === 'PUBLISHED' && existing.state !== 'PUBLISHED') {
        queueReleaseSocialPost(fastify.prisma, user.id, id).catch((err: unknown) =>
          request.log.warn({ err, releaseId: id }, 'social post enqueue failed'),
        )
      }

      return reply.send(release)
    },
  )

  fastify.get(
    '/api/me/releases/:id/catalog',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(ReleaseCatalogViewSchema, 'ReleaseCatalog'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const release = await fastify.prisma.release.findFirst({
        where: { id, userId: user.id },
        select: releaseCatalogSelect,
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      const checklist = computeReleaseChecklist(release)
      return reply.send({ ...release, checklist })
    },
  )

  fastify.patch(
    '/api/me/releases/:id/catalog',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        response: openApiResponse(ReleaseCatalogViewSchema, 'ReleaseCatalog'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const existing = await fastify.prisma.release.findFirst({
        where: { id, userId: user.id },
        select: { id: true },
      })
      if (!existing) return reply.status(404).send({ error: 'Release not found' })

      const patch = catalogPatchFromBody(request.body)
      if (!patch.ok) return reply.status(400).send({ error: patch.error })

      const release = await fastify.prisma.release.update({
        where: { id },
        data: patch.data,
        select: releaseCatalogSelect,
      })
      return reply.send({
        ...release,
        checklist: computeReleaseChecklist(release),
      })
    },
  )

  fastify.get(
    '/api/me/releases/:id/export.json',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const release = await fastify.prisma.release.findFirst({
        where: { id, userId: user.id },
        select: {
          ...releaseCatalogSelect,
          user: { select: { username: true, displayName: true } },
        },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      return reply
        .header(
          'Content-Disposition',
          `attachment; filename="release-${release.smartLinkSlug}.json"`,
        )
        .send(buildReleaseExportPack(release))
    },
  )

  fastify.post(
    '/api/me/releases/import',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['releases'],
        description: 'M12: bulk import releases from CSV (one row per track)',
        response: openApiResponse(ReleaseImportResultSchema, 'ReleaseImportResult'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = ReleaseImportBodySchema.safeParse(request.body)
      if (!parsed.success) return zodError(reply, parsed.error)

      const { groups, errors } = parseReleaseImportCsv(parsed.data.csv)
      if (groups.length === 0) {
        return reply.status(400).send({
          error: errors[0] ?? 'No valid rows in CSV',
        })
      }
      if (groups.length > 100) {
        return reply.status(400).send({ error: 'Maximum 100 releases per import' })
      }

      const releaseIds: string[] = []
      let skipped = 0

      for (const trackRows of groups) {
        const head = trackRows[0]!
        const baseSlug = `${user.username}-${slugify(head.releaseTitle)}`
        let smartLinkSlug = baseSlug
        for (let i = 0; i < 5; i++) {
          const clash = await fastify.prisma.release.findUnique({ where: { smartLinkSlug } })
          if (!clash) break
          smartLinkSlug = `${baseSlug}-${nanoid(6)}`
        }

        try {
          const release = await fastify.prisma.release.create({
            data: {
              userId: user.id,
              title: head.releaseTitle,
              type: head.type,
              releaseDate: head.releaseDate,
              description: head.description ?? null,
              upc: head.upc ?? null,
              smartLinkSlug,
              state: 'DRAFT',
              tracks: {
                create: trackRows.slice(0, 50).map((t, i) => ({
                  position: i + 1,
                  title: t.trackTitle,
                  isrc: t.isrc ?? null,
                })),
              },
            },
          })
          releaseIds.push(release.id)
        } catch {
          skipped++
          errors.push(`Failed to create release "${head.releaseTitle}"`)
        }
      }

      return reply.send({
        created: releaseIds.length,
        skipped,
        releaseIds,
        errors,
      })
    },
  )
  // M31: PLAT-071/074 — release visual preset + color scheme
  fastify.patch(
    '/api/me/releases/:id/visual',
    { preHandler: requireAuth },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const parsed = ReleaseVisualPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
      }

      const existing = await fastify.prisma.release.findFirst({
        where: { id, userId: user.id },
        select: { id: true },
      })
      if (!existing) return reply.status(404).send({ error: 'Release not found' })

      const updated = await fastify.prisma.release.update({
        where: { id },
        data: {
          ...(parsed.data.visualPreset !== undefined
            ? { visualPreset: parsed.data.visualPreset }
            : {}),
          ...(parsed.data.colorScheme !== undefined
            ? {
                colorSchemeJson: parsed.data.colorScheme
                  ? JSON.stringify(parsed.data.colorScheme)
                  : null,
              }
            : {}),
        },
        select: { visualPreset: true, colorSchemeJson: true, paletteJson: true },
      })
      return reply.send(updated)
    },
  )
}

export default meReleaseRoutes
