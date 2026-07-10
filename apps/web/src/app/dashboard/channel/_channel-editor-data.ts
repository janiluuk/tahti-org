// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type {
  ChannelGalleryMode,
  ChannelHeaderStyle,
  ChannelTextLayerAlignment,
  ChannelTextLayerMode,
  SlideshowPreset,
  VisualPreset,
} from '@tahti/shared'
import { parseSocialLinksGenres } from '@tahti/shared'

export type ChannelEditorFetchResult = {
  channelGallery: {
    galleryMode: ChannelGalleryMode
    slideshowImages: string[]
    videoBackgroundUrl?: string | null
  }
  channelTextLayer: {
    textLayerMode: ChannelTextLayerMode
    textLayerText: string
    textLayerAlign: ChannelTextLayerAlignment
  }
  channelVisual: {
    visualPreset: VisualPreset
    colorSchemeJson: string | null
    headerStyle: ChannelHeaderStyle
    brandAccentPreset: string | null
    slideshowPreset: SlideshowPreset
    slideshowIntervalSeconds: number
    slideshowTransitionMs: number
    slideshowAutoplay: boolean
  }
  avatarUrl: string | null
  bio: string
  countryCode: string | null
  pronouns: string | null
  genres: string[]
  links: Array<{ label: string; url: string }>
  streamingLinks: { youtube: string; hearthisAt: string; twitch: string; soundcloud: string }
}

const STREAMING_LINK_KEYS = ['youtube', 'hearthisAt', 'twitch', 'soundcloud'] as const

/** Shared fetch used by every /dashboard/channel/* editor page so the live preview always has the full, current channel state. */
export async function fetchChannelEditorData(
  apiUrl: string,
  sessionValue: string,
  channelSlug: string,
): Promise<ChannelEditorFetchResult> {
  const authHeaders = { Cookie: `tahti_session=${sessionValue}` }
  const get = (path: string) =>
    fetch(`${apiUrl}${path}`, { headers: authHeaders, cache: 'no-store' as const })

  let channelGallery: ChannelEditorFetchResult['channelGallery'] | null = null
  let channelTextLayer: ChannelEditorFetchResult['channelTextLayer'] | null = null
  let channelVisual: ChannelEditorFetchResult['channelVisual'] | null = null

  let avatarUrl: string | null = null
  let bio = ''
  let countryCode: string | null = null
  let pronouns: string | null = null
  let genres: string[] = []
  let links: Array<{ label: string; url: string }> = []
  let streamingLinks: ChannelEditorFetchResult['streamingLinks'] = {
    youtube: '',
    hearthisAt: '',
    twitch: '',
    soundcloud: '',
  }

  try {
    const [galleryRes, textLayerRes, visualRes, channelRes] = await Promise.all([
      get('/api/me/channel/gallery'),
      get('/api/me/channel/text-layer'),
      get('/api/me/channel/visual'),
      fetch(`${apiUrl}/api/channels/${channelSlug}`, { cache: 'no-store' }),
    ])
    if (galleryRes.ok) channelGallery = (await galleryRes.json()) as typeof channelGallery
    if (textLayerRes.ok) channelTextLayer = (await textLayerRes.json()) as typeof channelTextLayer
    if (visualRes.ok) channelVisual = (await visualRes.json()) as typeof channelVisual
    if (channelRes.ok) {
      const channelData = (await channelRes.json()) as {
        user: {
          avatarUrl: string | null
          bio: string | null
          countryCode: string | null
          pronouns: string | null
          socialLinks: Record<string, string> | null
        }
      }
      avatarUrl = channelData.user.avatarUrl
      bio = channelData.user.bio ?? ''
      countryCode = channelData.user.countryCode
      pronouns = channelData.user.pronouns
      const socialLinks = channelData.user.socialLinks ?? {}
      genres = parseSocialLinksGenres(socialLinks)
      links = Object.entries(socialLinks)
        .filter(
          ([key, url]) =>
            key !== 'genres' && !(STREAMING_LINK_KEYS as readonly string[]).includes(key) && url,
        )
        .map(([label, url]) => ({ label, url }))
      streamingLinks = {
        youtube: socialLinks.youtube ?? '',
        hearthisAt: socialLinks.hearthisAt ?? '',
        twitch: socialLinks.twitch ?? '',
        soundcloud: socialLinks.soundcloud ?? '',
      }
    }
  } catch {
    // render with defaults
  }

  return {
    channelGallery: channelGallery ?? { galleryMode: 'NONE', slideshowImages: [] },
    channelTextLayer: channelTextLayer ?? {
      textLayerMode: 'NONE',
      textLayerText: '',
      textLayerAlign: 'CENTER',
    },
    channelVisual: channelVisual ?? {
      visualPreset: 'MINIMAL',
      colorSchemeJson: null,
      headerStyle: 'GRADIENT',
      brandAccentPreset: null,
      slideshowPreset: 'FADE',
      slideshowIntervalSeconds: 8,
      slideshowTransitionMs: 600,
      slideshowAutoplay: true,
    },
    avatarUrl,
    bio,
    countryCode,
    pronouns,
    genres,
    links,
    streamingLinks,
  }
}
