// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { notFound } from 'next/navigation'
import { EmbedShell } from '@tahti/ui'
import CollectionEmbedPlayer from './collection-embed-player'

export default async function CollectionEmbedPage({
  params,
  searchParams,
}: {
  params: { slug: string }
  searchParams: { bg?: string }
}) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/embed/col/${encodeURIComponent(params.slug)}`, {
    cache: 'no-store',
  })
  if (!res.ok) notFound()
  const collection = await res.json()
  return (
    <EmbedShell transparent={searchParams.bg === 'transparent'}>
      <CollectionEmbedPlayer collection={collection} />
    </EmbedShell>
  )
}
