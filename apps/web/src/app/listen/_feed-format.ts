// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FeedItem } from '@tahti/shared'

export function feedHeadline(item: FeedItem): string {
  switch (item.kind) {
    case 'post':
      return item.title || `${item.artist.displayName} posted an update`
    case 'release':
      return `${item.artist.displayName} released ${item.title}`
    case 'track':
      return `${item.artist.displayName} shared ${item.title}`
  }
}

export function feedTeaser(item: FeedItem): string {
  switch (item.kind) {
    case 'post':
      return item.body
    case 'release':
      return `New ${item.releaseType.replace(/_/g, ' ').toLowerCase()} release`
    case 'track':
      return 'New track'
  }
}

export function feedCover(item: FeedItem): string | null {
  switch (item.kind) {
    case 'post':
      return item.images[0] ?? item.artist.avatarUrl
    case 'release':
      return item.artworkUrl
    case 'track':
      return item.bannerUrl
  }
}

export function formatFeedDate(iso: string): string {
  const age = Date.now() - new Date(iso).getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour
  if (age < minute) return 'just now'
  if (age < hour) return `${Math.floor(age / minute)}m ago`
  if (age < day) return `${Math.floor(age / hour)}h ago`
  if (age < 7 * day) return `${Math.floor(age / day)}d ago`
  if (age < 30 * day) return `${Math.floor(age / (7 * day))}w ago`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function formatFullDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
