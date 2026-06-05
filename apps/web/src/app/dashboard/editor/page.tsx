// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Heading, PageShell } from '@tahti/ui'
import { createEmptyEditorProject, fetchEditorProjects } from './editor-actions'

export default async function EditorIndexPage({
  searchParams,
}: {
  searchParams: { archiveItemId?: string }
}) {
  const cookieStore = cookies()
  if (!cookieStore.get('tahti_session')) redirect('/login')

  if (searchParams.archiveItemId) {
    const apiUrl = process.env.API_URL ?? 'http://localhost:3001'
    const session = cookieStore.get('tahti_session')!
    const res = await fetch(`${apiUrl}/api/me/editor/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: `tahti_session=${session.value}`,
      },
      body: JSON.stringify({ archiveItemId: searchParams.archiveItemId }),
      cache: 'no-store',
    })
    if (res.ok) {
      const project = (await res.json()) as { id: string }
      redirect(`/dashboard/editor/${project.id}`)
    }
  }

  const { projects, error } = await fetchEditorProjects()

  return (
    <PageShell>
      <div className="studio-row studio-row--between studio-mb-lg">
        <Heading level={1}>Audio editor</Heading>
        <form action={createEmptyEditorProject}>
          <button type="submit" className="studio-btn-primary">
            New session
          </button>
        </form>
      </div>
      <p className="studio-text-muted-sm studio-mb-lg">
        Multitrack sessions with trim, crossfade, and mixdown export to archive (M21 v1).
      </p>
      {error && <p className="studio-text-error">{error}</p>}
      <ul className="studio-list">
        {(projects ?? []).map((p) => (
          <li key={p.id} className="studio-card-row studio-mb-sm">
            <div>
              <div className="studio-stat-box-title">{p.title}</div>
              <div className="studio-text-muted-sm">
                Updated {new Date(p.updatedAt).toLocaleString()}
              </div>
            </div>
            <Link href={`/dashboard/editor/${p.id}`} className="studio-btn-ghost">
              Open
            </Link>
          </li>
        ))}
      </ul>
      {projects?.length === 0 && (
        <p className="studio-text-muted-sm">
          No sessions yet. Open one from an archive item or create a new session.
        </p>
      )}
    </PageShell>
  )
}
