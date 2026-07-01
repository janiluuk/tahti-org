// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { PageShell, SidebarNavIconSvg, Button } from '@tahti/ui'
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
    <PageShell size="md">
      <div className="studio-page-header">
        <div>
          <h1 className="studio-page-title">Audio editor</h1>
          <p className="studio-text-muted-sm studio-mt-xs">
            Multitrack sessions with trim, crossfade, and mixdown export to archive.
          </p>
        </div>
        <div className="studio-page-header__actions">
          <form action={createEmptyEditorProject}>
            <Button type="submit" variant="primary" size="sm">
              <SidebarNavIconSvg name="upload" />
              New session
            </Button>
          </form>
        </div>
      </div>
      {error && <p className="studio-text-error">{error}</p>}
      {(projects ?? []).length > 0 ? (
        <ul className="studio-list">
          {(projects ?? []).map((p) => (
            <li key={p.id} className="studio-card-row studio-mb-sm">
              <div>
                <div className="studio-stat-box-title">{p.title}</div>
                <div className="studio-text-muted-sm">
                  Updated {new Date(p.updatedAt).toLocaleString()}
                </div>
              </div>
              <Link href={`/dashboard/editor/${p.id}`} className="ui-btn ui-btn--sm ui-btn--ghost">
                Open
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {projects?.length === 0 && (
        <div className="studio-empty-card studio-mt-md">
          <p className="studio-empty-card__text">No sessions yet</p>
          <p className="studio-empty-card__hint">
            Open one from an archive item or create a new session above.
          </p>
        </div>
      )}
    </PageShell>
  )
}
