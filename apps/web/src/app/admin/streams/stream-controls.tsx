// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState } from 'react'
import {
  forceChannelOffline,
  pauseLiveStream,
  restartLiveStream,
  resumeLiveStream,
  skipLiveStreamTrack,
} from '../actions'

type StreamAction = 'restart' | 'skip' | 'pause' | 'resume' | 'force-offline'

export function StreamControls({ slug, hlsUrl }: { slug: string; hlsUrl: string | null }) {
  const [pending, setPending] = useState<StreamAction | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  async function run(
    action: StreamAction,
    confirm: string | null,
    fn: () => Promise<{ error: string | null }>,
    reload = false,
  ) {
    if (confirm && !window.confirm(confirm)) return
    setPending(action)
    setMsg(null)
    const { error } = await fn()
    setPending(null)
    if (error) {
      setMsg(error)
      return
    }
    if (reload) window.location.reload()
  }

  const busy = pending !== null

  return (
    <div className="admin-stream-controls">
      <div className="admin-stream-controls__row">
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          disabled={busy}
          onClick={() =>
            void run(
              'restart',
              `Restart Liquidsoap for ${slug}? The channel stays LIVE; listeners may briefly reconnect.`,
              () => restartLiveStream(slug),
            )
          }
        >
          {pending === 'restart' ? 'Restarting…' : 'Restart'}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          disabled={busy}
          onClick={() => void run('skip', null, () => skipLiveStreamTrack(slug))}
        >
          {pending === 'skip' ? 'Skipping…' : 'Skip'}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          disabled={busy}
          onClick={() => void run('pause', null, () => pauseLiveStream(slug))}
        >
          {pending === 'pause' ? 'Pausing…' : 'Pause'}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--sm"
          disabled={busy}
          onClick={() => void run('resume', null, () => resumeLiveStream(slug))}
        >
          {pending === 'resume' ? 'Resuming…' : 'Resume'}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--danger admin-btn--sm"
          disabled={busy}
          onClick={() =>
            void run(
              'force-offline',
              `Force ${slug} offline? This ends the broadcast immediately.`,
              () => forceChannelOffline(slug),
              true,
            )
          }
        >
          {pending === 'force-offline' ? 'Stopping…' : 'Force offline'}
        </button>
      </div>
      {hlsUrl ? (
        <a className="admin-stream-controls__hls" href={hlsUrl} target="_blank" rel="noreferrer">
          HLS playlist
        </a>
      ) : null}
      {msg ? <span className="admin-err">{msg}</span> : null}
    </div>
  )
}
