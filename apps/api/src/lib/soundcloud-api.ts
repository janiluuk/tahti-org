// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import {
  safeDisplayName,
  type SoundcloudPlaylistSummary,
  type SoundcloudPlaylistTrack,
} from '@tahti/shared'
import { createSoundcloudTicket, soundcloudTicketUrl } from './soundcloud-download-ticket.js'

export const SOUNDCLOUD_API = 'https://api.soundcloud.com'

export class SoundcloudApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
  }
}

/** Only SoundCloud's own hosts ever receive the user's OAuth token. */
export function isSoundcloudHost(
  url: URL,
  hosts: readonly string[] = ['api.soundcloud.com'],
): boolean {
  return url.protocol === 'https:' && hosts.includes(url.hostname)
}

export async function soundcloudGet<T>(token: string, url: string): Promise<T> {
  const parsed = new URL(url)
  if (!isSoundcloudHost(parsed)) throw new SoundcloudApiError(502, 'Unexpected SoundCloud link')
  const res = await fetch(parsed, {
    headers: { Authorization: `OAuth ${token}`, Accept: 'application/json; charset=utf-8' },
  })
  if (res.status === 401)
    throw new SoundcloudApiError(401, 'SoundCloud token expired. Reconnect SoundCloud')
  if (res.status === 404) throw new SoundcloudApiError(404, 'Not found on SoundCloud')
  if (!res.ok) throw new SoundcloudApiError(502, 'SoundCloud API unavailable')
  return (await res.json()) as T
}

interface Page<T> {
  collection?: T[]
  next_href?: string | null
}

/** Follows `next_href` up to `maxPages`; SoundCloud caps a page at 200 items. */
export async function soundcloudCollect<T>(
  token: string,
  url: string,
  maxPages: number,
): Promise<T[]> {
  const items: T[] = []
  let next: string | null | undefined = url
  for (let page = 0; next && page < maxPages; page++) {
    const data: Page<T> = await soundcloudGet<Page<T>>(token, next)
    items.push(...(data.collection ?? []))
    next = data.next_href
  }
  return items
}

export interface ScUser {
  username?: string | null
  permalink?: string | null
}

export interface ScPlaylist {
  id: number | string
  title?: string | null
  track_count?: number | null
  artwork_url?: string | null
  permalink_url?: string | null
  kind?: string
}

export interface ScTrack {
  id: number | string
  title?: string | null
  duration?: number | null
  artwork_url?: string | null
  permalink_url?: string | null
  downloadable?: boolean | null
  download_url?: string | null
  user?: ScUser | null
}

export function mapPlaylist(playlist: ScPlaylist): SoundcloudPlaylistSummary {
  return {
    id: String(playlist.id),
    title: playlist.title?.trim() || 'Untitled set',
    trackCount: Math.max(0, playlist.track_count ?? 0),
    artworkUrl: playlist.artwork_url ?? null,
    permalinkUrl: playlist.permalink_url ?? null,
  }
}

export function mapTrack(
  track: ScTrack,
  userId: string,
  now = Date.now(),
): SoundcloudPlaylistTrack {
  const id = String(track.id)
  const permalink = track.user?.permalink?.trim() || 'unknown'
  let download: SoundcloudPlaylistTrack['download'] = null
  if (track.downloadable && track.download_url) {
    const { ticket, expiresAt } = createSoundcloudTicket(userId, id, now)
    download = { url: soundcloudTicketUrl(id, ticket), expiresAt: expiresAt.toISOString() }
  }
  return {
    id,
    title: track.title?.trim() || 'Untitled',
    username: safeDisplayName(track.user?.username, permalink),
    durationSec: Math.max(0, Math.round((track.duration ?? 0) / 1000)),
    artworkUrl: track.artwork_url ?? null,
    permalinkUrl: track.permalink_url ?? null,
    download,
  }
}
