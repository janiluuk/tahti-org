// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ReleaseSmartLink, SafePlainText, SmartLinkPageLayout } from '@tahti/ui'
import { SmartLinkDspButtons } from '@/components/smart-link-dsp-buttons'
import { SmartLinkReleaseDetails } from '@/components/smart-link-release-details'
import { ChannelColorScheme } from '@/components/visuals/channel-color-scheme'
import { ChannelVisualizer } from '@/components/visuals/channel-visualizer'

interface SmartLinkTrack {
  title: string
  isrc: string | null
  position: number
}

interface FeaturedCollection {
  slug: string
  name: string
  type: string
  description: string | null
  itemCount: number
  url: string
}

interface SmartLinkResponse {
  release: {
    id: string
    title: string
    type: string
    releaseDate: string
    artworkUrl: string | null
    description: string | null
    upc: string | null
    pLine: string | null
    cLine: string | null
    tracks: SmartLinkTrack[]
    musicbrainzUrl: string | null
    discogsUrl: string | null
    colorSchemeJson?: string | null
    paletteJson?: string | null
    visualPreset?: string
  }
  artist: { username: string; displayName: string; avatarUrl: string | null }
  featuredCollections?: FeaturedCollection[]
  profileUrl: string
  releaseUrl: string
  targets: Record<string, string>
  embedUrl: string
}

export default async function SmartLinkPage({ params }: { params: { slug: string } }) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/r/${encodeURIComponent(params.slug)}`, {
    cache: 'no-store',
  })
  if (!res.ok) notFound()
  const data = (await res.json()) as SmartLinkResponse

  const tracksWithIsrc = data.release.tracks.filter((t) => t.isrc?.trim())
  const year = new Date(data.release.releaseDate).getFullYear()
  const trackCount = data.release.tracks.length
  const hasTargets = Object.values(data.targets).some((url) => url?.trim())

  return (
    <SmartLinkPageLayout
      contextLink={{ href: data.profileUrl, label: `← ${data.artist.username}` }}
    >
      <ChannelColorScheme
        colorSchemeJson={data.release.colorSchemeJson}
        paletteJson={data.release.paletteJson}
      />
      {data.release.visualPreset && data.release.visualPreset !== 'MINIMAL' ? (
        <ChannelVisualizer
          preset={data.release.visualPreset as import('@tahti/shared').VisualPreset}
          colorSchemeJson={data.release.colorSchemeJson}
          paletteJson={data.release.paletteJson}
        />
      ) : null}

      <ReleaseSmartLink
        releaseId={data.release.id}
        statusLabel="Published"
        title={data.release.title}
        artistName={data.artist.displayName}
        releaseType={data.release.type}
        trackCount={trackCount > 0 ? trackCount : undefined}
        year={year}
        artworkUrl={data.release.artworkUrl}
        quote={
          data.release.description ? (
            <SafePlainText text={data.release.description} linkMentions />
          ) : null
        }
        details={
          <SmartLinkReleaseDetails
            upc={data.release.upc}
            pLine={data.release.pLine}
            cLine={data.release.cLine}
            tracksWithIsrc={tracksWithIsrc}
            musicbrainzUrl={data.release.musicbrainzUrl}
            discogsUrl={data.release.discogsUrl}
            featuredCollections={data.featuredCollections}
          />
        }
        footer={
          <>
            Powered by <a href="https://tahti.live">tahti.live</a>
            {' · '}
            <Link href={data.profileUrl}>@{data.artist.username}</Link>
          </>
        }
      >
        <SmartLinkDspButtons smartLinkSlug={params.slug} targets={data.targets} />
        {!hasTargets ? (
          <div className="public-empty-card">
            <p className="public-empty-card__text">Streaming links coming soon.</p>
            <p className="public-empty-card__hint">
              <Link href={data.releaseUrl}>Listen on Tahti</Link>
            </p>
          </div>
        ) : null}
      </ReleaseSmartLink>
    </SmartLinkPageLayout>
  )
}
