// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Badge, Button, Panel } from '@tahti/ui'
import type { ThemeView } from '@tahti/shared'
import { ThemeEditor, type ThemeEditorValue } from '@/components/themes/theme-editor'
import {
  removeMyTheme,
  saveNewTheme,
  submitThemeAsPublic,
  updateMyTheme,
} from './themes-actions'

function visibilityBadge(theme: ThemeView) {
  if (theme.visibility === 'PENDING_REVIEW') return <Badge variant="neutral">In review</Badge>
  if (theme.visibility === 'REJECTED') return <Badge variant="neutral">Rejected</Badge>
  if (theme.prStatus === 'OPENED') return <Badge variant="success">PR open</Badge>
  return <Badge variant="neutral">Private</Badge>
}

function ThemeRow({
  theme,
  onChange,
  onRemove,
}: {
  theme: ThemeView
  onChange: (theme: ThemeView) => void
  onRemove: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const canEdit = theme.visibility !== 'PENDING_REVIEW'
  const canSubmit = theme.visibility === 'PRIVATE' || theme.visibility === 'REJECTED'

  async function handleSave(value: ThemeEditorValue) {
    setPending(true)
    setError(null)
    const result = await updateMyTheme(theme.id, value)
    setPending(false)
    if (result.error || !result.theme) {
      setError(result.error ?? 'Failed to save')
      return
    }
    onChange(result.theme)
    setEditing(false)
  }

  async function handleSubmit() {
    setPending(true)
    setError(null)
    const result = await submitThemeAsPublic(theme.id)
    setPending(false)
    if (result.error || !result.theme) {
      setError(result.error ?? 'Failed to submit')
      return
    }
    onChange(result.theme)
  }

  async function handleDelete() {
    setPending(true)
    setError(null)
    const result = await removeMyTheme(theme.id)
    setPending(false)
    if (result.error) {
      setError(result.error)
      return
    }
    onRemove(theme.id)
  }

  return (
    <div className="ui-panel studio-mt-sm">
      <div className="studio-row" style={{ justifyContent: 'space-between' }}>
        <div className="studio-row" style={{ gap: '0.5rem' }}>
          <strong>{theme.name}</strong>
          {visibilityBadge(theme)}
        </div>
        <div className="studio-row" style={{ gap: '0.5rem' }}>
          {canEdit && (
            <Button type="button" variant="secondary" size="sm" onClick={() => setEditing((v) => !v)}>
              {editing ? 'Close' : 'Edit'}
            </Button>
          )}
          {canSubmit && (
            <Button type="button" variant="primary" size="sm" disabled={pending} onClick={() => void handleSubmit()}>
              Submit as public
            </Button>
          )}
          <Button type="button" variant="danger" size="sm" disabled={pending} onClick={() => void handleDelete()}>
            Delete
          </Button>
        </div>
      </div>
      {theme.visibility === 'REJECTED' && theme.moderationNote && (
        <p className="studio-notice studio-notice--error studio-mt-sm">{theme.moderationNote}</p>
      )}
      {theme.prUrl && (
        <p className="studio-text-muted-sm studio-mt-sm">
          <a href={theme.prUrl} target="_blank" rel="noopener noreferrer">
            View pull request →
          </a>
        </p>
      )}
      {editing && (
        <div className="studio-mt-sm">
          <ThemeEditor
            initial={{ name: theme.name, vars: theme.vars, dark: theme.dark }}
            onSave={(v) => void handleSave(v)}
            saving={pending}
          />
        </div>
      )}
      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </div>
  )
}

export function ThemesPanel({ initialThemes }: { initialThemes: ThemeView[] }) {
  const [themes, setThemes] = useState(initialThemes)
  const [creating, setCreating] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleCreate(value: ThemeEditorValue) {
    setPending(true)
    setError(null)
    const result = await saveNewTheme(value)
    setPending(false)
    if (result.error || !result.theme) {
      setError(result.error ?? 'Failed to save')
      return
    }
    setThemes((prev) => [result.theme!, ...prev])
    setCreating(false)
  }

  return (
    <Panel
      title="Your themes"
      description="Build a theme, keep it private, or submit it to become part of the default gallery (credited to you)."
    >
      {themes.length === 0 && !creating ? (
        <p className="studio-empty">No themes yet.</p>
      ) : (
        themes.map((t) => (
          <ThemeRow
            key={t.id}
            theme={t}
            onChange={(updated) => setThemes((prev) => prev.map((th) => (th.id === updated.id ? updated : th)))}
            onRemove={(id) => setThemes((prev) => prev.filter((th) => th.id !== id))}
          />
        ))
      )}

      {creating ? (
        <div className="ui-panel studio-mt-sm">
          <ThemeEditor onSave={(v) => void handleCreate(v)} saving={pending} />
        </div>
      ) : (
        <Button type="button" variant="primary" className="studio-mt-lg" onClick={() => setCreating(true)}>
          New theme
        </Button>
      )}
      {error && <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p>}
    </Panel>
  )
}
