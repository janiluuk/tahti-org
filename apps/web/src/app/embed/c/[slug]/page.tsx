// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import { EmbedShell, Link, LiveBadge, Text } from '@tahti/ui'
import HlsPlayer from '../../../c/[slug]/hls-player'
import { LiveTracklistPanel } from '@/components/live-tracklist-panel'

interface EmbedChannel {
  slug: string
  state: string
  artist: { username: string; displayName: string; avatarUrl: string | null }
  profileUrl: string
  hlsUrl: string | null
}

export default async function ChannelEmbedPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { tracklist?: string; bg?: string }
}) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/embed/c/${encodeURIComponent(params.slug)}`, {
    cache: 'no-store',
  })
  if (!res.ok) notFound()
  const channel = (await res.json()) as EmbedChannel

  const showTracklist = searchParams.tracklist !== '0'
  const transparent = searchParams.bg === 'transparent'

  return (
    <EmbedShell transparent={transparent}>
      <div className="embed-header">
        {channel.artist.avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={channel.artist.avatarUrl}
            alt=""
            className="embed-avatar"
            width={40}
            height={40}
          />
        )}
        <div className="embed-header__meta">
          <p className="embed-header__title">{channel.artist.displayName}</p>
          <Link
            href={channel.profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="embed-header__link"
          >
            @{channel.artist.username} on Tahti
          </Link>
        </div>
        {channel.state === 'LIVE' && <LiveBadge />}
      </div>

      {channel.hlsUrl ? (
        <div className="embed-player-wrap">
          <HlsPlayer url={channel.hlsUrl} />
        </div>
      ) : (
        <Text as="p" className="embed-offline">
          Not live right now —{' '}
          <Link href={channel.profileUrl} className="embed-header__link">
            visit the channel
          </Link>
        </Text>
      )}

      {showTracklist && channel.state === 'LIVE' && channel.hlsUrl && (
        <LiveTracklistPanel slug={channel.slug} className="embed-live-tracklist" />
      )}
    </EmbedShell>
  )
}
