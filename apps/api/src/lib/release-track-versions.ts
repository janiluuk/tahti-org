// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { ReleaseTrackVersionRow } from '@tahti/shared'

export function serializeReleaseTrackVersion(v: {
  id: string
  versionNumber: number
  versionLabel: string
  status: string
  isActive: boolean
  durationSec: number | null
  createdAt: Date
}): ReleaseTrackVersionRow {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    versionLabel: v.versionLabel,
    status: v.status,
    isActive: v.isActive,
    durationSec: v.durationSec,
    createdAt: v.createdAt.toISOString(),
  }
}
