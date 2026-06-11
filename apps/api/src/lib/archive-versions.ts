// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ArchiveVersionRow } from '@tahti/shared'

export function serializeArchiveVersion(v: {
  id: string
  versionNumber: number
  versionLabel: string
  status: string
  isActive: boolean
  durationSec: number | null
  sourceFormat?: string | null
  sourceBitrateKbps?: number | null
  createdAt: Date
}): ArchiveVersionRow {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    versionLabel: v.versionLabel,
    status: v.status,
    isActive: v.isActive,
    durationSec: v.durationSec,
    sourceFormat: v.sourceFormat ?? null,
    sourceBitrateKbps: v.sourceBitrateKbps ?? null,
    createdAt: v.createdAt.toISOString(),
  }
}
