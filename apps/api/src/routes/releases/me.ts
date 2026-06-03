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
  PatchReleaseSchema,
  parseRouteParams,
} from '@tahti/shared'
import { resolveReleaseArtworkUrl } from '../../lib/release-artwork.js'

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
  fastify.get('/api/me/releases', { preHandler: requireAuth }, async (request, reply) => {
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
        pLine: true,
        cLine: true,
        labelImprint: true,
        credits: true,
        revelatorStatus: true,
        revelatorId: true,
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
  })

  fastify.post('/api/me/releases', { preHandler: requireAuth }, async (request, reply) => {
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
  })

  fastify.patch('/api/me/releases/:id', { preHandler: requireAuth }, async (request, reply) => {
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
    return reply.send(release)
  })

  fastify.get(
    '/api/me/releases/:id/catalog',
    { preHandler: requireAuth },
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
    { preHandler: requireAuth },
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
}

export default meReleaseRoutes
