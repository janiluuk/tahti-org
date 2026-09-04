// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Button, Input, Panel, StatusPill } from '@tahti/ui'
import { INTEGRATION_PROVIDERS, type IntegrationField, type IntegrationScope } from '@tahti/shared'
import type { IntegrationView } from '@/lib/integrations-client'
import { installIntegration, removeIntegration } from './integrations-actions'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.NEXT_PUBLIC_API_BASE ?? ''

const SCOPE_SECTIONS: Array<{ scope: IntegrationScope; title: string }> = [
  { scope: 'IMPORT', title: 'Import sources' },
  { scope: 'EXPORT', title: 'Export' },
  { scope: 'FINGERPRINT', title: 'Fingerprinting' },
  { scope: 'SCROBBLE', title: 'Scrobbling' },
]

export interface IntegrationsPanelProps {
  initial: IntegrationView[]
}

function CredentialForm({
  fields,
  pending,
  signupUrl,
  signupLabel,
  submitLabel = 'Save',
  onSubmit,
  onCancel,
}: {
  fields: IntegrationField[]
  pending: boolean
  signupUrl?: string
  signupLabel?: string
  submitLabel?: string
  onSubmit: (values: Record<string, string>) => void
  onCancel: () => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const allFilled = fields.every((f) => values[f.key]?.trim())

  return (
    <div
      className="ui-panel studio-mt-sm"
      style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
    >
      {signupUrl && (
        <a
          href={signupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="studio-text-muted-sm"
        >
          {signupLabel ?? "Don't have an account? Sign up →"}
        </a>
      )}
      {fields.map((f) => (
        <label key={f.key} className="studio-field">
          <span className="studio-label">{f.label}</span>
          <Input
            type={f.secret ? 'password' : 'text'}
            value={values[f.key] ?? ''}
            onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
            disabled={pending}
            autoComplete="off"
          />
        </label>
      ))}
      <div className="studio-row studio-mt-sm" style={{ gap: '0.5rem' }}>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={pending || !allFilled}
          onClick={() => onSubmit(values)}
        >
          {pending ? 'Saving…' : submitLabel}
        </Button>
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  )
}

function LastFmConnectModal({
  fields,
  signupUrl,
  signupLabel,
  pending,
  error,
  onSubmit,
  onClose,
}: {
  fields: IntegrationField[]
  signupUrl?: string
  signupLabel?: string
  pending: boolean
  error: string | null
  onSubmit: (values: Record<string, string>) => void
  onClose: () => void
}) {
  return (
    <div
      className="spotify-import-modal__overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !pending) onClose()
      }}
    >
      <div
        className="spotify-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lastfm-connect-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="spotify-import-modal__header">
          <div>
            <h2 id="lastfm-connect-title" className="spotify-import-modal__title">
              Connect Last.fm
            </h2>
            <p className="spotify-import-modal__subline">
              Paste the API key and shared secret from your Last.fm API account, then approve Tahti
              on Last.fm.
            </p>
          </div>
          <button
            type="button"
            className="spotify-import-modal__close"
            aria-label="Close"
            disabled={pending}
            onClick={onClose}
          >
            ×
          </button>
        </div>
        {error && <p className="studio-notice studio-notice--error">{error}</p>}
        <CredentialForm
          fields={fields}
          pending={pending}
          signupUrl={signupUrl}
          signupLabel={signupLabel}
          submitLabel="Continue to Last.fm"
          onSubmit={onSubmit}
          onCancel={onClose}
        />
      </div>
    </div>
  )
}

