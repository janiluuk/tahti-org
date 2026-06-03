// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { nanoid } from 'nanoid'
import { requireAuth } from '../../plugins/auth.js'
import { parseSmartLinkTargets } from '../../lib/smartlink.js'
import {
  buildReleaseExportPack,
  catalogPatchFromBody,
  releaseCatalogSelect,
} from '../../lib/release-catalog.js'
import { computeReleaseChecklist } from '@tahti/shared'

const VALID_TYPES = ['SINGLE', 'EP', 'ALBUM', 'COMPILATION', 'REMIX'] as const

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
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
        tracks: {
          orderBy: { position: 'asc' },
          select: { id: true, position: true, title: true, isrc: true },
        },
        _count: { select: { tracks: true } },
      },
    })
    return reply.send(
      releases.map((r) => ({
        ...r,
        checklist: computeReleaseChecklist(r),
      })),
    )
  })

  fastify.post('/api/me/releases', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const body = request.body as {
      title?: string
      type?: string
      releaseDate?: string
      description?: string
      artworkUrl?: string
      tracks?: Array<{ title: string; durationSec?: number; archiveItemId?: string }>
    }

    const title = body.title?.trim()
    if (!title) return reply.status(400).send({ error: 'title is required' })
    const type = (body.type ?? 'SINGLE').toUpperCase()
    if (!VALID_TYPES.includes(type as (typeof VALID_TYPES)[number])) {
      return reply.status(400).send({ error: 'Invalid release type' })
    }
    if (!body.releaseDate) return reply.status(400).send({ error: 'releaseDate is required' })
    const releaseDate = new Date(body.releaseDate)
    if (Number.isNaN(releaseDate.getTime())) {
      return reply.status(400).send({ error: 'Invalid releaseDate' })
    }

    const baseSlug = `${user.username}-${slugify(title)}`
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
        title,
        type: type as 'SINGLE',
        releaseDate,
        description: body.description?.trim() || null,
        artworkUrl: body.artworkUrl?.trim() || null,
        smartLinkSlug,
        tracks: {
          create: tracks.map((t, i) => ({
            position: i + 1,
            title: t.title.trim(),
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
    const { id } = request.params as { id: string }
    const body = request.body as {
      state?: string
      smartLinkTargets?: unknown
      description?: string
    }

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
      const parsed = parseSmartLinkTargets(body.smartLinkTargets)
      if (typeof parsed === 'string') return reply.status(400).send({ error: parsed })
      data.smartLinkTargets = parsed
    }
    if (body.description !== undefined) {
      data.description = body.description?.trim() || null
    }

    if (body.state) {
      const state = body.state.toUpperCase()
      if (!['DRAFT', 'PUBLISHED', 'ARCHIVED'].includes(state)) {
        return reply.status(400).send({ error: 'Invalid state' })
      }
      if (state === 'PUBLISHED' && existing._count.tracks < 1) {
        return reply.status(400).send({ error: 'Add at least one track before publishing' })
      }
      data.state = state as 'PUBLISHED'
      data.publishedAt = state === 'PUBLISHED' ? new Date() : null
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
      const { id } = request.params as { id: string }

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
      const { id } = request.params as { id: string }

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
      const { id } = request.params as { id: string }

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
