// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? ''

interface DomainState {
  domain: string
  verified: boolean
  txtRecord?: string
  txtHost?: string
}

export function CustomDomainPanel({
  initialDomain,
  initialVerified,
  isPaid,
}: {
  initialDomain: string | null
  initialVerified: boolean
  isPaid: boolean
}) {
  const [current, setCurrent] = useState<DomainState | null>(
    initialDomain ? { domain: initialDomain, verified: initialVerified } : null,
  )
  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [mode, setMode] = useState<'view' | 'edit'>('view')

  if (!isPaid) {
    return (
      <div className="db-panel">
        <h3 className="db-panel__title">Custom domain</h3>
        <p className="db-panel__hint">
          Custom domains are available on the paid membership (€40/year).{' '}
          <a href="/dashboard/upgrade" className="db-link">
            Upgrade →
          </a>
        </p>
      </div>
    )
  }

  async function saveDomain() {
    if (!input.trim()) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/me/channel/custom-domain`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domain: input.trim() }),
      })
      const data = (await res.json()) as {
        domain?: string
        txtRecord?: string
        txtHost?: string
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'Failed to save domain')
        return
      }
      setCurrent({
        domain: data.domain!,
        verified: false,
        txtRecord: data.txtRecord,
        txtHost: data.txtHost,
      })
      setMode('view')
      setInput('')
    } finally {
      setPending(false)
    }
  }

  async function verifyDomain() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/me/channel/custom-domain/verify`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = (await res.json()) as { verified?: boolean; error?: string }
      if (!res.ok || !data.verified) {
        setError(data.error ?? 'Verification failed')
        return
      }
      setCurrent(
        (prev) => prev && { ...prev, verified: true, txtRecord: undefined, txtHost: undefined },
      )
    } finally {
      setPending(false)
    }
  }

  async function removeDomain() {
    if (!confirm('Remove custom domain?')) return
    setPending(true)
    setError(null)
    try {
      await fetch(`${API_BASE}/api/me/channel/custom-domain`, {
        method: 'DELETE',
        credentials: 'include',
      })
      setCurrent(null)
      setMode('view')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="db-panel">
      <h3 className="db-panel__title">Custom domain</h3>

      {error && (
        <p className="db-panel__hint" style={{ color: 'var(--coral)' }}>
          {error}
        </p>
      )}

      {!current && mode === 'view' && (
        <>
          <p className="db-panel__hint">
            Point your own domain to your channel page. Add a CNAME or A record to{' '}
            <code>app.tahti.live</code>, then enter the domain below.
          </p>
          <button className="ui-btn ui-btn--sm ui-btn--secondary" onClick={() => setMode('edit')}>
            Set custom domain
          </button>
        </>
      )}

      {mode === 'edit' && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="music.example.com"
            className="db-input"
            style={{ flex: 1, minWidth: 200 }}
          />
          <button
            className="ui-btn ui-btn--sm ui-btn--primary"
            onClick={saveDomain}
            disabled={pending || !input.trim()}
          >
            {pending ? 'Saving…' : 'Save'}
          </button>
          <button className="ui-btn ui-btn--sm ui-btn--ghost" onClick={() => setMode('view')}>
            Cancel
          </button>
        </div>
      )}

      {current && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <code style={{ fontSize: '0.875rem' }}>{current.domain}</code>
            {current.verified ? (
              <span style={{ fontSize: '0.75rem', color: 'var(--green)', fontWeight: 700 }}>
                ✓ verified
              </span>
            ) : (
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>unverified</span>
            )}
            <button
              className="ui-btn ui-btn--sm ui-btn--ghost"
              onClick={removeDomain}
              disabled={pending}
              style={{ marginLeft: 'auto' }}
            >
              Remove
            </button>
          </div>

          {!current.verified && current.txtHost && (
            <div
              className="db-panel__hint"
              style={{
                background: 'rgba(255,255,255,0.04)',
                padding: '0.75rem',
                borderRadius: '6px',
                fontSize: '0.8125rem',
              }}
            >
              <p style={{ marginBottom: '0.5rem', fontWeight: 600 }}>DNS verification required</p>
              <p style={{ marginBottom: '0.25rem' }}>
                Add this TXT record to your DNS, then click Verify:
              </p>
              <p>
                Host: <code>{current.txtHost}</code>
              </p>
              <p>
                Value: <code>{current.txtRecord}</code>
              </p>
              <button
                className="ui-btn ui-btn--sm ui-btn--primary"
                onClick={verifyDomain}
                disabled={pending}
                style={{ marginTop: '0.5rem' }}
              >
                {pending ? 'Checking DNS…' : 'Verify domain'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
