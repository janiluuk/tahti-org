// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ArtistEmbedView } from '@tahti/shared'
import { EmbedsManager } from './_embeds-manager'

async function fetchMyEmbeds(): Promise<ArtistEmbedView[]> {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/me/embeds`, {
      headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    return (await res.json()) as ArtistEmbedView[]
  } catch {
    return []
  }
}

export default async function EmbedsPage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login?next=/dashboard/embeds')

  const embeds = await fetchMyEmbeds()

  return (
    <div>
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Embeds</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            SoundCloud tracks embedded on your public profile.
          </p>
        </div>
      </div>
      <EmbedsManager initialEmbeds={embeds} />
    </div>
  )
}
