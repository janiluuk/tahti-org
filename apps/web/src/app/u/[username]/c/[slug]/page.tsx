// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ProfilePageLayout, SafePlainText } from '@tahti/ui'
import type {
  ArchiveItemSource,
  CollectionGalleryMode,
  CollectionTextLayerAlignment,
  CollectionTextLayerMode,
} from '@tahti/shared'
import {
  ArchiveVideoBackdrop,
  resolveArchiveBackground,
} from '@/app/c/[slug]/archive-item-backdrop'
import { ChannelGalleryView } from '@/components/gallery'
import { ChannelTextLayerView } from '@/components/text-layer'
import { collectionRssUrl } from '@/lib/rss-feeds'
import type { PlayerTrack } from '@/contexts/player-context'
import { SpotifyEmbedRow } from './_spotify-embed-row'
import { MixcloudEmbedRow } from './_mixcloud-embed-row'
import { ArchiveTrackRow } from './_archive-track-row'
import { ReportButton } from '@/components/report-button'

async function fetchCollection(slug: string) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/collections/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as CollectionResponse
}

interface CollectionResponse {
  name: string
  description: string | null
  type: string
  coverUrl?: string | null
  galleryMode?: CollectionGalleryMode
  slideshowImages?: string[]
  videoBackgroundUrl?: string | null
  textLayerMode?: CollectionTextLayerMode
  textLayerText?: string
  textLayerAlign?: CollectionTextLayerAlignment
  user: { username: string; displayName: string }
  items: Array<{
    id: string
    position: number
    archiveItem: {
      id: string
      title: string
      durationSec: number | null
      bannerUrl: string | null
      source: ArchiveItemSource
      embedUri: string | null
      audioUrl: string | null
    } | null
    release: {
      id: string
      title: string
      type: string
      smartLinkSlug: string
      releaseDate: string
      artworkUrl: string | null
    } | null
  }>
  links?: { page?: string; rss?: string }
}

function formatDuration(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
}

export async function generateMetadata({
  params,
}: {
  params: { username: string; slug: string }
}): Promise<Metadata> {
  const data = await fetchCollection(params.slug)
  if (!data || data.user.username !== params.username) return { title: 'Collection not found' }
  return {
    title: `${data.name} — ${data.user.displayName}`,
    description: data.description ?? `${data.name} on Tahti`,
    alternates: {
      types: {
        'application/rss+xml': [
          {
            url:
              data.links?.rss ??
              collectionRssUrl(process.env.API_URL ?? 'http://localhost:3001', params.slug),
          },
        ],
      },
    },
    openGraph: {
      title: data.name,
      description: data.description ?? `${data.name} on Tahti`,
      ...(data.coverUrl ? { images: [{ url: data.coverUrl }] } : {}),
    },
  }
}

