// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import type { ArtistTier } from '@tahti/db'
import { isUnlimitedLiveTier } from '@tahti/shared/broadcast-cap'

// M20: listener stream quality follows the artist's tier (not the listener's).

export function liveHlsManifestPath(slug: string, tier: ArtistTier): string {
  const variant = isUnlimitedLiveTier(tier) ? 'stream-flac' : 'stream-mp3-192'
  return `${slug}/${variant}/stream.m3u8`
}

export function liveHlsUrl(baseUrl: string, slug: string, tier: ArtistTier): string {
  const base = baseUrl.replace(/\/$/, '')
  return `${base}/${liveHlsManifestPath(slug, tier)}`
}
