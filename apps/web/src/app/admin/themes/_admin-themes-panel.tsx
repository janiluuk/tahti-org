// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Badge, Button, Input } from '@tahti/ui'
import type { AdminThemeView } from '@tahti/shared'
import { ThemeEditor } from '@/components/themes/theme-editor'
import { approveTheme, rejectTheme } from './actions'

function ReviewRow({
  theme,
  onDecided,
}: {
  theme: AdminThemeView
  onDecided: (theme: AdminThemeView) => void
}) {
  const [note, setNote] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleApprove() {
    setPending(true)
    setError(null)
    const result = await approveTheme(theme.id)
    setPending(false)
    if (result.error || !result.theme) {
      setError(result.error ?? 'Failed to approve')
      return
    }
    onDecided(result.theme)
  }

  async function handleReject() {
    if (!note.trim()) {
      setError('A reason is required to reject')
      return
    }
    setPending(true)
    setError(null)
    const result = await rejectTheme(theme.id, note.trim())
    setPending(false)
    if (result.error || !result.theme) {
      setError(result.error ?? 'Failed to reject')
      return
    }
    onDecided(result.theme)
  }

  return (
    <div className="ui-panel studio-mt-sm">
      <div className="admin-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>{theme.name}</strong> <Badge variant="neutral">by @{theme.authorUsername}</Badge>
        </div>
      </div>
      <div className="studio-mt-sm">
        <ThemeEditor initial={{ name: theme.name, vars: theme.vars, dark: theme.dark }} readOnly />
      </div>
      <div className="admin-row studio-mt-sm" style={{ gap: '0.5rem', alignItems: 'center' }}>
        <Button variant="primary" size="sm" disabled={pending} onClick={() => void handleApprove()}>
          Approve
        </Button>
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason for rejecting"
          style={{ maxWidth: '16rem' }}
        />
        <Button variant="danger" size="sm" disabled={pending} onClick={() => void handleReject()}>
          Reject
        </Button>
      </div>
      {error && <p className="admin-form-error">{error}</p>}
    </div>
  )
}

function DecidedRow({ theme }: { theme: AdminThemeView }) {
  return (
    <div className="ui-panel studio-mt-sm">
      <div className="admin-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>{theme.name}</strong> <Badge variant="neutral">by @{theme.authorUsername}</Badge>{' '}
          <Badge variant={theme.visibility === 'REJECTED' ? 'neutral' : 'success'}>
            {theme.visibility === 'REJECTED' ? 'Rejected' : theme.prStatus}
          </Badge>
        </div>
        {theme.prUrl && (
          <a href={theme.prUrl} target="_blank" rel="noopener noreferrer">
            View PR →
          </a>
        )}
      </div>
      {theme.moderationNote && <p className="admin-text-muted">{theme.moderationNote}</p>}
    </div>
  )
}

export function AdminThemesPanel({
  initialPending,
  initialDecided,
}: {
  initialPending: AdminThemeView[]
  initialDecided: AdminThemeView[]
}) {
  const [pending, setPending] = useState(initialPending)
  const [decided, setDecided] = useState(initialDecided)

  function handleDecided(theme: AdminThemeView) {
    setPending((prev) => prev.filter((t) => t.id !== theme.id))
    setDecided((prev) => [theme, ...prev])
  }

  return (
    <div>
      <h2>Pending review</h2>
      {pending.length === 0 ? (
        <p className="admin-text-muted">Nothing waiting on review.</p>
      ) : (
        pending.map((t) => <ReviewRow key={t.id} theme={t} onDecided={handleDecided} />)
      )}

      <h2 className="studio-mt-lg">Decided</h2>
      {decided.length === 0 ? (
        <p className="admin-text-muted">Nothing decided yet.</p>
      ) : (
        decided.map((t) => <DecidedRow key={t.id} theme={t} />)
      )}
    </div>
  )
}