export function IntegrationsPanel({ initial }: IntegrationsPanelProps) {
  const [integrations, setIntegrations] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const [configuringSlug, setConfiguringSlug] = useState<string | null>(null)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null)
  const [lastFmOpen, setLastFmOpen] = useState(false)
  const [lastFmError, setLastFmError] = useState<string | null>(null)

  function patch(slug: string, changes: Partial<IntegrationView>) {
    setIntegrations((prev) => prev.map((i) => (i.slug === slug ? { ...i, ...changes } : i)))
  }

  async function handleInstall(slug: string, fields: Record<string, string>) {
    setError(null)
    setPendingSlug(slug)
    const result = await installIntegration(slug, fields)
    setPendingSlug(null)
    if (result.error) {
      setError(result.error)
      return
    }
    setConfiguringSlug(null)
    patch(slug, { installed: true })
  }

  async function handleRemove(slug: string) {
    setError(null)
    setPendingSlug(slug)
    const result = await removeIntegration(slug)
    setPendingSlug(null)
    if (result.error) {
      setError(result.error)
      return
    }
    patch(slug, { installed: false })
  }

  async function handleLastFmPrepare(fields: Record<string, string>) {
    setLastFmError(null)
    setPendingSlug('lastfm')
    try {
      const returnTo =
        typeof window !== 'undefined'
          ? `${window.location.origin}/dashboard/settings?tab=integrations`
          : undefined
      const res = await fetch(`${apiUrl}/api/me/integrations/lastfm/prepare`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apiKey: fields.apiKey,
          apiSecret: fields.apiSecret,
          returnTo,
        }),
      })
      const body = (await res.json().catch(() => ({}))) as { error?: string; authUrl?: string }
      if (!res.ok || !body.authUrl) {
        setLastFmError(body.error ?? 'Could not start Last.fm authorization')
        setPendingSlug(null)
        return
      }
      window.location.href = body.authUrl
    } catch {
      setLastFmError('Could not reach the API')
      setPendingSlug(null)
    }
  }

  const lastFmProvider = INTEGRATION_PROVIDERS.find((p) => p.slug === 'lastfm')

  return (
    <Panel
      title="Integrations"
      description="Import sources, an export destination, and fingerprinting providers — install the ones you want, with your own API key where one's needed."
    >
      {error && <p className="studio-notice studio-notice--error studio-mb-sm">{error}</p>}

      {SCOPE_SECTIONS.map(({ scope, title }) => {
        const rows = integrations.filter((i) => i.scope === scope)
        if (rows.length === 0) return null

        return (
          <div key={scope} className="studio-mt-lg">
            <h3>{title}</h3>
            <div
              className="studio-mt-sm"
              style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
            >
              {rows.map((row) => {
                const provider = INTEGRATION_PROVIDERS.find((p) => p.slug === row.slug)
                const fields = provider?.fields ?? []
                const isPending = pendingSlug === row.slug
                const isConfiguring = configuringSlug === row.slug
                const isLastFm = row.slug === 'lastfm'

                return (
                  <div key={row.slug} className="ui-panel">
                    <div className="studio-row" style={{ justifyContent: 'space-between' }}>
                      <div>
                        <div className="studio-row studio-row--wrap studio-gap-xs">
                          <strong>{row.name}</strong>
                          <StatusPill tone={row.installed || row.connected ? 'green' : 'cyan'}>
                            {row.authKind === 'OAUTH'
                              ? row.connected
                                ? 'Connected'
                                : 'Not connected'
                              : row.installed
                                ? 'Installed'
                                : 'Not installed'}
                          </StatusPill>
                        </div>
                        <p className="studio-text-muted-sm studio-mt-xs">{row.description}</p>
                      </div>

                      {row.authKind === 'OAUTH' ? (
                        row.connected ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={isPending}
                            onClick={() => {
                              if (!confirm(`Disconnect ${row.name}?`)) return
                              const path = provider?.oauthConnectPath?.replace(
                                /\/oauth\/start$/,
                                '',
                              )
                              if (!path) return
                              setPendingSlug(row.slug)
                              fetch(`${apiUrl}${path}`, {
                                method: 'DELETE',
                                credentials: 'include',
                              }).then(() => window.location.reload())
                            }}
                          >
                            {isPending ? 'Disconnecting…' : 'Disconnect'}
                          </Button>
                        ) : isLastFm ? (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={isPending}
                            onClick={() => {
                              setLastFmError(null)
                              setLastFmOpen(true)
                            }}
                          >
                            Connect
                          </Button>
                        ) : (
                          <a
                            href={`${apiUrl}${provider?.oauthConnectPath ?? ''}`}
                            className="ui-btn ui-btn--sm ui-btn--secondary"
                          >
                            Connect
                          </a>
                        )
                      ) : fields.length === 0 ? (
                        <Button
                          type="button"
                          variant={row.installed ? 'ghost' : 'secondary'}
                          size="sm"
                          disabled={isPending}
                          onClick={() =>
                            row.installed
                              ? void handleRemove(row.slug)
                              : void handleInstall(row.slug, {})
                          }
                        >
                          {isPending ? 'Saving…' : row.installed ? 'Disable' : 'Enable'}
                        </Button>
                      ) : (
                        <div className="studio-row" style={{ gap: '0.5rem' }}>
                          {row.installed && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isPending}
                              onClick={() => void handleRemove(row.slug)}
                            >
                              Remove
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            disabled={isPending}
                            onClick={() => setConfiguringSlug(isConfiguring ? null : row.slug)}
                          >
                            {row.installed ? 'Reconfigure' : 'Configure'}
                          </Button>
                        </div>
                      )}
                    </div>

                    {isConfiguring && fields.length > 0 && (
                      <CredentialForm
                        fields={fields}
                        pending={isPending}
                        signupUrl={provider?.signupUrl}
                        signupLabel={provider?.signupLabel}
                        onSubmit={(values) => void handleInstall(row.slug, values)}
                        onCancel={() => setConfiguringSlug(null)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {lastFmOpen && lastFmProvider && (
        <LastFmConnectModal
          fields={lastFmProvider.fields ?? []}
          signupUrl={lastFmProvider.signupUrl}
          signupLabel={lastFmProvider.signupLabel}
          pending={pendingSlug === 'lastfm'}
          error={lastFmError}
          onSubmit={(values) => void handleLastFmPrepare(values)}
          onClose={() => {
            if (pendingSlug === 'lastfm') return
            setLastFmOpen(false)
            setLastFmError(null)
          }}
        />
      )}
    </Panel>
  )
}
