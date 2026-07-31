// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import type { Prisma } from '@tahti/db'
import { Prisma as PrismaNS } from '@tahti/db'
import {
  ARCHIVE_CONTENT_TYPES,
  AdminFileAudioResponseSchema,
  AdminFilesBulkPatchResponseSchema,
  AdminFilesBulkPatchSchema,
  AdminFilesFacetsResponseSchema,
  AdminFilesListResponseSchema,
  archivePlaybackKey,
  openApiResponse,
} from '@tahti/shared'
import { requireBoard } from '../../plugins/auth.js'
import { auditLog } from '../../lib/audit.js'
import { presignedGetUrl } from '../../lib/minio.js'

const DEFAULT_LIMIT = 50
const MAX_LIMIT = 100

function splitCsv(raw: unknown): string[] {
  if (typeof raw !== 'string' || !raw.trim()) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url')
}

function decodeCursor(raw: string): { createdAt: Date; id: string } | null {
  try {
    const decoded = Buffer.from(raw, 'base64url').toString('utf8')
    const [iso, id] = decoded.split('|')
    if (!iso || !id) return null
    const createdAt = new Date(iso)
    if (Number.isNaN(createdAt.getTime())) return null
    return { createdAt, id }
  } catch {
    return null
  }
}

const adminFilesRoutes: FastifyPluginAsync = async (fastify) => {
  // Facets for multi-select filters (users with files, distinct genres, types).
  fastify.get(
    '/api/admin/files/facets',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Filter facets for the board-wide archive file browser',
        response: openApiResponse(AdminFilesFacetsResponseSchema, 'AdminFilesFacets'),
      },
    },
    async (_request, reply) => {
      const [users, genreRows, customRows] = await Promise.all([
        fastify.prisma.user.findMany({
          where: { channel: { archiveItems: { some: {} } } },
          orderBy: { displayName: 'asc' },
          take: 500,
          select: { id: true, username: true, displayName: true },
        }),
        fastify.prisma.archiveItem.findMany({
          where: { genre: { not: null } },
          distinct: ['genre'],
          select: { genre: true },
          take: 200,
        }),
        fastify.prisma.archiveItem.findMany({
          where: { genreCustom: { not: null } },
          distinct: ['genreCustom'],
          select: { genreCustom: true },
          take: 200,
        }),
      ])

      const genres = [
        ...new Set([
          ...genreRows.map((r) => r.genre).filter(Boolean),
          ...customRows.map((r) => r.genreCustom).filter(Boolean),
        ] as string[]),
      ].sort((a, b) => a.localeCompare(b))

      return reply.send({
        users,
        genres,
        contentTypes: [...ARCHIVE_CONTENT_TYPES],
      })
    },
  )

  // Paginated cross-user archive browser.
  fastify.get(
    '/api/admin/files',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'List archive files across all users with multi-filters',
        response: openApiResponse(AdminFilesListResponseSchema, 'AdminFilesList'),
      },
    },
    async (request, reply) => {
      const q = request.query as Record<string, unknown>
      const userIds = splitCsv(q.userIds)
      const genres = splitCsv(q.genres)
      const contentTypes = splitCsv(q.contentTypes).filter((t) =>
        (ARCHIVE_CONTENT_TYPES as readonly string[]).includes(t),
      )
      const search = typeof q.q === 'string' ? q.q.trim().slice(0, 120) : ''
      const limitRaw = typeof q.limit === 'string' ? Number(q.limit) : DEFAULT_LIMIT
      const limit = Number.isFinite(limitRaw)
        ? Math.min(MAX_LIMIT, Math.max(1, Math.floor(limitRaw)))
        : DEFAULT_LIMIT
      const cursor = typeof q.cursor === 'string' && q.cursor ? decodeCursor(q.cursor) : null

      const and: Prisma.ArchiveItemWhereInput[] = []

      if (userIds.length > 0) {
        and.push({ channel: { userId: { in: userIds } } })
      }
      if (contentTypes.length > 0) {
        and.push({
          contentType: { in: contentTypes as (typeof ARCHIVE_CONTENT_TYPES)[number][] },
        })
      }
      if (genres.length > 0) {
        and.push({
          OR: [{ genre: { in: genres } }, { genreCustom: { in: genres } }],
        })
      }
      if (search) {
        and.push({
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { artistName: { contains: search, mode: 'insensitive' } },
            {
              channel: {
                user: {
                  OR: [
                    { displayName: { contains: search, mode: 'insensitive' } },
                    { username: { contains: search, mode: 'insensitive' } },
                  ],
                },
              },
            },
          ],
        })
      }

      const cursorClause: Prisma.ArchiveItemWhereInput | null = cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : null

      const filterWhere: Prisma.ArchiveItemWhereInput = and.length > 0 ? { AND: and } : {}
      const where: Prisma.ArchiveItemWhereInput =
        and.length > 0 || cursorClause
          ? { AND: [...and, ...(cursorClause ? [cursorClause] : [])] }
          : {}

      const [total, rows] = await Promise.all([
        fastify.prisma.archiveItem.count({ where: filterWhere }),
        fastify.prisma.archiveItem.findMany({
          where,
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: limit + 1,
          select: {
            id: true,
            title: true,
            artistName: true,
            genre: true,
            genreCustom: true,
            contentType: true,
            status: true,
            isPublic: true,
            durationSec: true,
            bannerUrl: true,
            createdAt: true,
            channel: {
              select: {
                slug: true,
                user: { select: { id: true, username: true, displayName: true } },
              },
            },
          },
        }),
      ])

      const page = rows.slice(0, limit)
      const hasMore = rows.length > limit
      const last = page[page.length - 1]
      const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null

      return reply.send({
        total,
        nextCursor,
        items: page.map((item) => ({
          id: item.id,
          title: item.title,
          artistName: item.artistName ?? item.channel.user.displayName,
          genre: item.genre,
          genreCustom: item.genreCustom,
          contentType: item.contentType,
          status: item.status,
          isPublic: item.isPublic,
          durationSec: item.durationSec,
          bannerUrl: item.bannerUrl,
          createdAt: item.createdAt.toISOString(),
          channelSlug: item.channel.slug,
          userId: item.channel.user.id,
          username: item.channel.user.username,
          displayName: item.channel.user.displayName,
        })),
      })
    },
  )

  // Presigned audio for in-browser preview / row progress playback.
  fastify.get(
    '/api/admin/files/:id/audio',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Presigned playback URL for an archive file (board preview)',
        response: openApiResponse(AdminFileAudioResponseSchema, 'AdminFileAudio'),
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const item = await fastify.prisma.archiveItem.findUnique({
        where: { id },
        select: {
          id: true,
          title: true,
          artistName: true,
          bannerUrl: true,
          durationSec: true,
          mp3Key: true,
          flacKey: true,
          channel: {
            select: { slug: true, user: { select: { displayName: true } } },
          },
        },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const key = archivePlaybackKey(item)
      const audioUrl = key ? await presignedGetUrl(key, 3600) : null
      return reply.send({
        audioUrl,
        title: item.title,
        artistName: item.artistName ?? item.channel.user.displayName,
        channelSlug: item.channel.slug,
        bannerUrl: item.bannerUrl,
        durationSec: item.durationSec,
      })
    },
  )

  // Bulk assign genre / type / visibility / license to selected ids.
  fastify.patch(
    '/api/admin/files/bulk',
    {
      preHandler: requireBoard,
      schema: {
        tags: ['admin'],
        description: 'Bulk-patch metadata on selected archive files',
        response: openApiResponse(AdminFilesBulkPatchResponseSchema, 'AdminFilesBulkPatch'),
      },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const parsed = AdminFilesBulkPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request' })
      }

      const { ids, ...fields } = parsed.data
      const data: Prisma.ArchiveItemUpdateManyMutationInput = {}
      if (fields.genre !== undefined) data.genre = fields.genre
      if (fields.genreCustom !== undefined) data.genreCustom = fields.genreCustom
      if (fields.contentType !== undefined) data.contentType = fields.contentType
      if (fields.isPublic !== undefined) data.isPublic = fields.isPublic
      if (fields.license !== undefined) data.license = fields.license

      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ error: 'No fields to update' })
      }

      const result = await fastify.prisma.archiveItem.updateMany({
        where: { id: { in: ids } },
        data,
      })

      await auditLog(fastify.prisma, {
        action: 'ARCHIVE_METADATA_ADMIN_EDIT',
        actorId: actor.id,
        targetId: ids[0]!,
        meta: { ids, fields: Object.keys(data), updated: result.count, via: 'files-browser-bulk' },
      })

      return reply.send({ updated: result.count })
    },
  )

  // Single-item metadata patch (edit modal).
  fastify.patch(
    '/api/admin/files/:id',
    {
      preHandler: requireBoard,
      schema: { tags: ['admin'], description: 'Patch one archive file by id (board)' },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const { id } = request.params as { id: string }
      const body = request.body as Record<string, unknown>

      const item = await fastify.prisma.archiveItem.findUnique({
        where: { id },
        select: { id: true, title: true, channel: { select: { slug: true } } },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      const data: Prisma.ArchiveItemUpdateInput = {}
      if (typeof body.title === 'string') {
        const t = body.title.trim()
        if (!t) return reply.status(400).send({ error: 'title cannot be empty' })
        data.title = t.slice(0, 200)
      }
      if (body.genre !== undefined) {
        data.genre = typeof body.genre === 'string' ? body.genre || null : null
      }
      if (body.genreCustom !== undefined) {
        data.genreCustom = typeof body.genreCustom === 'string' ? body.genreCustom || null : null
      }
      if (
        typeof body.contentType === 'string' &&
        (ARCHIVE_CONTENT_TYPES as readonly string[]).includes(body.contentType)
      ) {
        data.contentType = body.contentType as (typeof ARCHIVE_CONTENT_TYPES)[number]
      }
      if (typeof body.isPublic === 'boolean') data.isPublic = body.isPublic

      if (Object.keys(data).length === 0) {
        return reply.status(400).send({ error: 'No fields to update' })
      }

      await fastify.prisma.archiveItem.update({ where: { id }, data })
      await auditLog(fastify.prisma, {
        action: 'ARCHIVE_METADATA_ADMIN_EDIT',
        actorId: actor.id,
        targetId: id,
        meta: {
          slug: item.channel.slug,
          previousTitle: item.title,
          fields: Object.keys(data),
          via: 'files-browser',
        },
      })
      return reply.send({ ok: true })
    },
  )

  fastify.delete(
    '/api/admin/files/:id',
    {
      preHandler: requireBoard,
      schema: { tags: ['admin'], description: 'Delete an archive file (board)' },
    },
    async (request, reply) => {
      const actor = request.sessionUser!
      const { id } = request.params as { id: string }
      const item = await fastify.prisma.archiveItem.findUnique({
        where: { id },
        select: { id: true, title: true, channel: { select: { slug: true } } },
      })
      if (!item) return reply.status(404).send({ error: 'Archive item not found' })

      try {
        await fastify.prisma.archiveItem.delete({ where: { id } })
      } catch (err) {
        if (err instanceof PrismaNS.PrismaClientKnownRequestError && err.code === 'P2003') {
          return reply.status(409).send({
            error: 'This item has a linked Mixcloud upload — disconnect that first, then delete.',
          })
        }
        throw err
      }

      await auditLog(fastify.prisma, {
        action: 'ARCHIVE_METADATA_ADMIN_EDIT',
        actorId: actor.id,
        targetId: id,
        meta: {
          slug: item.channel.slug,
          title: item.title,
          via: 'files-browser-delete',
          deleted: true,
        },
      })
      return reply.status(204).send()
    },
  )
}

export default adminFilesRoutes
