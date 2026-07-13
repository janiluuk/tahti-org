'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import { ButtonIcon, Button, Panel } from '@tahti/ui'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

interface SetupData {
  secret: string
  otpauthUri: string
}

function formatSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim()
}

export function TwoFactorPanel() {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [setupData, setSetupData] = useState<SetupData | null>(null)
  const [confirmCode, setConfirmCode] = useState('')
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null)
  const [disabling, setDisabling] = useState(false)
  const [disablePassword, setDisablePassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`${API_BASE}/api/me/totp/status`, { credentials: 'include' })
      .then((res) => (res.ok ? (res.json() as Promise<{ enabled: boolean }>) : null))
      .then((data) => {
        if (!cancelled && data) setEnabled(data.enabled)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  async function startSetup() {
    setError(null)
    setPending(true)
    try {
      const res = await fetch(`${API_BASE}/api/me/totp/setup`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) throw new Error()
      setSetupData((await res.json()) as SetupData)
    } catch {
      setError('Could not start 2FA setup. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function confirmSetup() {
    if (!confirmCode.trim()) return
    setError(null)
    setPending(true)
    try {
      const res = await fetch(`${API_BASE}/api/me/totp/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code: confirmCode.trim() }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        backupCodes?: string[]
        error?: string
      }
      if (!res.ok) {
        setError(data.error ?? 'Invalid code')
        return
      }
      setBackupCodes(data.backupCodes ?? [])
      setSetupData(null)
      setConfirmCode('')
      setEnabled(true)
    } catch {
      setError('Could not confirm 2FA. Try again.')
    } finally {
      setPending(false)
    }
  }

  async function disable() {
    if (!disablePassword) return
    setError(null)
    setPending(true)
    try {
      const res = await fetch(`${API_BASE}/api/me/totp/disable`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: disablePassword }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string }
        setError(data.error ?? 'Incorrect password')
        return
      }
      setEnabled(false)
      setDisabling(false)
      setDisablePassword('')
    } catch {
      setError('Could not disable 2FA. Try again.')
    } finally {
      setPending(false)
    }
  }

  if (enabled === null) return null

  return (
    <Panel
      title="Two-factor authentication"
      description="Add a second step at login using an authenticator app. Recommended setting: on."
    >
      {error && <p className="studio-notice studio-notice--error studio-mb-sm">{error}</p>}

      {backupCodes && (
        <div className="studio-notice studio-notice--info studio-mb-md">
          <p className="studio-text-sm">
            <strong>Save these backup codes now</strong> — each one lets you sign in once if you
            lose access to your authenticator app. They won&apos;t be shown again.
          </p>
          <ul className="studio-mt-sm" style={{ fontFamily: 'monospace', lineHeight: 1.8 }}>
            {backupCodes.map((code) => (
              <li key={code}>{code}</li>
            ))}
          </ul>
          <Button variant="secondary" size="sm" onClick={() => setBackupCodes(null)}>
            I&apos;ve saved these
          </Button>
        </div>
      )}

      {enabled && !backupCodes && (
        <>
          <p className="studio-text-sm">
            <span className="studio-badge studio-badge--success">On</span> Two-factor authentication
            is protecting your account.
          </p>
          {!disabling ? (
            <Button
              variant="ghost"
              size="sm"
              className="studio-text-error studio-mt-sm"
              onClick={() => setDisabling(true)}
            >
              Disable 2FA
            </Button>
          ) : (
            <div className="studio-mt-sm">
              <label className="studio-field">
                <span className="studio-label">Confirm your password to disable</span>
                <input
                  type="password"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  className="studio-input"
                  autoComplete="current-password"
                />
              </label>
              <div className="studio-row studio-mt-sm">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => void disable()}
                  disabled={pending}
                >
                  {pending ? 'Disabling…' : 'Confirm disable'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDisabling(false)
                    setDisablePassword('')
                    setError(null)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {!enabled && !setupData && !backupCodes && (
        <>
          <p className="studio-text-muted-sm">
            Two-factor authentication is currently off. Turning it on means signing in requires both
            your password and a code from an authenticator app on your phone — we recommend it for
            every account.
          </p>
          <Button
            variant="primary"
            size="sm"
            className="studio-mt-sm"
            onClick={() => void startSetup()}
            disabled={pending}
          >
            <ButtonIcon name="check" />
            {pending ? 'Starting…' : 'Enable 2FA'}
          </Button>
        </>
      )}

      {setupData && (
        <div>
          <ol className="studio-text-sm" style={{ paddingLeft: '1.25rem' }}>
            <li>Install an authenticator app (Google Authenticator, Authy, 1Password, etc.)</li>
            <li>
              Add a new account using the setup key below, or paste this link if your app supports
              it:
            </li>
          </ol>
          <p className="studio-mt-sm" style={{ fontFamily: 'monospace', fontSize: '1.1rem' }}>
            {formatSecret(setupData.secret)}
          </p>
          <p className="studio-text-muted-sm studio-mt-xs" style={{ wordBreak: 'break-all' }}>
            {setupData.otpauthUri}
          </p>
          <label className="studio-field studio-mt-sm">
            <span className="studio-label">Enter the 6-digit code from your app</span>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={confirmCode}
              onChange={(e) => setConfirmCode(e.target.value)}
              className="studio-input"
              autoComplete="one-time-code"
            />
          </label>
          <div className="studio-row studio-mt-sm">
            <Button
              variant="primary"
              size="sm"
              onClick={() => void confirmSetup()}
              disabled={pending}
            >
              {pending ? 'Confirming…' : 'Confirm and enable'}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSetupData(null)
                setConfirmCode('')
                setError(null)
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Panel>
  )
}
