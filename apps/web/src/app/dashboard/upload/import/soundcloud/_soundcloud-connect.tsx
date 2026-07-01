// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { ButtonIcon, StatusPill, Button } from '@tahti/ui'

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? ''

export function SoundCloudConnectPanel({
  connected,
  configured,
  flash,
}: {
  connected: boolean
  configured: boolean
  flash?: string
}) {
  const [disconnecting, setDisconnecting] = useState(false)

  const handleDisconnect = async () => {
    setDisconnecting(true)
    await fetch(`${apiUrl}/api/me/soundcloud`, { method: 'DELETE', credentials: 'include' })
    window.location.reload()
  }

  if (!configured) {
    return (
      <div className="import-connect">
        <p className="import-connect__note import-connect__note--muted">
          SoundCloud import is not yet available in this environment.
        </p>
      </div>
    )
  }

  if (flash === 'error') {
    return (
      <div className="import-connect import-connect--error">
        <p className="import-connect__note">
          SoundCloud authorisation failed. Try connecting again — Tahti only requests read access to
          your tracks.
        </p>
        <a href={`${apiUrl}/api/me/soundcloud/oauth/start`} className="ui-btn ui-btn--primary">
          <ButtonIcon name="refresh" />
          Retry connection
        </a>
      </div>
    )
  }

  if (connected) {
    return (
      <div className="import-connect import-connect--connected">
        <StatusPill tone="green">Connected to SoundCloud</StatusPill>
        <Button
          onClick={() => void handleDisconnect()}
          disabled={disconnecting}
          variant="ghost"
          size="sm"
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </Button>
      </div>
    )
  }

  return (
    <div className="import-connect">
      <p className="import-connect__note">
        You&apos;ll be redirected to SoundCloud to authorise Tahti. We only request read access to
        your tracks.
      </p>
      <a href={`${apiUrl}/api/me/soundcloud/oauth/start`} className="ui-btn ui-btn--primary">
        <ButtonIcon name="link" />
        Connect SoundCloud account
      </a>
    </div>
  )
}
