// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import { Button, CopyRow, Heading, Panel, Stack } from '@/components/ui'

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
    <Panel title="Go Live">
      <Stack gap={6}>
        <div>
          <Heading level={3}>OBS / Streamlabs (RTMP)</Heading>
          <CopyRow label="Server" value={settings.rtmp.server} />
          <CopyRow label="Stream Key" value={settings.rtmp.streamKey} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => rotateKey('rtmp')}
            disabled={rotating === 'rtmp'}
            style={{ marginTop: '0.5rem' }}
          >
            {rotating === 'rtmp' ? 'Rotating…' : 'Rotate RTMP key'}
          </Button>
        </div>

        <div>
          <Heading level={3}>Mixxx / Traktor / butt (Icecast)</Heading>
          <CopyRow label="Server" value={settings.icecast.server} />
          <CopyRow label="Mount" value={settings.icecast.mount} />
          <CopyRow label="Password" value={settings.icecast.password} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => rotateKey('icecast')}
            disabled={rotating === 'icecast'}
            style={{ marginTop: '0.5rem' }}
          >
            {rotating === 'icecast' ? 'Rotating…' : 'Rotate Icecast password'}
          </Button>
        </div>

        <div>
          <Heading level={3}>HLS stream URL</Heading>
          <CopyRow label="URL" value={settings.hlsUrl} />
        </div>
      </Stack>
    </Panel>
  )
}
