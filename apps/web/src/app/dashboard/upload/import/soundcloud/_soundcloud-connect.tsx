// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'

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
      <div className="import-connect-box import-connect-box--unconfigured">
        <p className="import-connect-box__note">
          SoundCloud import is not yet available in this environment.
        </p>
      </div>
    )
  }

  if (flash === 'error') {
    return (
      <div className="import-connect-box import-connect-box--error">
        <p className="import-connect-box__note">
          SoundCloud authorisation failed — please try again.
        </p>
        <a href={`${apiUrl}/api/me/soundcloud/oauth/start`} className="studio-btn-primary">
          Retry connection
        </a>
      </div>
    )
  }

  if (connected) {
    return (
      <div className="import-connect-box import-connect-box--connected">
        <span className="import-connect-box__status">● Connected to SoundCloud</span>
        <button
          type="button"
          className="studio-btn-ghost import-connect-box__disconnect"
          onClick={() => void handleDisconnect()}
          disabled={disconnecting}
        >
          {disconnecting ? 'Disconnecting…' : 'Disconnect'}
        </button>
      </div>
    )
  }

  return (
    <div className="import-connect-box">
      <p className="import-connect-box__note">
        You&apos;ll be redirected to SoundCloud to authorise Tahti. We only request read access to
        your tracks.
      </p>
      <a
        href={`${apiUrl}/api/me/soundcloud/oauth/start`}
        className="studio-btn-primary import-connect-box__btn"
      >
        Connect SoundCloud account
      </a>
    </div>
  )
}
