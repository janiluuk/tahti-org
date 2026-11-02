// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { absoluteArtworkUrl } from '@tahti/db'

export const ARTWORK_PRESET_SELECT = {
  id: true,
  url: true,
  enabled: true,
  position: true,
} as const

export function presetDto<T extends { url: string }>(preset: T): T {
  return { ...preset, url: absoluteArtworkUrl(preset.url) }
}

export {
  absoluteArtworkUrl,
  assignPresetCovers,
  enabledArtworkPresetUrls,
  pickArtworkUrl,
  presetCoverFor,
} from '@tahti/db'
