// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

export type ProgrammeItem = {
  id: string
  title: string
  isFallback: boolean
  fallbackOrder: number | null
}

export type Programme = {
  fallbackMode: 'shuffle' | 'ordered' | 'time' | 'name'
  fallbackEnabled: boolean
  fallbackAutoEnroll: boolean
  announcementsEnabled: boolean
  items: ProgrammeItem[]
}

export type PlaylistOption = {
  id: string
  slug: string
  name: string
  trackCount: number
  active: boolean
}

export type CollectionItem = {
  id: string
  position: number
  sound: { id: string; title: string } | null
  release: { title: string } | null
}

export type CollectionDetail = {
  slug: string
  name: string
  items: CollectionItem[]
}

export type NowPlaying = {
  title: string
  artistName: string
  durationSec: number | null
  startedAt: string
}
