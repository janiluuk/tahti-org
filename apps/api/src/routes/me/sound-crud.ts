// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { Prisma } from '@tahti/db'
import { createHearthisClient } from '@tahti/hearthis'
import {
  CountSchema,
  SoundBulkConflictSchema,
  SoundBulkDeleteResultSchema,
  SoundBulkDeleteSchema,
  SoundBulkPatchResultSchema,
  SoundBulkPatchSchema,
  SoundCoversBackfillResultSchema,
  SoundErrorMessageSchema,
  SoundFacetsQuerySchema,
  SoundFacetsSchema,
  SoundIdsSchema,
  SoundListFilterSchema,
  SoundListResponseSchema,
  SoundListQuerySchema,
  SoundProcessingStatusSchema,
  SoundRecentSchema,
  SoundStatsSchema,
  SoundViewSchema,
  IdParamSchema,
  ReorderSoundsSchema,
  openApiBody,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
  safeDisplayName,
  type SoundListFilter,
} from '@tahti/shared'
import { notifyFollowersOfNewTrack } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import { enqueueHearthisEmbedLocalization } from '../../lib/queue.js'
import {
  soundMetadataSelect,
  metadataPatchFromBody,
  serializeSound,
} from '../../lib/sound-metadata.js'
import {
  SOUND_BULK_MAX_ERRORS,
  SOUND_BULK_MAX_IDS,
  SOUND_LIST_MAX_IDS,
  SOUND_LIST_MAX_LIMIT,
  pageLimit,
  soundFilterNarrows,
  soundListWhere,
  wantsPagedSoundList,
} from '../../lib/sound-list-query.js'
import { normalizeTracklist, recordTracklistMentions } from '../../lib/tracklist.js'
import { UNKNOWN_VENUE_BODY, canAttachVenue } from '../../lib/sound-venue.js'
import {
  MAX_FALLBACK_ITEMS,
  fallbackCount,
  oldestFallbackItem,
} from '../../lib/fallback-rotation.js'
import { assignPresetCovers } from '../../lib/artwork-presets.js'
import type { TracklistEntry } from '@tahti/shared'
import { SOUND_LIST_ORDER_BY } from './sound-helpers.js'

const hearthis = createHearthisClient()

type SoundListRow = {
  id: string
  _count: { likes: number; listenEvents: number; comments: number }
} & Record<string, unknown>

async function serializeSoundRows(
  prisma: { download: { groupBy: (...args: never[]) => Promise<unknown> } } & object,
  items: SoundListRow[],
) {
  const client = prisma as import('@tahti/db').PrismaClient
  const downloadCounts = items.length
    ? await client.download.groupBy({
        by: ['soundId'],
        where: { soundId: { in: items.map((i) => i.id) }, countedAt: { not: null } },
        _count: { _all: true },
      })
    : []
  const downloadsBySoundId = new Map(
    downloadCounts.map((row) => [row.soundId, row._count._all] as const),
  )
  return items.map(({ _count, ...item }) => ({
    ...serializeSound(item),
    likeCount: _count.likes,
    commentCount: _count.comments,
    playCount: _count.listenEvents,
    downloadCount: downloadsBySoundId.get(item.id) ?? 0,
  }))
}

async function resolveBulkIds(
  fastify: { prisma: import('@tahti/db').PrismaClient },
  channelId: string,
  body: {
    ids?: string[]
    filter?: SoundListFilter
    confirmTotal?: number
    all?: boolean
  },
): Promise<
  | {
      ok: true
      ids: string[]
      totalMatched: number
      failed: Array<{ id: string; error: string }>
    }
  | { ok: false; status: 400 | 409; body: Record<string, unknown> }
