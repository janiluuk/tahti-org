// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import dynamic from 'next/dynamic'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { fetchArchiveEditListDraft, fetchArchiveEditorSource } from '../../../archive-actions'

const ProAudioEditor = dynamic(
  () => import('../../../pro-audio-editor').then((m) => m.ProAudioEditor),
  { ssr: false, loading: () => <p className="pro-editor-loading">Loading editor…</p> },
)

export default async function ProArchiveEditorPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  if (!cookieStore.get('tahti_session')) redirect('/login')

  const [source, draft] = await Promise.all([
    fetchArchiveEditorSource(params.id),
    fetchArchiveEditListDraft(params.id),
  ])

  if (source.error || !source.url) {
    return (
      <div className="pro-editor-shell">
        <p className="studio-text-error">{source.error ?? 'Archive not ready'}</p>
        <a href="/dashboard" className="studio-btn-ghost">
          ← Dashboard
        </a>
      </div>
    )
  }

  if (draft.error || !draft.editList) {
    return (
      <div className="pro-editor-shell">
        <p className="studio-text-error">{draft.error ?? 'Failed to load draft'}</p>
        <a href="/dashboard" className="studio-btn-ghost">
          ← Dashboard
        </a>
      </div>
    )
  }

  return (
    <ProAudioEditor
      archiveId={params.id}
      title={source.title ?? 'Archive'}
      sourceUrl={source.url}
      sourceKey={source.sourceKey ?? params.id}
      initialEditList={draft.editList}
      draftUpdatedAt={draft.updatedAt ?? null}
    />
  )
}
