// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { ButtonIcon, StatusPill, Button } from '@tahti/ui'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

export function GoogleDriveConnectPanel({
  connected,
  configured,
  flash,
  onConnected,
}: {
  connected: boolean
  configured: boolean
  flash?: string
  onConnected?: () => void
}) {
  const [disconnecting, setDisconnecting] = useState(false)

  const handleDisconnect = async () => {
    setDisconnecting(true)
    await fetch(`${apiUrl}/api/me/google-drive`, { method: 'DELETE', credentials: 'include' })
    window.location.reload()
  }

  if (!configured) {
    return (
      <div className="import-connect">
        <p className="import-connect__note import-connect__note--muted">
          Google Drive import is not yet available in this environment.
        </p>
      </div>
    )
  }

  if (flash === 'error') {
    return (
      <div className="import-connect import-connect--error">
        <p className="import-connect__note">
          Google authorisation failed. Try connecting again — Tahti only requests access to files
          you pick for import.
        </p>
        <a href={`${apiUrl}/api/me/google-drive/oauth/start`} className="ui-btn ui-btn--primary">
          <ButtonIcon name="refresh" />
          Retry connection
        </a>
      </div>
    )
  }

  if (connected) {
    return (
      <div className="import-connect import-connect--connected">
        <StatusPill tone="green">Connected to Google Drive</StatusPill>
        <Button
          onClick={() => void handleDisconnect()}
          disabled={disconnecting}
          variant="ghost"
          size="sm"
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </Button>
        {onConnected ? (
          <Button onClick={onConnected} variant="primary">
            <ButtonIcon name="import" />
            Choose files from Drive
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <div className="import-connect">
      <p className="import-connect__note">
        You&apos;ll sign in with Google and pick audio files from your Drive. Tahti uses the{' '}
        <code>drive.file</code> scope — we only see files you explicitly select, not your whole
        drive.
      </p>
      <a href={`${apiUrl}/api/me/google-drive/oauth/start`} className="ui-btn ui-btn--primary">
        <ButtonIcon name="link" />
        Connect Google Drive
      </a>
    </div>
  )
}