> {
  if (body.ids) {
    if (body.ids.length > SOUND_BULK_MAX_IDS) {
      return {
        ok: false,
        status: 400,
        body: {
          error: `at most ${SOUND_BULK_MAX_IDS} ids per request; use the filter form for more`,
        },
      }
    }
    const ids = [...new Set(body.ids)]
    const owned = await fastify.prisma.sound.findMany({
      where: { channelId, id: { in: ids } },
      select: { id: true },
    })
    const ownedSet = new Set(owned.map((r) => r.id))
    const ownedIds = ids.filter((id) => ownedSet.has(id))
    const failed = ids
      .filter((id) => !ownedSet.has(id))
      .slice(0, SOUND_BULK_MAX_ERRORS)
      .map((id) => ({ id, error: 'not found or not owned' }))
    return {
      ok: true,
      ids: ownedIds,
      totalMatched: ownedIds.length,
      failed,
    }
  }

  const filter = body.filter ?? {}
  if (!soundFilterNarrows(filter) && !body.all) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'an empty filter matches the whole library; resend with "all": true to confirm',
      },
    }
  }
  if (body.confirmTotal == null) {
    return { ok: false, status: 400, body: { error: "'confirmTotal' is required with 'filter'" } }
  }

  const where = soundListWhere(channelId, filter)
  const matched = await fastify.prisma.sound.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: body.confirmTotal + 1,
    select: { id: true },
  })
  if (matched.length !== body.confirmTotal) {
    const totalMatched = await fastify.prisma.sound.count({ where })
    return {
      ok: false,
      status: 409,
      body: {
        error: `the library changed: ${totalMatched} sounds match, not ${body.confirmTotal}. Re-read the count and try again.`,
        totalMatched,
      },
    }
  }
  return {
    ok: true,
    ids: matched.map((r) => r.id),
    totalMatched: matched.length,
    failed: [],
  }
}

const meSoundCrudRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    '/api/me/sound',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          'List channel sounds with metadata. Dual response: pass `limit` for a paged `{ items, total }` object; omit `limit` for the legacy array (capped at 100).',
        response: openApiResponse(SoundListResponseSchema, 'SoundListResponse'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsedQuery = SoundListQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: parsedQuery.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const query = parsedQuery.data
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) {
        return reply.send(wantsPagedSoundList(query) ? { items: [], total: 0 } : [])
      }

      const where = soundListWhere(channel.id, query)
      const orderBy = SOUND_LIST_ORDER_BY[query.sort ?? 'newest']
      const paged = wantsPagedSoundList(query)
      const take = paged ? pageLimit(query.limit) : SOUND_LIST_MAX_LIMIT
      const offset = paged ? (query.offset ?? 0) : 0

      const [items, total] = await Promise.all([
        fastify.prisma.sound.findMany({
          where,
          orderBy,
          take,
          skip: offset,
          select: {
            ...soundMetadataSelect,
            _count: { select: { likes: true, listenEvents: true, comments: true } },
          },
        }),
        paged ? fastify.prisma.sound.count({ where }) : Promise.resolve(-1),
      ])

      const serialized = await serializeSoundRows(fastify.prisma, items as SoundListRow[])
      if (paged) return reply.send({ items: serialized, total })
      return reply.send(serialized)
    },
  )

  // PERF-006: slim variant for the dashboard overview, which only ever shows the
  // 1-2 most recent items — avoids the full-metadata select GET /api/me/sound does.
  fastify.get(
    '/api/me/sound/recent',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'PERF-006: slim recent-items list for the dashboard overview',
        response: openApiResponse(SoundRecentSchema, 'SoundRecent'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.send([])

      const items = await fastify.prisma.sound.findMany({
        where: { channelId: channel.id },
        orderBy: { createdAt: 'desc' },
        take: 2,
        select: { id: true, title: true, durationSec: true, createdAt: true },
      })
      return reply.send(items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() })))
    },
  )

  // Dashboard tiles only need the total — avoids pulling every sound's full
  // metadata (GET /api/me/sound) just to read `.length`.
  fastify.get(
    '/api/me/sound/count',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Total sound count for the dashboard overview',
        response: openApiResponse(CountSchema, 'SoundCount'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.send({ count: 0 })

      const count = await fastify.prisma.sound.count({ where: { channelId: channel.id } })
      return reply.send({ count })
    },
  )

  /** Most ids a caller can ask to watch in one request. */
  const MAX_WATCHED_IDS = 50

  // The top bar polls this while uploads process, instead of the full
  // GET /api/me/sound list (every sound's metadata) every few seconds.
  fastify.get(
    '/api/me/sound/processing',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          'Sounds still processing, plus the final status of `ids` (comma-separated) once they are done',
        response: openApiResponse(SoundProcessingStatusSchema, 'SoundProcessingStatus'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const rawIds = (request.query as { ids?: unknown }).ids
      const ids =
        typeof rawIds === 'string'
          ? rawIds
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean)
              .slice(0, MAX_WATCHED_IDS)
          : []
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.send({ processing: [], settled: [] })

      const [processing, settled] = await Promise.all([
        fastify.prisma.sound.findMany({
          where: { channelId: channel.id, status: { in: ['PENDING', 'PROCESSING'] } },
          orderBy: { createdAt: 'desc' },
          take: MAX_WATCHED_IDS,
          select: { id: true, title: true, status: true },
        }),
        ids.length > 0
          ? fastify.prisma.sound.findMany({
              where: { channelId: channel.id, id: { in: ids }, status: { in: ['READY', 'ERROR'] } },
              select: { id: true, status: true, processingError: true },
            })
          : Promise.resolve([]),
      ])
      return reply.send({ processing, settled })
    },
  )

  fastify.get(
    '/api/me/sound/ids',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          'Every matching sound id for select-all (same filters as the list). Returns 413 with totalMatched when the match count exceeds the ids cap.',
        response: openApiResponses([
          { status: 200, schema: SoundIdsSchema, name: 'SoundIds' },
          { status: 400, schema: SoundErrorMessageSchema, name: 'SoundIdsBadRequest' },
          { status: 413, schema: SoundBulkConflictSchema, name: 'SoundIdsTooLarge' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsedQuery = SoundListFilterSchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: parsedQuery.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.send({ ids: [], total: 0 })

      const where = soundListWhere(channel.id, parsedQuery.data)
      const total = await fastify.prisma.sound.count({ where })
      if (total > SOUND_LIST_MAX_IDS) {
        return reply.status(413).send({
          error: `too many matches (${total}); refine the filter (max ${SOUND_LIST_MAX_IDS})`,
          totalMatched: total,
        })
      }
      const rows = await fastify.prisma.sound.findMany({
        where,
        orderBy: SOUND_LIST_ORDER_BY.newest,
        select: { id: true },
      })
      return reply.send({ ids: rows.map((r) => r.id), total })
    },
  )

  fastify.get(
    '/api/me/sound/facets',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Value counts per field for the current sound-list filter',
        response: openApiResponse(SoundFacetsSchema, 'SoundFacets'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsedQuery = SoundFacetsQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: parsedQuery.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const { fields, ...filter } = parsedQuery.data
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.send({ facets: {}, total: 0 })

      const baseWhere = soundListWhere(channel.id, filter)
      const total = await fastify.prisma.sound.count({ where: baseWhere })
      const facets: Record<string, Array<{ value: string; count: number }>> = {}

      for (const field of fields) {
        const omit: keyof SoundListFilter | undefined =
          field === 'uploadedYear'
            ? undefined
            : field === 'tag'
              ? 'tag'
              : field === 'genre'
                ? 'genre'
                : field === 'contentType'
                  ? 'contentType'
                  : field === 'source'
                    ? 'source'
                    : field === 'status'
                      ? 'status'
                      : field === 'musicalKey'
                        ? 'key'
                        : undefined
        // Year buckets must ignore the date range that would collapse them to one year.
        const facetFilter =
          field === 'uploadedYear'
            ? { ...filter, uploadedFrom: undefined, uploadedTo: undefined }
            : filter
        const where = soundListWhere(channel.id, facetFilter, omit)
        if (field === 'genre') {
          const [presetRows, customRows] = await Promise.all([
            fastify.prisma.sound.groupBy({
              by: ['genre'],
              where,
              _count: { _all: true },
              orderBy: { _count: { genre: 'desc' } },
              take: 100,
            }),
            fastify.prisma.sound.groupBy({
              by: ['genreCustom'],
              where: { ...where, genreCustom: { not: null } },
              _count: { _all: true },
              orderBy: { _count: { genreCustom: 'desc' } },
              take: 100,
            }),
          ])
          const counts = new Map<string, number>()
          for (const row of presetRows) {
            if (!row.genre) continue
            counts.set(row.genre, (counts.get(row.genre) ?? 0) + row._count._all)
          }
          for (const row of customRows) {
            if (!row.genreCustom) continue
            counts.set(row.genreCustom, (counts.get(row.genreCustom) ?? 0) + row._count._all)
          }
          facets.genre = [...counts.entries()]
            .map(([value, count]) => ({ value, count }))
            .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value))
            .slice(0, 100)
        } else if (field === 'contentType') {
          const rows = await fastify.prisma.sound.groupBy({
            by: ['contentType'],
            where,
            _count: { _all: true },
            orderBy: { _count: { contentType: 'desc' } },
          })
          facets.contentType = rows.map((r) => ({
            value: r.contentType,
            count: r._count._all,
          }))
        } else if (field === 'status') {
          const rows = await fastify.prisma.sound.groupBy({
            by: ['status'],
            where,
            _count: { _all: true },
            orderBy: { _count: { status: 'desc' } },
          })
          facets.status = rows.map((r) => ({ value: r.status, count: r._count._all }))
        } else if (field === 'source') {
          const rows = await fastify.prisma.sound.groupBy({
            by: ['embedProvider'],
            where,
            _count: { _all: true },
            orderBy: { _count: { embedProvider: 'desc' } },
          })
          facets.source = rows.map((r) => ({
            value: r.embedProvider ?? 'native',
            count: r._count._all,
          }))
        } else if (field === 'tag') {
          // Full matching set via SQL unnest — no 5k sample cap.
          const matchedIds = await fastify.prisma.sound.findMany({
            where,
            select: { id: true },
          })
          if (matchedIds.length === 0) {
            facets.tag = []
          } else {
            const rows = await fastify.prisma.$queryRaw<Array<{ value: string; count: number }>>`
              SELECT t.tag AS value, COUNT(*)::int AS count
              FROM sound s
              CROSS JOIN LATERAL unnest(s.tags) AS t(tag)
              WHERE s.id IN (${Prisma.join(matchedIds.map((r) => r.id))})
              GROUP BY t.tag
              ORDER BY count DESC, value ASC
              LIMIT 100
            `
            facets.tag = rows.map((r) => ({ value: r.value, count: r.count }))
          }
        } else if (field === 'uploadedYear') {
          const matchedIds = await fastify.prisma.sound.findMany({
            where,
            select: { id: true },
          })
          if (matchedIds.length === 0) {
            facets.uploadedYear = []
          } else {
            const rows = await fastify.prisma.$queryRaw<Array<{ value: string; count: number }>>`
              SELECT EXTRACT(YEAR FROM s."createdAt" AT TIME ZONE 'UTC')::int::text AS value,
                     COUNT(*)::int AS count
              FROM sound s
              WHERE s.id IN (${Prisma.join(matchedIds.map((r) => r.id))})
              GROUP BY 1
              ORDER BY value DESC
            `
            facets.uploadedYear = rows.map((r) => ({ value: r.value, count: r.count }))
          }
        } else if (field === 'musicalKey') {
          const rows = await fastify.prisma.sound.groupBy({
            by: ['musicalKey'],
            where: { ...where, musicalKey: { not: null } },
            _count: { _all: true },
            orderBy: { _count: { musicalKey: 'desc' } },
            take: 100,
          })
          facets.musicalKey = rows
            .filter((r) => r.musicalKey)
            .map((r) => ({
              value: r.musicalKey as string,
              count: r._count._all,
            }))
        }
      }

      return reply.send({ facets, total })
    },
  )

  fastify.get(
    '/api/me/sound/stats',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Totals for the current sound-list filter',
        response: openApiResponse(SoundStatsSchema, 'SoundStats'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsedQuery = SoundListFilterSchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: parsedQuery.error.issues[0]?.message ?? 'Invalid query',
        })
      }
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) {
        return reply.send({
          total: 0,
          durationSec: 0,
          publicCount: 0,
          privateCount: 0,
          processingCount: 0,
          errorCount: 0,
          readyCount: 0,
        })
      }

      const where = soundListWhere(channel.id, parsedQuery.data)
      const [total, durationAgg, publicCount, processingCount, errorCount, readyCount] =
        await Promise.all([
          fastify.prisma.sound.count({ where }),
          fastify.prisma.sound.aggregate({ where, _sum: { durationSec: true } }),
          fastify.prisma.sound.count({ where: { ...where, isPublic: true } }),
          fastify.prisma.sound.count({
            where: { ...where, status: { in: ['PENDING', 'PROCESSING'] } },
          }),
          fastify.prisma.sound.count({ where: { ...where, status: 'ERROR' } }),
          fastify.prisma.sound.count({ where: { ...where, status: 'READY' } }),
        ])

      return reply.send({
        total,
        durationSec: durationAgg._sum.durationSec ?? 0,
        publicCount,
        privateCount: Math.max(0, total - publicCount),
        processingCount,
        errorCount,
        readyCount,
      })
    },
  )

  fastify.post(
    '/api/me/sound/bulk-delete',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          'Delete many sounds. Send `ids`, or `filter` + `confirmTotal` (server re-counts; 409 on drift). Missing or foreign ids land in `failed[]`.',
        body: openApiBody(SoundBulkDeleteSchema, 'SoundBulkDelete'),
        response: openApiResponses([
          { status: 200, schema: SoundBulkDeleteResultSchema, name: 'SoundBulkDeleteResult' },
          { status: 400, schema: SoundErrorMessageSchema, name: 'SoundBulkDeleteBadRequest' },
          { status: 403, schema: SoundErrorMessageSchema, name: 'SoundBulkDeleteForbidden' },
          { status: 409, schema: SoundBulkConflictSchema, name: 'SoundBulkDeleteConflict' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = SoundBulkDeleteSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid body',
        })
      }
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(403).send({ error: 'You need a channel to do this' })

      const resolved = await resolveBulkIds(fastify, channel.id, parsed.data)
      if (!resolved.ok) return reply.status(resolved.status).send(resolved.body)

      let deleted = 0
      const failed: Array<{ id: string; error: string }> = [...resolved.failed]
      for (const id of resolved.ids) {
        try {
          const result = await fastify.prisma.sound.deleteMany({
            where: { id, channelId: channel.id },
          })
          if (result.count === 0) {
            if (failed.length < SOUND_BULK_MAX_ERRORS) {
              failed.push({ id, error: 'not found or not owned' })
            }
            continue
          }
          deleted += 1
        } catch (err) {
          if (failed.length < SOUND_BULK_MAX_ERRORS) {
            const message =
              err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003'
                ? 'linked Mixcloud upload — disconnect that first'
                : err instanceof Error
                  ? err.message
                  : 'delete failed'
            failed.push({ id, error: message })
          }
        }
      }

      return reply.send({
        deleted,
        failed,
        totalMatched: resolved.totalMatched,
      })
    },
  )

  fastify.post(
    '/api/me/sound/bulk-patch',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          'Patch shared metadata on many sounds. Send `ids`, or `filter` + `confirmTotal`. `tags: []` clears tags. `pinned` sets/clears pinnedAt. `isFallback: true` respects MAX_FALLBACK_ITEMS (excess ids fail). Going private→public notifies followers once per track.',
        body: openApiBody(SoundBulkPatchSchema, 'SoundBulkPatch'),
        response: openApiResponses([
          { status: 200, schema: SoundBulkPatchResultSchema, name: 'SoundBulkPatchResult' },
          { status: 400, schema: SoundErrorMessageSchema, name: 'SoundBulkPatchBadRequest' },
          { status: 403, schema: SoundErrorMessageSchema, name: 'SoundBulkPatchForbidden' },
          { status: 409, schema: SoundBulkConflictSchema, name: 'SoundBulkPatchConflict' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const parsed = SoundBulkPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply.status(400).send({
          error: parsed.error.issues[0]?.message ?? 'Invalid body',
        })
      }
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(403).send({ error: 'You need a channel to do this' })

      const resolved = await resolveBulkIds(fastify, channel.id, parsed.data)
      if (!resolved.ok) return reply.status(resolved.status).send(resolved.body)

      const patchBody = { ...parsed.data.patch }
      const data: Record<string, unknown> = {}
      if (patchBody.genre !== undefined) data.genre = patchBody.genre
      if (patchBody.genreCustom !== undefined) data.genreCustom = patchBody.genreCustom
      if (patchBody.tags !== undefined) data.tags = patchBody.tags
      if (patchBody.subGenres !== undefined) data.subGenres = patchBody.subGenres
      if (patchBody.contentType !== undefined) data.contentType = patchBody.contentType
      if (patchBody.isPublic !== undefined) data.isPublic = patchBody.isPublic
      if (patchBody.isFallback !== undefined) data.isFallback = patchBody.isFallback
      if (patchBody.pinned !== undefined) {
        data.pinnedAt = patchBody.pinned ? new Date() : null
      }
      if (patchBody.downloadsEnabled !== undefined)
        data.downloadsEnabled = patchBody.downloadsEnabled
      if (patchBody.commentsEnabled !== undefined) data.commentsEnabled = patchBody.commentsEnabled
      if (patchBody.license !== undefined) data.license = patchBody.license
      if (patchBody.releasedAt !== undefined) {
        data.releasedAt = patchBody.releasedAt ? new Date(patchBody.releasedAt) : null
      }

      const existing = await fastify.prisma.sound.findMany({
        where: { channelId: channel.id, id: { in: resolved.ids } },
        select: { id: true, title: true, isFallback: true, isPublic: true },
      })
      const byId = new Map(existing.map((row) => [row.id, row]))

      let freeFallbackSlots = Number.POSITIVE_INFINITY
      if (patchBody.isFallback === true) {
        const currentFallbacks = await fallbackCount(fastify.prisma, channel.id)
        freeFallbackSlots = Math.max(0, MAX_FALLBACK_ITEMS - currentFallbacks)
      }

      let updated = 0
      const failed: Array<{ id: string; error: string }> = [...resolved.failed]
      const notifyQueue: Array<{ id: string; title: string }> = []
      const artist = {
        ...user,
        displayName: safeDisplayName(user.displayName, user.username),
      }

      for (const id of resolved.ids) {
        const row = byId.get(id)
        if (!row) {
          if (failed.length < SOUND_BULK_MAX_ERRORS) {
            failed.push({ id, error: 'not found or not owned' })
          }
          continue
        }

        if (patchBody.isFallback === true && !row.isFallback) {
          if (freeFallbackSlots <= 0) {
            if (failed.length < SOUND_BULK_MAX_ERRORS) {
              failed.push({
                id,
                error: `Rotation is full (max ${MAX_FALLBACK_ITEMS})`,
              })
            }
            continue
          }
          freeFallbackSlots -= 1
        }

        try {
          const result = await fastify.prisma.sound.updateMany({
            where: { id, channelId: channel.id },
            data,
          })
          if (result.count === 0) {
            if (failed.length < SOUND_BULK_MAX_ERRORS) {
              failed.push({ id, error: 'not found or not owned' })
            }
            continue
          }
          updated += 1
          if (patchBody.isPublic === true && !row.isPublic) {
            notifyQueue.push({ id: row.id, title: row.title })
          }
        } catch (err) {
          if (failed.length < SOUND_BULK_MAX_ERRORS) {
            failed.push({
              id,
              error: err instanceof Error ? err.message : 'update failed',
            })
          }
        }
      }

      for (const item of notifyQueue) {
        await notifyFollowersOfNewTrack(fastify.prisma, artist, item).catch((e) =>
          fastify.log.warn(e, 'new-track notification failed'),
        )
      }

      return reply.send({
        updated,
        failed,
        totalMatched: resolved.totalMatched,
      })
    },
  )

  fastify.post(
    '/api/me/sound/covers/backfill',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          'Assign an enabled artwork preset to each of your sounds that still has no banner. Safe to re-run; sounds with a cover are skipped.',
        response: openApiResponse(SoundCoversBackfillResultSchema, 'SoundCoversBackfillResult'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { id: true },
      })
      if (!channel) return reply.status(403).send({ error: 'You need a channel to do this' })

      const missing = await fastify.prisma.sound.findMany({
        where: { channelId: channel.id, bannerUrl: null },
        select: { id: true },
        take: SOUND_BULK_MAX_IDS,
      })
      const assigned = await assignPresetCovers(
        fastify.prisma,
        'sound',
        missing.map((row) => row.id),
      )
      return reply.send({ assigned, totalMatched: missing.length })
    },
  )

  fastify.get(
    '/api/me/sound/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        response: openApiResponse(SoundViewSchema, 'Sound'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await fastify.prisma.sound.findFirst({
        where: { id, channel: { userId: user.id } },
        select: soundMetadataSelect,
      })
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })
      return reply.send(serializeSound(item))
    },
  )

  fastify.patch(
    '/api/me/sound/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'M22: patch sound item metadata (SoundMetadataPatchSchema body)',
        response: openApiResponse(SoundViewSchema, 'Sound'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await fastify.prisma.sound.findFirst({
        where: { id, channel: { userId: user.id } },
        select: { id: true, channelId: true, isFallback: true, isPublic: true, venueId: true },
      })
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      const patch = metadataPatchFromBody(request.body)
      if (!patch.ok) return reply.status(400).send({ error: patch.error })

      const venueId = patch.data.venueId
      if (
        typeof venueId === 'string' &&
        !(await canAttachVenue(fastify.prisma, venueId, user.id, item.venueId))
      ) {
        return reply.status(400).send(UNKNOWN_VENUE_BODY)
      }

      if (patch.title !== undefined) {
        const t = patch.title.trim()
        if (!t) return reply.status(400).send({ error: 'title cannot be empty' })
        patch.data.title = t.slice(0, 200)
      }

      // Joining the 24/7 rotation is capped — past MAX_FALLBACK_ITEMS the caller
      // must confirm which existing track to evict (replaceFallbackItemId), since
      // there's no list UI at this call site to pick from directly.
      if (patch.data.isFallback === true && !item.isFallback) {
        const count = await fallbackCount(fastify.prisma, item.channelId)
        if (count >= MAX_FALLBACK_ITEMS) {
          const body = request.body as { replaceFallbackItemId?: string }
          const replaceId = body.replaceFallbackItemId
          if (!replaceId) {
            const oldest = await oldestFallbackItem(fastify.prisma, item.channelId)
            return reply.status(409).send({
              error: `Rotation is full (max ${MAX_FALLBACK_ITEMS}) — choose a track to replace`,
              oldestItem: oldest,
            })
          }
          const replaceTarget = await fastify.prisma.sound.findFirst({
            where: { id: replaceId, channelId: item.channelId, isFallback: true },
            select: { id: true },
          })
          if (!replaceTarget) {
            return reply.status(400).send({ error: 'replaceFallbackItemId is not in rotation' })
          }
          await fastify.prisma.sound.update({
            where: { id: replaceTarget.id },
            data: { isFallback: false },
          })
        }
      }

      if (patch.data.tracklist !== undefined && patch.data.tracklist !== null) {
        try {
          patch.data.tracklist = await normalizeTracklist(
            fastify.prisma,
            patch.data.tracklist as TracklistEntry[],
          )
        } catch (err) {
          return reply
            .status(400)
            .send({ error: err instanceof Error ? err.message : 'Invalid tracklist' })
        }
      }

      const updated = await fastify.prisma.sound.update({
        where: { id },
        data: patch.data,
        select: soundMetadataSelect,
      })

      // Fan out to followers exactly once, the moment a track first goes public —
      // not on every subsequent metadata edit.
      if (patch.data.isPublic === true && !item.isPublic) {
        await notifyFollowersOfNewTrack(
          fastify.prisma,
          { ...user, displayName: safeDisplayName(user.displayName, user.username) },
          updated,
        ).catch((e) => fastify.log.warn(e, 'new-track notification failed'))
      }

      if (patch.data.tracklist !== undefined && Array.isArray(updated.tracklist)) {
        try {
          await recordTracklistMentions(
            fastify.prisma,
            user.id,
            updated.tracklist as TracklistEntry[],
            id,
          )
        } catch (e) {
          fastify.log.warn(e, 'tracklist mention record failed')
        }
      }

      return reply.send(serializeSound(updated))
    },
  )

  fastify.delete(
    '/api/me/sound/:id',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Delete an sound item and its versions/rotation entries',
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await fastify.prisma.sound.findFirst({
        where: { id, channel: { userId: user.id } },
        select: { id: true },
      })
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })

      try {
        await fastify.prisma.sound.delete({ where: { id } })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
          return reply.status(409).send({
            error: 'This item has a linked Mixcloud upload — disconnect that first, then delete.',
          })
        }
        throw err
      }

      return reply.status(204).send()
    },
  )

  // POST /api/me/sound/:id/import-embed — download a HEARTHIS_EMBED track's
  // real audio (when the artist enabled downloads on hearthis.at) and attach
  // it as this item's actual recording, replacing the embed.
  fastify.post(
    '/api/me/sound/:id/import-embed',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description:
          "Re-fetch a HEARTHIS_EMBED track's audio (if the source allows downloads) and localize it, clearing the item's embed status",
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id } = routeParams

      const item = await fastify.prisma.sound.findFirst({
        where: { id, channel: { userId: user.id } },
        select: { id: true, source: true, rawKey: true, embedSourceUrl: true },
      })
      if (!item) return reply.status(404).send({ error: 'Sound item not found' })
      if (item.source !== 'HEARTHIS_EMBED' || !item.embedSourceUrl) {
        return reply.status(400).send({ error: 'This item is not a hearthis.at embed' })
      }
      if (item.rawKey) {
        return reply.status(409).send({ error: 'This item already has real audio attached' })
      }

      let track
      try {
        track = await hearthis.getTrackByUrl(item.embedSourceUrl)
      } catch {
        return reply.status(502).send({ error: 'Could not reach hearthis.at' })
      }
      if (track.downloadable !== '1' || !track.download_url) {
        return reply
          .status(409)
          .send({ error: 'The artist has not enabled downloads for this track on hearthis.at' })
      }

      await enqueueHearthisEmbedLocalization({ soundId: item.id, trackUrl: item.embedSourceUrl })

      return reply.status(202).send({ status: 'importing' })
    },
  )

  // PUT /api/me/sound/reorder — persist manual order for the public "Tracks" tab
  fastify.put('/api/me/sound/reorder', { preHandler: requireAuth }, async (request, reply) => {
    const user = request.sessionUser!
    const parsed = ReorderSoundsSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: parsed.error.issues[0]?.message ?? 'Invalid body' })
    }
    const { ids } = parsed.data

    const channel = await fastify.prisma.channel.findUnique({
      where: { userId: user.id },
      select: { id: true },
    })
    if (!channel) return reply.status(403).send({ error: 'You need a channel to do this' })

    const owned = await fastify.prisma.sound.findMany({
      where: { id: { in: ids }, channelId: channel.id },
      select: { id: true },
    })
    const ownedIds = new Set(owned.map((i) => i.id))

    await fastify.prisma.$transaction(
      ids
        .filter((id) => ownedIds.has(id))
        .map((id, order) =>
          fastify.prisma.sound.update({ where: { id }, data: { trackOrder: order } }),
        ),
    )

    return reply.status(204).send()
  })
}

export default meSoundCrudRoutes
