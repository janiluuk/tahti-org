// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { ButtonIcon, Panel, Button } from '@tahti/ui'

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
      <Panel title="Custom domain" headerTight>
        <p className="studio-help">
          Custom domains are available with active Tahti ry membership (€40/year).{' '}
          <Link href="/dashboard/settings/account">View membership →</Link>
        </p>
      </Panel>
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
    <Panel title="Custom domain" headerTight>
      {error ? <p className="studio-text-error studio-mb-sm">{error}</p> : null}

      {!current && mode === 'view' && (
        <>
          <p className="studio-help">
            Point your own domain to your channel page. Add a CNAME or A record to{' '}
            <code>app.tahti.live</code>, then enter the domain below.
          </p>
          <Button onClick={() => setMode('edit')} variant="secondary" size="sm">
            Set custom domain
          </Button>
        </>
      )}

      {mode === 'edit' && (
        <div className="studio-input-row">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="music.example.com"
            className="studio-input studio-input--grow"
          />
          <Button
            onClick={saveDomain}
            disabled={pending || !input.trim()}
            variant="primary"
            size="sm"
          >
            <ButtonIcon name="save" />
            {pending ? 'Saving…' : 'Save'}
          </Button>
          <Button onClick={() => setMode('view')} variant="ghost" size="sm">
            Cancel
          </Button>
        </div>
      )}

      {current && (
        <div className="studio-mt-sm">
          <div className="studio-row--between">
            <div className="studio-row studio-gap-xs">
              <code className="studio-text-sm">{current.domain}</code>
              {current.verified ? (
                <span className="studio-badge studio-badge--success">Verified</span>
              ) : (
                <span className="studio-text-muted-sm">Unverified</span>
              )}
            </div>
            <Button onClick={removeDomain} disabled={pending} variant="ghost" size="sm">
              Remove
            </Button>
          </div>

          {!current.verified && current.txtHost && (
            <div className="studio-subsection studio-mt-sm">
              <p className="studio-text-strong-sm studio-mb-sm">DNS verification required</p>
              <p className="studio-text-muted-sm">
                Add this TXT record to your DNS, then click Verify:
              </p>
              <p className="studio-text-muted-sm studio-mt-sm">
                Host: <code>{current.txtHost}</code>
              </p>
              <p className="studio-text-muted-sm">
                Value: <code>{current.txtRecord}</code>
              </p>
              <Button
                onClick={verifyDomain}
                disabled={pending}
                variant="primary"
                size="sm"
                className="studio-mt-sm"
              >
                <ButtonIcon name="check" />
                {pending ? 'Checking DNS…' : 'Verify domain'}
              </Button>
            </div>
          )}
        </div>
      )}
    </Panel>
  )
}
