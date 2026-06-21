// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Mixed-source collections brief: Mixcloud search + embed.
 * Mixcloud's read API (search, a user's cloudcasts) is fully public — no
 * client ID, no OAuth, no per-user login. That's distinct from the existing
 * @tahti/mixcloud upload client, which needs an artist's OAuth token to push
 * new mixes. We never fetch or store Mixcloud audio here; every cloudcast
 * this module returns is a reference (URL) for an official embed widget.
 */

const MIXCLOUD_API_BASE = 'https://api.mixcloud.com'

/** Mixcloud image CDN — the only host the image proxy route is allowed to fetch from. */
export const MIXCLOUD_IMAGE_CDN_HOST = 'thumbnailer.mixcloud.com'

export interface MixcloudTrackResult {
  url: string
  title: string
  username: string
  displayName: string
  durationSec: number
  coverUrl: string | null
}

interface RawMixcloudCloudcast {
  url: string
  name: string
  audio_length: number
  user?: { username?: string; name?: string }
  pictures?: { medium?: string; large?: string; thumbnail?: string }
}

function mapMixcloudCloudcast(cast: RawMixcloudCloudcast): MixcloudTrackResult {
  return {
    url: cast.url,
    title: cast.name,
    username: cast.user?.username ?? '',
    displayName: cast.user?.name ?? cast.user?.username ?? '',
    durationSec: cast.audio_length ?? 0,
    coverUrl: cast.pictures?.medium ?? cast.pictures?.large ?? cast.pictures?.thumbnail ?? null,
  }
}

/** Builds the official Mixcloud widget embed src for a cloudcast URL. */
export function mixcloudEmbedSrc(cloudcastUrl: string): string {
  const params = new URLSearchParams({ feed: cloudcastUrl, hide_cover: '1', light: '1' })
  return `https://www.mixcloud.com/widget/iframe/?${params.toString()}`
}

/** Normalizes a pasted Mixcloud profile URL or bare handle to a username. Null if malformed. */
export function parseMixcloudUsername(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    if (url.hostname === 'www.mixcloud.com' || url.hostname === 'mixcloud.com') {
      const match = /^\/([^/]+)\/?$/.exec(url.pathname)
      return match ? match[1] : null
    }
    return null
  } catch {
    return /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : null
  }
}

async function mixcloudApiGet<T>(path: string): Promise<T> {
  const res = await fetch(`${MIXCLOUD_API_BASE}${path}`)
  if (!res.ok) throw new Error(`Mixcloud API request failed (${res.status}): ${path}`)
  return (await res.json()) as T
}

export async function searchMixcloudCloudcasts(
  query: string,
  limit = 20,
): Promise<MixcloudTrackResult[]> {
  const params = new URLSearchParams({ q: query, type: 'cloudcast', limit: String(limit) })
  const data = await mixcloudApiGet<{ data: RawMixcloudCloudcast[] }>(
    `/search/?${params.toString()}`,
  )
  return data.data.map(mapMixcloudCloudcast)
}

export async function getMixcloudUserCloudcasts(
  username: string,
  limit = 50,
): Promise<MixcloudTrackResult[]> {
  const data = await mixcloudApiGet<{ data: RawMixcloudCloudcast[] }>(
    `/${encodeURIComponent(username)}/cloudcasts/?limit=${limit}`,
  )
  return data.data.map(mapMixcloudCloudcast)
}

/** Direct lookup by resource key (e.g. /username/mix-slug/) — Mixcloud resolves any object key this way. */
export async function getMixcloudCloudcastByUrl(cloudcastUrl: string): Promise<MixcloudTrackResult> {
  const key = new URL(cloudcastUrl).pathname
  const cast = await mixcloudApiGet<RawMixcloudCloudcast>(key)
  return mapMixcloudCloudcast(cast)
}
