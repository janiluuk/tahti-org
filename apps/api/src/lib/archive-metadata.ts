// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import {
  ARCHIVE_METADATA_DEFAULTS,
  ArchiveMetadataFieldsSchema,
  ArchiveMetadataPatchSchema,
  type ArchiveMetadataFields,
  type ArchiveMetadataPatch,
} from '@tahti/shared'

export const archiveItemMetadataSelect = {
  id: true,
  title: true,
  description: true,
  tracklist: true,
  bannerUrl: true,
  backgroundUrl: true,
  slideshowUrls: true,
  commentary: true,
  taggedNote: true,
  genre: true,
  genreCustom: true,
  recordingLocation: true,
  subGenres: true,
  contentType: true,
  mixVersion: true,
  bpm: true,
  musicalKey: true,
  bpmDetected: true,
  keyDetected: true,
  useDetectedBpmKey: true,
  isAiGenerated: true,
  releasedAt: true,
  license: true,
  repostToDownload: true,
  followToDownload: true,
  isPublic: true,
  isFallback: true,
  status: true,
  durationSec: true,
  createdAt: true,
  updatedAt: true,
} as const

export function effectiveBpm(item: {
  bpm: number | null
  bpmDetected: number | null
  useDetectedBpmKey: boolean
}): number | null {
  if (item.useDetectedBpmKey && item.bpmDetected != null) return item.bpmDetected
  return item.bpm
}

export function effectiveKey(item: {
  musicalKey: string | null
  keyDetected: string | null
  useDetectedBpmKey: boolean
}): string | null {
  if (item.useDetectedBpmKey && item.keyDetected) return item.keyDetected
  return item.musicalKey
}

export function serializeArchiveItem<T extends Record<string, unknown>>(item: T) {
  const row = item as T & {
    bpm: number | null
    bpmDetected: number | null
    musicalKey: string | null
    keyDetected: string | null
    useDetectedBpmKey: boolean
  }
  return {
    ...item,
    effectiveBpm: effectiveBpm(row),
    effectiveKey: effectiveKey(row),
  }
}

function parseOptionalUrl(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null || value === '') return null
  return value
}

function fieldsToPrismaData(fields: ArchiveMetadataFields): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  if (fields.description !== undefined) data.description = fields.description || null
  if (fields.tracklist !== undefined) data.tracklist = fields.tracklist
  if (fields.bannerUrl !== undefined) data.bannerUrl = parseOptionalUrl(fields.bannerUrl)
  if (fields.backgroundUrl !== undefined) data.backgroundUrl = parseOptionalUrl(fields.backgroundUrl)
  if (fields.slideshowUrls !== undefined) data.slideshowUrls = fields.slideshowUrls
  if (fields.commentary !== undefined) data.commentary = fields.commentary || null
  if (fields.taggedNote !== undefined) data.taggedNote = fields.taggedNote || null
  if (fields.genre !== undefined) data.genre = fields.genre || null
  if (fields.genreCustom !== undefined) data.genreCustom = fields.genreCustom || null
  if (fields.recordingLocation !== undefined) data.recordingLocation = fields.recordingLocation || null
  if (fields.subGenres !== undefined) data.subGenres = fields.subGenres
  if (fields.contentType !== undefined) data.contentType = fields.contentType
  if (fields.mixVersion !== undefined) data.mixVersion = fields.mixVersion || null
  if (fields.bpm !== undefined) data.bpm = fields.bpm
  if (fields.musicalKey !== undefined) data.musicalKey = fields.musicalKey || null
  if (fields.useDetectedBpmKey !== undefined) data.useDetectedBpmKey = fields.useDetectedBpmKey
  if (fields.isAiGenerated !== undefined) data.isAiGenerated = fields.isAiGenerated
  if (fields.releasedAt !== undefined) data.releasedAt = new Date(fields.releasedAt)
  if (fields.license !== undefined) data.license = fields.license
  if (fields.repostToDownload !== undefined) data.repostToDownload = fields.repostToDownload
  if (fields.followToDownload !== undefined) data.followToDownload = fields.followToDownload
  if (fields.isPublic !== undefined) data.isPublic = fields.isPublic
  if (fields.isFallback !== undefined) data.isFallback = fields.isFallback
  return data
}

export function metadataForNewUpload(input?: unknown): Record<string, unknown> {
  const parsed = ArchiveMetadataFieldsSchema.partial().safeParse(input ?? {})
  const fields = parsed.success ? parsed.data : {}
  return {
    ...ARCHIVE_METADATA_DEFAULTS,
    releasedAt: fields.releasedAt ? new Date(fields.releasedAt) : new Date(),
    ...fieldsToPrismaData(fields),
  }
}

export function metadataPatchFromBody(body: unknown): {
  ok: true
  title?: string
  data: Record<string, unknown>
} | { ok: false; error: string } {
  const parsed = ArchiveMetadataPatchSchema.safeParse(body)
  if (!parsed.success) {
    return { ok: false, error: 'Invalid metadata' }
  }
  const { title, ...rest } = parsed.data
  const data = fieldsToPrismaData(rest)
  if (Object.keys(data).length === 0 && title === undefined) {
    return { ok: false, error: 'No fields to update' }
  }
  return { ok: true, title, data }
}
