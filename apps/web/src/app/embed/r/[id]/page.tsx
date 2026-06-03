// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import ReleaseEmbedPlayer from './release-embed-player'

export default async function ReleaseEmbedPage({ params }: { params: { id: string } }) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/embed/r/${encodeURIComponent(params.id)}`, {
    cache: 'no-store',
  })
  if (!res.ok) notFound()
  const release = await res.json()
  return <ReleaseEmbedPlayer release={release} />
}
