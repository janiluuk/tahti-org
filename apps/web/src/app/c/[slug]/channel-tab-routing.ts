// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export type PublicChannelTab = 'live' | 'archive' | 'releases' | 'feed'

export function channelTabForHash(hash: string): PublicChannelTab | null {
  if (hash.startsWith('#archive-item-')) return 'archive'
  return null
}
