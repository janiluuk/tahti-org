'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useState } from 'react'
import {
  Button,
  ButtonIcon,
  DataRowList,
  DataRowListEmpty,
  DataRowListHeader,
  DataRowListRow,
  StatusPill,
} from '@tahti/ui'
import { createTahtiClient, type components } from '@tahti/api-client'

type ApiTokenView = components['schemas']['ApiTokenList'][number]

const COLUMNS = '1.2fr auto auto auto auto'

function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function ApiTokensPanel({ initial, apiBase }: { initial: ApiTokenView[]; apiBase: string }) {
  const api = createTahtiClient({ baseUrl: apiBase, credentials: 'include' })

  const [tokens, setTokens] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [canWrite, setCanWrite] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [revealedToken, setRevealedToken] = useState<string | null>(null)
  const [copyLabel, setCopyLabel] = useState('Copy')

  async function createToken() {
    setSaving(true)
    setError(null)
    const { data, error: apiError } = await api.POST('/api/me/api-tokens', {
      body: { name: name.trim(), scopes: canWrite ? ['read', 'write'] : ['read'] },
    })
    setSaving(false)
    if (apiError || !data) {
      setError((apiError as { error?: string } | undefined)?.error ?? 'Failed to create token')
      return
    }
    const { token, ...view } = data
    setTokens((prev) => [view, ...prev])
    setRevealedToken(token)
    setAdding(false)
    setName('')
    setCanWrite(false)
  }

  async function revokeToken(id: string) {
    if (!confirm('Revoke this token? Anything using it will stop working immediately.')) return
    const { response } = await api.DELETE('/api/me/api-tokens/{id}', { params: { path: { id } } })
    if (response.status === 204) {
      setTokens((prev) => prev.filter((t) => t.id !== id))
    }
  }

  return (
    <>
      {revealedToken && (
        <div className="studio-info-callout studio-mb-md">
          <strong>New token — copy it now, it won&apos;t be shown again:</strong>
          <div className="studio-field studio-mt-sm" style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              readOnly
              value={revealedToken}
              className="studio-input studio-font-mono"
              onFocus={(e) => e.currentTarget.select()}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                void navigator.clipboard.writeText(revealedToken)
                setCopyLabel('Copied!')
                setTimeout(() => setCopyLabel('Copy'), 1500)
              }}
            >
              {copyLabel}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setRevealedToken(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}

      <DataRowList>
        <DataRowListHeader columns={COLUMNS}>
          <span>Name</span>
          <span>Scopes</span>
          <span>Last used</span>
          <span>Created</span>
          <span />
        </DataRowListHeader>
        {tokens.length === 0 && (
          <DataRowListEmpty>
            No API tokens yet. Create one to use the Tahti API from a script or third-party
            integration.
          </DataRowListEmpty>
        )}
        {tokens.map((t) => (
          <DataRowListRow key={t.id} columns={COLUMNS}>
            <span>
              {t.name}
              <span className="studio-text-muted-sm studio-font-mono"> {t.tokenPrefix}…</span>
            </span>
            <span>
              <StatusPill tone={t.scopes.includes('write') ? 'amber' : 'cyan'}>
                {t.scopes.includes('write') ? 'READ/WRITE' : 'READ-ONLY'}
              </StatusPill>
            </span>
            <span className="studio-text-muted-sm">{formatDate(t.lastUsedAt)}</span>
            <span className="studio-text-muted-sm">{formatDate(t.createdAt)}</span>
            <Button variant="secondary" size="sm" onClick={() => void revokeToken(t.id)}>
              Revoke
            </Button>
          </DataRowListRow>
        ))}
      </DataRowList>

      <div className="multistream-footer">
        {!adding && (
          <Button onClick={() => setAdding(true)} variant="primary" size="sm">
            <ButtonIcon name="plus" />
            New token
          </Button>
        )}
      </div>

      {adding && (
        <div className="studio-subsection studio-mt-lg">
          {error && <p className="studio-notice studio-notice--error studio-mb-sm">{error}</p>}
          <div className="studio-field">
            <label className="studio-label studio-text-muted-sm">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. hearthis.at importer"
              maxLength={64}
              className="studio-input studio-mt-sm"
            />
          </div>
          <label
            className="studio-text-muted-sm studio-mt-sm"
            style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}
          >
            <input
              type="checkbox"
              checked={canWrite}
              onChange={(e) => setCanWrite(e.target.checked)}
            />
            Allow write access (create/update/delete) — leave off for read-only
          </label>
          <div className="studio-mt-md" style={{ display: 'flex', gap: '0.5rem' }}>
            <Button
              variant="primary"
              size="sm"
              disabled={saving || name.trim().length === 0}
              onClick={() => void createToken()}
            >
              {saving ? 'Creating…' : 'Create token'}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
