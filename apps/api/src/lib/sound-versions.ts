// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { SoundVersionRow } from '@tahti/shared'

export function serializeSoundVersion(v: {
  id: string
  versionNumber: number
  versionLabel: string
  status: string
  isActive: boolean
  durationSec: number | null
  sourceFormat?: string | null
  sourceBitrateKbps?: number | null
  sourceSampleRateHz?: number | null
  sourceBitDepth?: number | null
  sourceChannels?: number | null
  createdAt: Date
}): SoundVersionRow {
  return {
    id: v.id,
    versionNumber: v.versionNumber,
    versionLabel: v.versionLabel,
    status: v.status,
    isActive: v.isActive,
    durationSec: v.durationSec,
    sourceFormat: v.sourceFormat ?? null,
    sourceBitrateKbps: v.sourceBitrateKbps ?? null,
    sourceSampleRateHz: v.sourceSampleRateHz ?? null,
    sourceBitDepth: v.sourceBitDepth ?? null,
    sourceChannels: v.sourceChannels ?? null,
    createdAt: v.createdAt.toISOString(),
  }
}
