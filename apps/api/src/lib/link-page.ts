// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { PrismaClient } from '@tahti/db'
import {
  LINK_PAGE_DEFAULT_SETS,
  LINK_PAGE_DEFAULT_SOUNDS,
  parseLinkPageConfig,
  socialLinksForLinkPage,
  type LinkPageConfig,
  type PublicLinkPage,
} from '@tahti/shared'

import { resolveArtistUrl, resolveLinkPageUrl } from './artist-url.js'
import { config } from '../config.js'
import { presignedGetUrl } from './minio.js'
import { publicMediaUrl } from './public-media-url.js'

type SoundRow = {
  id: string
  title: string
  durationSec: number | null
  bannerUrl: string | null
  mp3Key: string | null
  flacKey: string | null
}

type CollectionRow = {
  id: string
  slug: string
  name: string
  coverUrl: string | null
  coverKey: string | null
  _count: { items: number }
}

function soundPlaybackKey(sound: { mp3Key: string | null; flacKey: string | null }): string | null {
  return sound.mp3Key || sound.flacKey || null
}

function collectionPageUrl(username: string, collectionSlug: string): string {
  const appUrl = config.appUrl.replace(/\/$/, '')
  try {
    const { protocol, hostname } = new URL(appUrl)
    if (hostname === 'tahti.live' || hostname === 'www.tahti.live' || hostname.startsWith('app.')) {
      const root = hostname.startsWith('app.') ? hostname.slice('app.'.length) : 'tahti.live'
      return `${protocol}//${root}/u/${username}/c/${collectionSlug}`
    }
  } catch {
    // fall through
  }
  return `${appUrl}/u/${username}/c/${collectionSlug}`
}

export async function resolvePublicLinkPage(opts: {
  username: string
  socialLinks: unknown
  linkPageJson: unknown
  sounds: SoundRow[]
  collections: CollectionRow[]
  playUrlBySoundId?: Map<string, string | null>
}): Promise<PublicLinkPage> {
  const configPage = parseLinkPageConfig(opts.linkPageJson)
  const profileLinks = socialLinksForLinkPage(opts.socialLinks)
  const ownLinks = configPage.ownLinks.map((link) => ({
    key: `own:${link.id}`,
    label: link.label,
    url: link.url,
    source: 'own' as const,
    id: link.id,
  }))

  const byId = new Map(opts.sounds.map((s) => [s.id, s]))
  let pickedSounds: SoundRow[]
  if (configPage.soundIds.length > 0) {
    pickedSounds = configPage.soundIds
      .map((id) => byId.get(id))
      .filter((s): s is SoundRow => Boolean(s))
  } else {
    pickedSounds = opts.sounds.slice(0, LINK_PAGE_DEFAULT_SOUNDS)
  }

  const playUrls = opts.playUrlBySoundId ?? new Map<string, string | null>()
  if (!opts.playUrlBySoundId) {
    await Promise.all(
      pickedSounds.map(async (sound) => {
        const key = soundPlaybackKey(sound)
        playUrls.set(sound.id, key ? await presignedGetUrl(key, 3600) : null)
      }),
    )
  }

  const sounds = pickedSounds.map((sound) => ({
    id: sound.id,
    title: sound.title,
    coverUrl: sound.bannerUrl,
    durationSec: sound.durationSec,
    playUrl: playUrls.get(sound.id) ?? null,
    badge: null as 'live' | 'replay' | null,
  }))

  const collectionsById = new Map(opts.collections.map((c) => [c.id, c]))
  const collectionsBySlug = new Map(opts.collections.map((c) => [c.slug, c]))
  let pickedSets: CollectionRow[]
  if (configPage.setIds.length > 0) {
    pickedSets = configPage.setIds
      .map((id) => collectionsById.get(id) ?? collectionsBySlug.get(id))
      .filter((c): c is CollectionRow => Boolean(c))
  } else {
    pickedSets = opts.collections.slice(0, LINK_PAGE_DEFAULT_SETS)
  }

  const sets = pickedSets.map((collection) => {
    const coverUrl =
      collection.coverUrl ?? (collection.coverKey ? publicMediaUrl(collection.coverKey) : null)
    return {
      id: collection.id,
      slug: collection.slug,
      name: collection.name,
      coverUrl,
      itemCount: collection._count.items,
      url: collectionPageUrl(opts.username, collection.slug),
    }
  })

  return {
    playMode: configPage.playMode,
    links: [...profileLinks, ...ownLinks],
    sounds,
    sets,
    siteUrl: resolveArtistUrl(opts.username),
    linkPageUrl: resolveLinkPageUrl(opts.username),
  }
}

export function mergeLinkPagePatch(
  current: unknown,
  patch: Partial<LinkPageConfig>,
): LinkPageConfig {
  const base = parseLinkPageConfig(current)
  return parseLinkPageConfig({
    ...base,
    ...patch,
  })
}

export async function sanitizeLinkPageConfig(
  prisma: PrismaClient,
  userId: string,
  channelId: string | null,
  configPage: LinkPageConfig,
): Promise<LinkPageConfig> {
  let soundIds = configPage.soundIds
  let setIds = configPage.setIds
  if (channelId && soundIds.length > 0) {
    const owned = await prisma.sound.findMany({
      where: {
        id: { in: soundIds },
        channelId,
        status: 'READY',
        isPublic: true,
      },
      select: { id: true },
    })
    const ok = new Set(owned.map((s) => s.id))
    soundIds = soundIds.filter((id) => ok.has(id))
  } else if (!channelId) {
    soundIds = []
  }
  if (setIds.length > 0) {
    const owned = await prisma.collection.findMany({
      where: {
        OR: [{ id: { in: setIds } }, { slug: { in: setIds } }],
        userId,
        isPublic: true,
      },
      select: { id: true },
    })
    const okIds = new Set(owned.map((c) => c.id))
    setIds = setIds.filter((id) => okIds.has(id))
  }
  return parseLinkPageConfig({
    ...configPage,
    soundIds,
    setIds,
  })
}
