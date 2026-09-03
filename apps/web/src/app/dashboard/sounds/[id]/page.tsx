// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ButtonIcon } from '@tahti/ui'
import { fetchSoundEditorSource } from '../../sound-actions'
import { SoundPreviewPlayer } from './_preview-player'

export default async function SoundPreviewPage({ params }: { params: { id: string } }) {
  const cookieStore = cookies()
  if (!cookieStore.get('tahti_session')) redirect('/login')

  const source = await fetchSoundEditorSource(params.id)
  if (source.error || !source.url) {
    return (
      <div className="pro-editor-shell">
        <p className="studio-text-error">{source.error ?? 'Sound item not found'}</p>
        <Link href="/dashboard/sounds" className="ui-btn ui-btn--ghost ui-btn--sm">
          ← Sounds
        </Link>
      </div>
    )
  }

  return (
    <div className="sound-preview-page">
      <div className="sound-preview-page__header">
        <Link href="/dashboard/sounds" className="sound-preview-page__back">
          ← Sounds
        </Link>
        <h1 className="sound-preview-page__title">{source.title ?? 'Untitled'}</h1>
      </div>

      <SoundPreviewPlayer
        itemId={params.id}
        title={source.title ?? 'Untitled'}
        audioUrl={source.url}
        durationSec={source.durationSec ?? null}
      />

      <div className="sound-preview-page__actions">
        <Link href={`/dashboard/sounds/${params.id}/editor`} className="ui-btn ui-btn--primary">
          <ButtonIcon name="edit" />
          Open audio editor →
        </Link>
      </div>
    </div>
  )
}
