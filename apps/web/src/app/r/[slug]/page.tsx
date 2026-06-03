// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { notFound, redirect } from 'next/navigation'

export default async function SmartLinkPage({ params }: { params: { slug: string } }) {
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  const res = await fetch(`${apiUrl}/api/v1/r/${encodeURIComponent(params.slug)}`, {
    cache: 'no-store',
  })
  if (!res.ok) notFound()
  const { releaseUrl } = (await res.json()) as { releaseUrl: string }
  const path = releaseUrl.replace(/^https?:\/\/[^/]+/, '') || releaseUrl
  redirect(path.startsWith('/') ? path : `/${path}`)
}
