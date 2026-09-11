// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { BRAND_ACCENT_PRESETS, DEFAULT_COLOR_SCHEME, parseColorScheme } from '@tahti/shared'
import type { CSSProperties } from 'react'
import type { ChannelResponse, SoundItem } from './_channel-page-types'

export function formatJoinDateLabel(joinDate: string | null | undefined): string | null {
  if (!joinDate) return null
  const date = new Date(joinDate)
  if (Number.isNaN(date.getTime())) return null
  return `Joined ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
}

export function resolveHeaderBannerStyle(channel: ChannelResponse): CSSProperties | undefined {
  if (channel.headerStyle === 'VIDEO_LOOP') return undefined
  const preset = BRAND_ACCENT_PRESETS.find((item) => item.id === channel.brandAccentPreset)
  if (channel.headerStyle === 'SOLID') {
    const scheme = parseColorScheme(channel.colorSchemeJson)
    return { background: preset?.accent ?? scheme?.accent ?? DEFAULT_COLOR_SCHEME.accent }
  }
  return { background: preset?.gradient ?? BRAND_ACCENT_PRESETS[0]?.gradient }
}

export const STREAMING_LINK_LABELS: Record<string, string> = {
  youtube: 'YouTube',
  hearthisAt: 'hearthis.at',
  twitch: 'Twitch',
  soundcloud: 'SoundCloud',
  kick: 'Kick',
}

export function buildStreamingLinkEntries(
  socialLinks: Record<string, string>,
): Array<readonly [string, string]> {
  return Object.entries(STREAMING_LINK_LABELS)
    .map(([key, label]) => [label, socialLinks[key]] as const)
    .filter(([, url]) => !!url)
}

export function buildSocialLinkEntries(
  socialLinks: Record<string, string>,
): Array<readonly [string, string]> {
  return Object.entries(socialLinks).filter(
    ([key, url]) => key !== 'genres' && !(key in STREAMING_LINK_LABELS) && url,
  )
}

export function resolveProfileTags(
  socialLinks: Record<string, string>,
  items: SoundItem[],
): string[] {
  const profileGenres = socialLinks.genres
    ? socialLinks.genres
        .split(',')
        .map((g) => g.trim())
        .filter(Boolean)
    : []
  if (profileGenres.length > 0) return profileGenres

  const tagSet = new Set<string>()
  for (const item of items) {
    if (item.genre?.trim()) tagSet.add(item.genre.trim())
    if (item.genreCustom?.trim()) tagSet.add(item.genreCustom.trim())
  }
  return [...tagSet].slice(0, 8)
}
