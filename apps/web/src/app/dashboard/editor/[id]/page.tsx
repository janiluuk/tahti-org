// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import dynamic from 'next/dynamic'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Heading, PageShell } from '@tahti/ui'
import { fetchEditorProject } from '../editor-actions'

const MultitrackEditor = dynamic(
  () => import('../multitrack-editor').then((m) => m.MultitrackEditor),
  { ssr: false, loading: () => <p className="studio-text-muted-sm">Loading editor…</p> },
)

export default async function EditorProjectPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  if (!cookieStore.get('tahti_session')) redirect('/login')

  const { project, error } = await fetchEditorProject(params.id)
  if (error || !project) {
    return (
      <PageShell>
        <Heading level={1}>Editor</Heading>
        <p className="studio-text-error">{error ?? 'Project not found'}</p>
        <Link href="/dashboard/editor" className="studio-btn-ghost">
          Back to sessions
        </Link>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="studio-row studio-row--between studio-mb-lg">
        <Heading level={1}>Multitrack editor</Heading>
        <Link href="/dashboard/editor" className="studio-btn-ghost">
          All sessions
        </Link>
      </div>
      <MultitrackEditor
        projectId={project.id}
        title={project.title}
        archiveItemId={project.archiveItemId}
        timeline={project.timeline}
        sources={project.sources}
      />
    </PageShell>
  )
}
