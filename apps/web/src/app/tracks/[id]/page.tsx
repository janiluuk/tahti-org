// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import { TrackPlayerView, type TrackPlayerData } from './track-player-view'

export default async function TrackPage({ params }: { params: { id: string } }) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/tracks/${encodeURIComponent(params.id)}`, {
    cache: 'no-store',
  })
  if (!res.ok) notFound()

  const track = (await res.json()) as TrackPlayerData
  return <TrackPlayerView track={track} />
}
