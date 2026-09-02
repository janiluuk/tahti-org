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
import { ChannelColorScheme } from '@/components/visuals/channel-color-scheme'
import { collectionRssUrl } from '@/lib/rss-feeds'
import { CollectionEmbedButton } from './_embed-button'
import { AddTrackButton } from './_add-track-button'
import { SubscribeButton } from './_subscribe-button'
import { StartJamButton } from './_start-jam-button'
import { CollectionGalleryProvider, CollectionCoverButton } from './_collection-gallery'
import { CollectionLibrarySection } from './_collection-library-section'

function IconRss() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="3.2" cy="12.8" r="1.6" fill="currentColor" />
      <path
        d="M2 6.5c4.7 0 7.5 2.8 7.5 7.5M2 2c7.2 0 12 4.8 12 12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

async function fetchCollection(slug: string) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/collections/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  })
  if (!res.ok) return null
  return (await res.json()) as CollectionResponse
}

export interface CollectionResponse {
  name: string
  description: string | null
  type: string
  coverUrl?: string | null
  paletteJson?: string | null
  colorSchemeJson?: string | null
  collaborative?: boolean
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
      channel: { slug: string } | null
    } | null
    release: {
      id: string
      title: string
      type: string
      smartLinkSlug: string
      releaseDate: string
      artworkUrl: string | null
    } | null
    addedBy?: { username: string; displayName: string } | null
    addNote?: string | null
  }>
  links?: { page?: string; rss?: string }
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

  // Browsable/zoomable gallery: hero cover first, then every item's own art,
  // deduped by URL so re-used artwork (e.g. an EP's tracks sharing one cover)
  // doesn't create duplicate slideshow stops.
  const galleryUrls = [
    data.coverUrl,
    ...data.items.map((item) => item.archiveItem?.bannerUrl ?? item.release?.artworkUrl ?? null),
  ].filter((url, i, arr): url is string => Boolean(url) && arr.indexOf(url) === i)
  const galleryImages = galleryUrls.map((url) => ({ url }))

  return (
    <CollectionGalleryProvider images={galleryImages}>
      {/* Scoped to this page only (not the shared /u/[username] profile
          layout) — so the cover's extracted palette colors --bg/--card/etc.
          here, instead of everything on the page reading the generic
          platform default behind the ambient cover-art wash below. */}
      <div data-channel-root>
        <ChannelColorScheme colorSchemeJson={data.colorSchemeJson} paletteJson={data.paletteJson} />
        <ProfilePageLayout
          activeNav="discover"
          hero={
            <>
              {data.coverUrl && (
                <div
                  className="prof-collection-ambient-bg"
                  style={{ ['--ambient-cover-image' as string]: `url(${data.coverUrl})` }}
                  aria-hidden
                />
              )}
              <div className="prof-collection-open-veil" aria-hidden />
              {backdrop.videoEmbedUrl && <ArchiveVideoBackdrop embedUrl={backdrop.videoEmbedUrl} />}
              {backdrop.cssImageUrl && !backdrop.videoEmbedUrl && (
                <div
                  className="ch-channel-backdrop"
                  style={{ ['--ch-backdrop-image' as string]: backdrop.cssImageUrl }}
                />
              )}
              <div className="prof-collection-top-row">
                <Link href={`/u/${data.user.username}`} className="prof-back-link">
                  ← {data.user.displayName}
                </Link>
                <div className="prof-collection-top-row__actions">
                  <SubscribeButton slug={params.slug} />
                  {data.collaborative && <AddTrackButton slug={params.slug} />}
                  {data.items.length > 0 && <StartJamButton slug={params.slug} />}
                  <CollectionEmbedButton slug={params.slug} />
                  <a
                    href={rssUrl}
                    className="prof-embed-btn"
                    title="RSS feed"
                    aria-label="RSS feed"
                  >
                    <IconRss />
                    RSS
                  </a>
                </div>
              </div>
              {data.collaborative && (
                <p className="prof-list-meta prof-collaborative-hint">
                  🤝 Collaborative playlist — anyone can add a track
                </p>
              )}
              <div className="prof-collection-hero-row">
                {data.coverUrl && (
                  <CollectionCoverButton
                    url={data.coverUrl}
                    className="prof-collection-hero-cover"
                  />
                )}
                <div className="prof-collection-hero-info">
                  <h1 className="prof-page-title prof-page-title--collection">{data.name}</h1>
                  <p className="prof-list-meta">
                    {data.type.replace(/_/g, ' ')} · {data.items.length} item(s)
                  </p>
                  {data.description && (
                    <SafePlainText text={data.description} className="prof-list-meta--spaced" />
                  )}
                </div>
              </div>
            </>
          }
        >
          <ChannelTextLayerView
            mode={data.textLayerMode ?? 'NONE'}
            text={data.textLayerText ?? ''}
            align={data.textLayerAlign ?? 'CENTER'}
          />

          <ChannelGalleryView
            mode={data.galleryMode ?? 'NONE'}
            images={data.slideshowImages ?? []}
          />

          <section className="prof-section">
            {data.items.length === 0 ? (
              <div className="public-empty-card">
                <p className="public-empty-card__text">This collection is empty.</p>
                <p className="public-empty-card__hint">
                  Items appear here when the artist adds them.
                </p>
              </div>
            ) : (
              <div data-tahti-ui="studio">
                <CollectionLibrarySection items={data.items} artistUsername={data.user.username} />
              </div>
            )}
          </section>
        </ProfilePageLayout>
      </div>
    </CollectionGalleryProvider>
  )
}
