// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import dynamic from 'next/dynamic'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { fetchSoundEditListDraft, fetchSoundEditorSource } from '../../../sound-actions'

const ProAudioEditor = dynamic(
  () => import('../../../pro-audio-editor').then((m) => m.ProAudioEditor),
  { ssr: false, loading: () => <p className="pro-editor-loading">Loading editor…</p> },
)

export default async function ProSoundEditorPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  if (!cookieStore.get('tahti_session')) redirect('/login')

  const [source, draft] = await Promise.all([
    fetchSoundEditorSource(params.id),
    fetchSoundEditListDraft(params.id),
  ])

  if (source.error || !source.sourceKey) {
    return (
      <div className="pro-editor-shell">
        <p className="studio-text-error">{source.error ?? 'Sound not ready'}</p>
        <a href="/dashboard" className="ui-btn ui-btn--ghost ui-btn--sm">
          ← Dashboard
        </a>
      </div>
    )
  }

  if (draft.error || !draft.editList) {
    return (
      <div className="pro-editor-shell">
        <p className="studio-text-error">{draft.error ?? 'Failed to load draft'}</p>
        <a href="/dashboard" className="ui-btn ui-btn--ghost ui-btn--sm">
          ← Dashboard
        </a>
      </div>
    )
  }

  return (
    <ProAudioEditor
      soundId={params.id}
      title={source.title ?? 'Sound'}
      sourceUrl={`/dashboard/sounds/${params.id}/editor/stream`}
      sourceKey={source.sourceKey ?? params.id}
      sourceFileSizeBytes={source.sourceFileSizeBytes ?? null}
      initialEditList={draft.editList}
      draftUpdatedAt={draft.updatedAt ?? null}
      initialTracklist={draft.tracklist ?? null}
      initialEditorPeaks={draft.editorPeaks ?? null}
    />
  )
}
