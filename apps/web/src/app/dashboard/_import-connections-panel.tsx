// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import NextLink from 'next/link'
import { Panel, StatusPill } from '@tahti/ui'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

type ConnectionRow = {
  id: 'google-drive' | 'bandcamp' | 'soundcloud'
  label: string
  connected: boolean
  configured: boolean
  importHref: string
  disconnectPath: string
}

export function ImportConnectionsPanel({ connections }: { connections: ConnectionRow[] }) {
  const [busy, setBusy] = useState<string | null>(null)

  const visible = connections.filter((c) => c.configured || c.connected)
  if (visible.length === 0) return null

  const disconnect = async (path: string) => {
    setBusy(path)
    await fetch(`${apiUrl}${path}`, { method: 'DELETE', credentials: 'include' })
    window.location.reload()
  }

  return (
    <Panel
      title="Import connections"
      description="Cloud and platform accounts used to pull audio into your archive."
    >
      <ul className="import-connections">
        {visible.map((row) => (
          <li key={row.id} className="import-connections__row">
            <div className="import-connections__info">
              <span className="import-connections__label">{row.label}</span>
              <StatusPill tone={row.connected ? 'green' : 'cyan'}>
                {row.connected ? 'Connected' : 'Not connected'}
              </StatusPill>
            </div>
            <div className="import-connections__actions">
              <NextLink href={row.importHref} className="studio-btn-ghost studio-btn-sm">
                Import →
              </NextLink>
              {row.connected ? (
                <button
                  type="button"
                  className="ui-btn ui-btn--ghost ui-btn--sm"
                  disabled={busy === row.disconnectPath}
                  onClick={() => void disconnect(row.disconnectPath)}
                >
                  {busy === row.disconnectPath ? 'Disconnecting…' : 'Disconnect'}
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </Panel>
  )
}
