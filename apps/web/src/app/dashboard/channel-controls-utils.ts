// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { CollectionItem } from './channel-controls-types'

export function itemTitle(item: CollectionItem): string {
  return item.sound?.title ?? item.release?.title ?? 'Untitled track'
}

export function formatRemaining(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}:${String(rem).padStart(2, '0')}`
}
