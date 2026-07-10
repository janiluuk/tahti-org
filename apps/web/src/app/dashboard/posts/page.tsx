// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ArtistPostView } from '@tahti/shared'
import { PostsManager } from './_posts-manager'

async function fetchMyPosts(): Promise<ArtistPostView[]> {
  const sessionCookie = cookies().get('tahti_session')
  const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
  try {
    const res = await fetch(`${apiUrl}/api/me/posts`, {
      headers: { Cookie: `tahti_session=${sessionCookie?.value ?? ''}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    return (await res.json()) as ArtistPostView[]
  } catch {
    return []
  }
}

export default async function PostsPage() {
  const sessionCookie = cookies().get('tahti_session')
  if (!sessionCookie) redirect('/login?next=/dashboard/posts')

  const posts = await fetchMyPosts()

  return (
    <div>
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Posts</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Updates, news, and announcements — public on your profile.
          </p>
        </div>
      </div>
      <PostsManager initialPosts={posts} />
    </div>
  )
}
