// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Panel } from '@tahti/ui'
import { disconnectMixcloud } from './mixcloud-actions'

export function MixcloudConnect({
  initial,
  apiUrl,
}: {
  initial: { connected: boolean; configured: boolean }
  apiUrl: string
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const flash = searchParams.get('mixcloud')
  const [connected, setConnected] = useState(initial.connected)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function disconnect() {
    if (!confirm("Disconnect Mixcloud? You'll need to reconnect to upload mixes again.")) return
    setError(null)
    startTransition(async () => {
      const res = await disconnectMixcloud()
      if (res.error) {
        setError(res.error)
        return
      }
      setConnected(false)
      router.refresh()
    })
  }

  if (!initial.configured) {
    return (
      <Panel title="Mixcloud (M7)" headerTight>
        <div className="import-connect">
          <p className="import-connect__note import-connect__note--muted">
            Mixcloud import needs a platform API key that hasn&apos;t been set up yet.
          </p>
          <a href="/admin/settings/vendors" className="ui-btn ui-btn--secondary ui-btn--sm">
            Configure
          </a>
        </div>
      </Panel>
    )
  }

  return (
    <Panel title="Mixcloud (M7)" headerTight>
      {flash === 'connected' && <p className="studio-text-success">Mixcloud account connected.</p>}
      {flash === 'error' && (
        <p className="studio-text-error">Mixcloud connection failed. Try again.</p>
      )}
      {flash === 'login' && (
        <p className="studio-text-error">Log in to Tahti before connecting Mixcloud.</p>
      )}
      <p className="studio-text-muted-sm studio-m-0 studio-mb-sm">
        Connect once, then upload READY archive mixes to Mixcloud from the archive editor.
      </p>
      {connected ? (
        <div className="studio-row">
          <span className="studio-text-success">Connected</span>
          <button
            type="button"
            onClick={disconnect}
            disabled={isPending}
            className="studio-text-sm"
          >
            {isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      ) : (
        <a
          href={`${apiUrl}/api/me/mixcloud/oauth/start`}
          className="ui-btn ui-btn--ghost ui-btn--sm studio-link-cta"
        >
          Connect Mixcloud →
        </a>
      )}
      {error && <p className="studio-text-error studio-mt-sm studio-m-0">{error}</p>}
    </Panel>
  )
}
