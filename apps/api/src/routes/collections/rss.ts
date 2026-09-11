// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import { soundPlaybackKey } from '@tahti/shared'
import { config } from '../../config.js'
import { publicMediaUrl } from '../../lib/public-media-url.js'
import { resolveArtistUrl } from '../../lib/artist-url.js'

export type ChannelSoundRssSource = {
  slug: string
  user: { username: string; displayName: string; bio: string | null }
  sounds: Array<{
    id: string
    title: string
    description: string | null
    durationSec: number | null
    mp3Key: string | null
    flacKey: string | null
    accessMode: 'FREE' | 'SUBSCRIBERS_ONLY' | 'PURCHASE'
    createdAt: Date
  }>
}

export async function loadChannelSoundRssSource(
  fastify: Pick<FastifyInstance, 'prisma'>,
  slug: string,
): Promise<ChannelSoundRssSource | null> {
  return fastify.prisma.channel.findUnique({
    where: { slug },
    select: {
      slug: true,
      user: { select: { username: true, displayName: true, bio: true } },
      sounds: {
        where: { status: 'READY', isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          title: true,
          description: true,
          durationSec: true,
          mp3Key: true,
          flacKey: true,
          accessMode: true,
          createdAt: true,
        },
      },
    },
  })
}

export function rssEnclosureUrl(item: {
  mp3Key: string | null
  flacKey: string | null
  accessMode?: 'FREE' | 'SUBSCRIBERS_ONLY' | 'PURCHASE'
}): string | null {
  // RSS has no viewer session — never publish a stable object URL for gated tracks.
  if (item.accessMode && item.accessMode !== 'FREE') return null
  return publicMediaUrl(soundPlaybackKey(item))
}

export function buildChannelSoundRssXml(channel: ChannelSoundRssSource): string {
  return buildRss({
    title: `${channel.user.displayName} — Tahti`,
    description: channel.user.bio ?? `${channel.user.displayName} on Tahti`,
    link: resolveArtistUrl(channel.user.username),
    items: channel.sounds.map((i) => ({
      title: i.title,
      description: i.description ?? '',
      pubDate: i.createdAt,
      duration: i.durationSec ?? 0,
      enclosureUrl: rssEnclosureUrl(i),
      guid: `${config.appUrl}/c/${channel.slug}#${i.id}`,
    })),
  })
}

export interface RssItem {
  title: string
  description: string
  pubDate: Date
  duration: number
  enclosureUrl: string | null
  guid: string
}

export type CollectionItemRow = {
  sound: {
    id: string
    title: string
    description: string | null
    durationSec: number | null
    mp3Key: string | null
    flacKey: string | null
    accessMode: 'FREE' | 'SUBSCRIBERS_ONLY' | 'PURCHASE'
    createdAt: Date
  } | null
  release: {
    title: string
    description: string | null
    smartLinkSlug: string
    releaseDate: Date
  } | null
}

export function collectionRssItems(items: CollectionItemRow[], username: string): RssItem[] {
  const out: RssItem[] = []
  for (const i of items) {
    if (i.sound) {
      out.push({
        title: i.sound.title,
        description: i.sound.description ?? '',
        pubDate: i.sound.createdAt,
        duration: i.sound.durationSec ?? 0,
        enclosureUrl: rssEnclosureUrl(i.sound),
        guid: `${config.appUrl}/u/${username}/c/item/${i.sound.id}`,
      })
    } else if (i.release) {
      out.push({
        title: i.release.title,
        description: i.release.description ?? '',
        pubDate: i.release.releaseDate,
        duration: 0,
        enclosureUrl: null,
        guid: `${config.appUrl}/r/${i.release.smartLinkSlug}`,
      })
    }
  }
  return out
}

export function buildRss(opts: {
  title: string
  description: string
  link: string
  items: RssItem[]
}): string {
  const items = opts.items
    .map((i) => {
      const enclosure = i.enclosureUrl
        ? `<enclosure url="${escXml(i.enclosureUrl)}" type="audio/mpeg" length="0"/>`
        : ''
      const mins = Math.floor(i.duration / 60)
      const secs = i.duration % 60
      const dur = `${mins}:${String(secs).padStart(2, '0')}`
      return `
    <item>
      <title>${escXml(i.title)}</title>
      <description>${escXml(i.description)}</description>
      <pubDate>${i.pubDate.toUTCString()}</pubDate>
      <guid isPermaLink="true">${escXml(i.guid)}</guid>
      <itunes:duration>${dur}</itunes:duration>
      ${enclosure}
    </item>`
    })
    .join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escXml(opts.title)}</title>
    <description>${escXml(opts.description)}</description>
    <link>${escXml(opts.link)}</link>
    <language>fi</language>
    <generator>Tahti ry — https://tahti.live</generator>
    ${items}
  </channel>
</rss>`
}

export function escXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
