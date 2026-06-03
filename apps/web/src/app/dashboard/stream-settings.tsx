// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'

interface StreamSettings {
  rtmp: { server: string; streamKey: string }
  icecast: { server: string; mount: string; password: string }
  hlsUrl: string
}

export default function StreamSettingsPanel({ initial }: { initial: StreamSettings }) {
  const [settings, setSettings] = useState(initial)
  const [rotating, setRotating] = useState<'rtmp' | 'icecast' | null>(null)

  async function rotateKey(type: 'rtmp' | 'icecast') {
    setRotating(type)
    try {
      const res = await fetch(`/api/me/stream-settings/${type}/rotate`, { method: 'POST' })
      if (!res.ok) throw new Error('Rotate failed')
      const data = (await res.json()) as { rtmpStreamKey?: string; liveSourcePass?: string }
      setSettings((prev) => ({
        ...prev,
        rtmp:
          type === 'rtmp'
            ? { ...prev.rtmp, streamKey: data.rtmpStreamKey ?? prev.rtmp.streamKey }
            : prev.rtmp,
        icecast:
          type === 'icecast'
            ? { ...prev.icecast, password: data.liveSourcePass ?? prev.icecast.password }
            : prev.icecast,
      }))
    } finally {
      setRotating(null)
    }
  }

  return (
    <div
      style={{ marginTop: '2rem', padding: '1.5rem', border: '1px solid #eee', borderRadius: 8 }}
    >
      <h2 style={{ margin: '0 0 1.25rem' }}>Go Live</h2>

      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>OBS / Streamlabs (RTMP)</h3>
        <Row label="Server" value={settings.rtmp.server} />
        <Row label="Stream Key" value={settings.rtmp.streamKey} />
        <RotateButton
          label="Rotate RTMP key"
          loading={rotating === 'rtmp'}
          onClick={() => rotateKey('rtmp')}
        />
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Mixxx / Traktor / butt (Icecast)</h3>
        <Row label="Server" value={settings.icecast.server} />
        <Row label="Mount" value={settings.icecast.mount} />
        <Row label="Password" value={settings.icecast.password} />
        <RotateButton
          label="Rotate Icecast password"
          loading={rotating === 'icecast'}
          onClick={() => rotateKey('icecast')}
        />
      </div>

      <div>
        <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>HLS stream URL</h3>
        <Row label="URL" value={settings.hlsUrl} />
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
      <span style={{ minWidth: 100, color: '#666', fontSize: '0.85rem' }}>{label}</span>
      <code
        style={{
          flex: 1,
          background: '#f5f5f5',
          padding: '0.25rem 0.5rem',
          borderRadius: 4,
          fontSize: '0.8rem',
          overflowX: 'auto',
        }}
      >
        {value}
      </code>
      <button
        onClick={copy}
        style={{
          padding: '0.2rem 0.6rem',
          fontSize: '0.75rem',
          cursor: 'pointer',
          border: '1px solid #ccc',
          borderRadius: 4,
          background: 'none',
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  )
}

function RotateButton({
  label,
  loading,
  onClick,
}: {
  label: string
  loading: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        marginTop: '0.5rem',
        padding: '0.3rem 0.8rem',
        fontSize: '0.8rem',
        cursor: loading ? 'not-allowed' : 'pointer',
        border: '1px solid #ccc',
        borderRadius: 4,
        background: 'none',
        opacity: loading ? 0.6 : 1,
      }}
    >
      {loading ? 'Rotating…' : label}
    </button>
  )
}
