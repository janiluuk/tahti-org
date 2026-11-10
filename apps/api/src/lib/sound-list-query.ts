// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { Prisma } from '@tahti/db'
import type { SoundListFilter } from '@tahti/shared'
import {
  SOUND_BULK_MAX_ERRORS,
  SOUND_BULK_MAX_IDS,
  SOUND_LIST_DEFAULT_LIMIT,
  SOUND_LIST_MAX_IDS,
  SOUND_LIST_MAX_LIMIT,
} from '@tahti/shared'

export {
  SOUND_BULK_MAX_ERRORS,
  SOUND_BULK_MAX_IDS,
  SOUND_LIST_DEFAULT_LIMIT,
  SOUND_LIST_MAX_IDS,
  SOUND_LIST_MAX_LIMIT,
}

function dayStart(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00.000Z`)
  }
  return new Date(value)
}

function dayEndExclusive(value: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const d = new Date(`${value}T00:00:00.000Z`)
    d.setUTCDate(d.getUTCDate() + 1)
    return d
  }
  return new Date(value)
}

/** True when the client asked for a paged `{ items, total }` response. */
export function wantsPagedSoundList(query: { limit?: number }): boolean {
  return query.limit != null
}

/** Whether a filter narrows the catalog (empty filter matches everything). */
export function soundFilterNarrows(filter: SoundListFilter | undefined): boolean {
  if (!filter) return false
  return (
    filter.q != null ||
    filter.contentType != null ||
    filter.source != null ||
    filter.status != null ||
    filter.uploadedFrom != null ||
    filter.uploadedTo != null ||
    filter.genre != null ||
    filter.tag != null ||
    filter.bpmMin != null ||
    filter.bpmMax != null ||
    filter.key != null ||
    filter.isPublic != null ||
    filter.isFallback != null ||
    filter.pinned != null
  )
}

export function soundListWhere(
  channelId: string,
  filter: SoundListFilter = {},
  /** Drop one field so facets count values outside that dimension. */
  omit?: keyof SoundListFilter,
): Prisma.SoundWhereInput {
  const where: Prisma.SoundWhereInput = { channelId }
  const and: Prisma.SoundWhereInput[] = []

  const use = <K extends keyof SoundListFilter>(key: K): SoundListFilter[K] | undefined => {
    if (omit === key) return undefined
    // Faceting on tag also drops the multi-tag AND filter.
    if (omit === 'tag' && key === 'tags') return undefined
    return filter[key]
  }

  const q = use('q')?.trim()
  if (q) {
    and.push({
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { genre: { contains: q, mode: 'insensitive' } },
        { genreCustom: { contains: q, mode: 'insensitive' } },
        { tags: { has: q } },
      ],
    })
  }

  const contentType = use('contentType')
  if (contentType) where.contentType = contentType

  const source = use('source')
  if (source === 'native') {
    where.embedProvider = null
  } else if (source) {
    where.embedProvider = source as import('@tahti/db').SoundEmbedProvider
  }

  const status = use('status')
  if (status) where.status = status

  const uploadedFrom = use('uploadedFrom')
  const uploadedTo = use('uploadedTo')
  if (uploadedFrom || uploadedTo) {
    where.createdAt = {
      ...(uploadedFrom ? { gte: dayStart(uploadedFrom) } : {}),
      ...(uploadedTo ? { lt: dayEndExclusive(uploadedTo) } : {}),
    }
  }

  const genre = use('genre')
  if (genre) {
    and.push({
      OR: [
        { genre: { equals: genre, mode: 'insensitive' } },
        { genreCustom: { equals: genre, mode: 'insensitive' } },
      ],
    })
  }

  const tag = use('tag')
  const tags = use('tags')
  if (tags && tags.length > 0) {
    where.tags = { hasEvery: tags }
  } else if (tag) {
    where.tags = { has: tag }
  }

  const bpmMin = use('bpmMin')
  const bpmMax = use('bpmMax')
  if (bpmMin != null || bpmMax != null) {
    where.bpm = {
      ...(bpmMin != null ? { gte: bpmMin } : {}),
      ...(bpmMax != null ? { lte: bpmMax } : {}),
    }
  }

  const key = use('key')
  if (key) where.musicalKey = { equals: key, mode: 'insensitive' }

  const isPublic = use('isPublic')
  if (isPublic != null) where.isPublic = isPublic

  const isFallback = use('isFallback')
  if (isFallback != null) where.isFallback = isFallback

  const pinned = use('pinned')
  if (pinned === true) where.pinnedAt = { not: null }
  else if (pinned === false) where.pinnedAt = null

  if (and.length > 0) where.AND = and
  return where
}

export function pageLimit(limit: number | undefined): number {
  return Math.min(Math.max(limit ?? SOUND_LIST_DEFAULT_LIMIT, 1), SOUND_LIST_MAX_LIMIT)
}
