// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { presignedGetUrl } from './minio.js'

export async function documentResponse(document: {
  id: string
  title: string
  type: string
  description: string | null
  version: number
  effectiveAt: Date | null
  publishedAt: Date | null
  meetingId: string | null
  agendaItemId: string | null
  storageKey: string | null
  externalUrl: string | null
  supersedesId: string | null
  supersededBy?: { id: string } | null
  archivedAt: Date | null
  legalHoldAt: Date | null
  legalHoldReason: string | null
  createdAt: Date
  updatedAt: Date
}) {
  return {
    id: document.id,
    title: document.title,
    type: document.type,
    description: document.description,
    version: document.version,
    effectiveAt: document.effectiveAt,
    publishedAt: document.publishedAt,
    meetingId: document.meetingId,
    agendaItemId: document.agendaItemId,
    downloadUrl: document.storageKey
      ? await presignedGetUrl(document.storageKey, 3600).catch(() => null)
      : null,
    externalUrl: document.externalUrl,
    supersedesId: document.supersedesId,
    supersededById: document.supersededBy?.id ?? null,
    archivedAt: document.archivedAt,
    legalHoldAt: document.legalHoldAt,
    legalHoldReason: document.legalHoldReason,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  }
}
