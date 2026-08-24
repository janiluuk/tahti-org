// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { NewsPanel, type AdminNewsPostRow } from './news-panel'
import { NewsTabs } from './_news-tabs'

function boardFetch(path: string) {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  return fetch(`${apiUrl}${path}`, {
    headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
    cache: 'no-store',
  })
}

export default async function AdminNewsPage() {
  const res = await boardFetch('/api/admin/news')
  const posts: AdminNewsPostRow[] = res.ok ? await res.json() : []

  return (
    <>
      <h1 className="admin-section-title">News feed</h1>
      <p className="admin-stat-sub">
        Posts shown on the homepage news feed. Every post carries a byline of who wrote it — drafts
        stay hidden from the public feed until published.
      </p>
      <NewsTabs newsPanel={<NewsPanel posts={posts} />} />
    </>
  )
}
