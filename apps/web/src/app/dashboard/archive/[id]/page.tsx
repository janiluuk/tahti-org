// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ButtonIcon } from '@tahti/ui'
import { fetchArchiveEditorSource } from '../../archive-actions'
import { ArchivePreviewPlayer } from './_preview-player'

export default async function ArchivePreviewPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  if (!cookieStore.get('tahti_session')) redirect('/login')

  const source = await fetchArchiveEditorSource(params.id)
  if (source.error || !source.url) {
    return (
      <div className="pro-editor-shell">
        <p className="studio-text-error">{source.error ?? 'Archive item not found'}</p>
        <Link href="/dashboard/archive" className="ui-btn ui-btn--ghost ui-btn--sm">
          ← Archive
        </Link>
      </div>
    )
  }

  return (
    <div className="archive-preview-page">
      <div className="archive-preview-page__header">
        <Link href="/dashboard/archive" className="archive-preview-page__back">
          ← Archive
        </Link>
        <h1 className="archive-preview-page__title">{source.title ?? 'Untitled'}</h1>
      </div>

      <ArchivePreviewPlayer
        itemId={params.id}
        title={source.title ?? 'Untitled'}
        audioUrl={source.url}
        durationSec={source.durationSec ?? null}
      />

      <div className="archive-preview-page__actions">
        <Link href={`/dashboard/archive/${params.id}/editor`} className="ui-btn ui-btn--primary">
          <ButtonIcon name="edit" />
          Open audio editor →
        </Link>
      </div>
    </div>
  )
}
