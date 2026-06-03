// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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
      <p style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.5rem' }}>
        Mixcloud OAuth is not configured on this server (set MIXCLOUD_CLIENT_ID).
      </p>
    )
  }

  return (
    <div
      style={{
        marginTop: '1rem',
        padding: '0.75rem 1rem',
        border: '1px solid #eee',
        borderRadius: 8,
        maxWidth: 520,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Mixcloud (M7)</div>
      {flash === 'connected' && (
        <p style={{ color: '#166534', fontSize: '0.9rem' }}>Mixcloud account connected.</p>
      )}
      {flash === 'error' && (
        <p style={{ color: '#b91c1c', fontSize: '0.9rem' }}>
          Mixcloud connection failed. Try again.
        </p>
      )}
      {flash === 'login' && (
        <p style={{ color: '#b91c1c', fontSize: '0.9rem' }}>
          Log in to Tahti before connecting Mixcloud.
        </p>
      )}
      <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 0.5rem' }}>
        Connect once, then upload READY archive mixes to Mixcloud from the archive editor.
      </p>
      {connected ? (
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: '#166534' }}>Connected</span>
          <button
            type="button"
            onClick={disconnect}
            disabled={isPending}
            style={{ fontSize: '0.9rem' }}
          >
            {isPending ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      ) : (
        <a
          href={`${apiUrl}/api/me/mixcloud/oauth/start`}
          style={{
            display: 'inline-block',
            fontSize: '0.9rem',
            padding: '0.35rem 0.75rem',
            border: '1px solid #ccc',
            borderRadius: 4,
            textDecoration: 'none',
            color: 'inherit',
          }}
        >
          Connect Mixcloud →
        </a>
      )}
      {error && (
        <p style={{ color: '#b91c1c', fontSize: '0.9rem', marginTop: '0.35rem' }}>{error}</p>
      )}
    </div>
  )
}