export default async function CollectionPage({
  params,
}: {
  params: { username: string; slug: string }
}) {
  const data = await fetchCollection(params.slug)
  if (!data || data.user.username !== params.username) notFound()

  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const rssUrl = data.links?.rss ?? collectionRssUrl(apiUrl, params.slug)
  const backdrop = resolveArchiveBackground(data.videoBackgroundUrl ?? null)

  // Only Tahti-hosted tracks are playable in-page — embeds/releases sit outside the queue.
  const queue: PlayerTrack[] = data.items
    .filter((i) => i.archiveItem?.audioUrl)
    .map((i) => ({
      id: i.archiveItem!.id,
      kind: 'archive',
      url: i.archiveItem!.audioUrl!,
      title: i.archiveItem!.title,
      subtitle: `@${data.user.username}`,
    }))

  return (
    <ProfilePageLayout
      hero={
        <>
          {backdrop.videoEmbedUrl && <ArchiveVideoBackdrop embedUrl={backdrop.videoEmbedUrl} />}
          {backdrop.cssImageUrl && !backdrop.videoEmbedUrl && (
            <div
              className="ch-channel-backdrop"
              style={{ ['--ch-backdrop-image' as string]: backdrop.cssImageUrl }}
            />
          )}
          <Link href={`/u/${data.user.username}`} className="prof-back-link">
            ← {data.user.displayName}
          </Link>
          {data.coverUrl && (
            <div className="prof-collection-hero-cover">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={data.coverUrl} alt="" />
            </div>
          )}
          <h1 className="prof-page-title">{data.name}</h1>
          <p className="prof-list-meta">
            {data.type.replace(/_/g, ' ')} · {data.items.length} item(s)
          </p>
          {data.description && (
            <SafePlainText text={data.description} className="prof-list-meta--spaced" />
          )}
          <p className="prof-rss-row">
            <a href={rssUrl}>RSS feed ↗</a>
          </p>
        </>
      }
    >
      <ChannelTextLayerView
        mode={data.textLayerMode ?? 'NONE'}
        text={data.textLayerText ?? ''}
        align={data.textLayerAlign ?? 'CENTER'}
      />

      <ChannelGalleryView mode={data.galleryMode ?? 'NONE'} images={data.slideshowImages ?? []} />

      <section className="prof-section">
        {data.items.length === 0 ? (
          <div className="public-empty-card">
            <p className="public-empty-card__text">This collection is empty.</p>
            <p className="public-empty-card__hint">Items appear here when the artist adds them.</p>
          </div>
        ) : (
          <ol className="prof-list prof-collection-items">
            {data.items.map((item) => {
              if (item.archiveItem?.source === 'SPOTIFY_EMBED' && item.archiveItem.embedUri) {
                return (
                  <SpotifyEmbedRow
                    key={item.id}
                    title={item.archiveItem.title}
                    embedUri={item.archiveItem.embedUri}
                  />
                )
              }
              if (item.archiveItem?.source === 'MIXCLOUD_EMBED' && item.archiveItem.embedUri) {
                return (
                  <MixcloudEmbedRow
                    key={item.id}
                    title={item.archiveItem.title}
                    embedUri={item.archiveItem.embedUri}
                  />
                )
              }
              const thumbUrl = item.archiveItem?.bannerUrl ?? item.release?.artworkUrl ?? null
              if (item.archiveItem?.audioUrl) {
                return (
                  <ArchiveTrackRow
                    key={item.id}
                    id={item.archiveItem.id}
                    title={item.archiveItem.title}
                    audioUrl={item.archiveItem.audioUrl}
                    artistUsername={data.user.username}
                    thumbUrl={thumbUrl}
                    durationLabel={
                      item.archiveItem.durationSec != null
                        ? formatDuration(item.archiveItem.durationSec)
                        : null
                    }
                    queue={queue}
                  />
                )
              }
              return (
                <li key={item.id} className="prof-collection-item-row">
                  <div className="prof-collection-cover prof-collection-cover--item">
                    {thumbUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbUrl} alt="" width={40} height={40} />
                    ) : (
                      <span className="prof-collection-cover-ph" aria-hidden />
                    )}
                  </div>
                  <div className="prof-collection-item-body">
                    {item.archiveItem && (
                      <>
                        <div className="prof-collection-title">{item.archiveItem.title}</div>
                        {item.archiveItem.durationSec != null && (
                          <span className="prof-list-meta">
                            {formatDuration(item.archiveItem.durationSec)}
                          </span>
                        )}
                      </>
                    )}
                    {item.release && (
                      <>
                        <Link href={`/r/${item.release.smartLinkSlug}`}>{item.release.title}</Link>
                        <span className="prof-list-meta">
                          {' '}
                          · {item.release.type} ·{' '}
                          {new Date(item.release.releaseDate).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      <section className="prof-section">
        <ReportButton targetType="COLLECTION" targetId={params.slug} />
      </section>
    </ProfilePageLayout>
  )
}
