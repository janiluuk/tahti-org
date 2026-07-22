// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import { EmbedShell } from '@tahti/ui'
import ReleaseEmbedPlayer from './release-embed-player'

export default async function ReleaseEmbedPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: { bg?: string }
}) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/embed/r/${encodeURIComponent(params.id)}`, {
    cache: 'no-store',
  })
  if (!res.ok) notFound()
  const release = await res.json()
  return (
    <EmbedShell transparent={searchParams.bg === 'transparent'}>
      <ReleaseEmbedPlayer release={release} />
    </EmbedShell>
  )
}
