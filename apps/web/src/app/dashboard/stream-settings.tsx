// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button, CopyRow, Panel, Stack, StudioTabs } from '@tahti/ui'

interface StreamSettings {
  rtmp: { server: string; streamKey: string; fallbackServers?: string[] }
  icecast: { server: string; mount: string; password: string; fallbackServers?: string[] }
  hlsUrl: string
}

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

export default function StreamSettingsPanel({
  initial,
  isLive = false,
}: {
  initial: StreamSettings
  isLive?: boolean
}) {
  const [settings, setSettings] = useState(initial)
  const [rotating, setRotating] = useState<'rtmp' | 'icecast' | null>(null)

  async function rotateKey(type: 'rtmp' | 'icecast') {
    setRotating(type)
    try {
      const res = await fetch(`${API_BASE}/api/me/stream-settings/${type}/rotate`, {
        method: 'POST',
        credentials: 'include',
      })
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
    <Panel
      title="Your stream credentials"
      description="Pick the tool you're broadcasting from — only that tool's settings show below."
    >
      <StudioTabs defaultTab="rtmp">
        <StudioTabs.List aria-label="Broadcasting tool">
          <StudioTabs.Trigger value="rtmp">OBS / Streamlabs</StudioTabs.Trigger>
          <StudioTabs.Trigger value="icecast">Mixxx / Traktor / butt</StudioTabs.Trigger>
        </StudioTabs.List>

        <StudioTabs.Panel value="rtmp">
          <Stack gap={3}>
            <CopyRow label="Server" value={settings.rtmp.server} />
            {settings.rtmp.fallbackServers?.map((server) => (
              <CopyRow key={server} label="Fallback server" value={server} />
            ))}
            <CopyRow label="Stream Key" value={settings.rtmp.streamKey} secret />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => rotateKey('rtmp')}
              disabled={rotating === 'rtmp'}
              className="studio-mt-sm"
            >
              {rotating === 'rtmp' ? 'Rotating…' : 'Rotate RTMP key'}
            </Button>
            {isLive && (
              <p className="studio-text-sm studio-text-muted studio-m-0 studio-mt-sm">
                While live, the previous RTMP key stays valid for 24 hours so OBS can keep
                streaming.
              </p>
            )}
          </Stack>
        </StudioTabs.Panel>

        <StudioTabs.Panel value="icecast">
          <Stack gap={3}>
            <CopyRow label="Server" value={settings.icecast.server} />
            {settings.icecast.fallbackServers?.map((server) => (
              <CopyRow key={server} label="Fallback server" value={server} />
            ))}
            <CopyRow label="Mount" value={settings.icecast.mount} />
            <CopyRow label="Password" value={settings.icecast.password} secret />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => rotateKey('icecast')}
              disabled={rotating === 'icecast'}
              className="studio-mt-sm"
            >
              {rotating === 'icecast' ? 'Rotating…' : 'Rotate Icecast password'}
            </Button>
            {isLive && (
              <p className="studio-text-sm studio-text-muted studio-m-0 studio-mt-sm">
                While live, the previous Icecast password stays valid for 24 hours.
              </p>
            )}
          </Stack>
        </StudioTabs.Panel>
      </StudioTabs>

      <p className="studio-text-sm studio-m-0 studio-mt-md">
        <Link href="/help/broadcast">Broadcasting guide for your tool</Link>
      </p>
    </Panel>
  )
}
