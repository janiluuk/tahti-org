// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePlayer } from '@/contexts/player-context'
import { useJamGuestPlayback, useJamHostSync, useJamState } from '@/hooks/use-jam'
import { endJam, joinJam, leaveJam } from '@/lib/jam-client'
import '@/components/jam.css'

function initial(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || '?'
}

export function JamView({ code, userId }: { code: string; userId: string }) {
  const router = useRouter()
  const player = usePlayer()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [joinError, setJoinError] = useState<string | null>(null)
  const [audioUnlocked, setAudioUnlocked] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    void joinJam(code)
      .then((session) => {
        if (!cancelled) setSessionId(session.id)
      })
      .catch(() => {
        if (!cancelled) setJoinError('This Jam link is invalid or has ended.')
      })
    return () => {
      cancelled = true
    }
  }, [code])

  const { session, connectionStatus, ended } = useJamState(sessionId)
  const isHost = Boolean(session && session.hostUserId === userId)

  useJamHostSync(sessionId, isHost && !ended, player)
  useJamGuestPlayback(session, !isHost && audioUnlocked && !ended, player)

  async function leave() {
    if (sessionId) await leaveJam(sessionId).catch(() => {})
    router.push('/')
  }

  async function endForEveryone() {
    if (sessionId) await endJam(sessionId).catch(() => {})
    router.push('/')
  }

  function copyLink() {
    if (!session) return
    void navigator.clipboard.writeText(`${window.location.origin}/jam/${session.code}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (joinError) {
    return (
      <div className="jam-status-page">
        <p className="jam-status-page__title">Jam not found</p>
        <p>{joinError}</p>
      </div>
    )
  }

  if (ended) {
    return (
      <div className="jam-status-page">
        <p className="jam-status-page__title">This Jam has ended</p>
        <p>The host closed the session.</p>
      </div>
    )
  }

  if (!session || connectionStatus === 'connecting') {
    return (
      <div className="jam-status-page">
        <p className="jam-status-page__title">Joining the Jam…</p>
        <p>Syncing with the host</p>
      </div>
    )
  }

  const track = session.currentTrack

  return (
    <div className="jam-page">
      <div className="jam-panel jam-panel--row">
        <div className="jam-panel--row" style={{ gap: '0.5rem' }}>
          <h1 className="jam-title">Tahti Jam</h1>
          <span
            className={`jam-badge ${connectionStatus === 'connected' ? 'jam-badge--live' : 'jam-badge--pending'}`}
          >
            {connectionStatus === 'connected'
              ? 'Live'
              : connectionStatus === 'reconnecting'
                ? 'Reconnecting…'
                : 'Connecting…'}
          </span>
        </div>
        <div className="jam-code-row">
          <span className="jam-code">{session.code}</span>
          <button type="button" className="jam-copy-btn" onClick={copyLink}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
        </div>
      </div>

      <div className="jam-panel jam-panel--row">
        <div className="jam-now-playing">
          {track?.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={track.coverUrl} alt="" className="jam-now-playing__cover" />
          ) : (
            <div className="jam-now-playing__cover" aria-hidden />
          )}
          <div className="jam-now-playing__meta">
            <div className="jam-now-playing__title">{track?.title ?? 'Nothing playing yet'}</div>
            {track?.artistName ? (
              <div className="jam-now-playing__artist">{track.artistName}</div>
            ) : null}
          </div>
        </div>
        {!isHost && !audioUnlocked && track?.streamUrl ? (
          <button type="button" className="jam-copy-btn" onClick={() => setAudioUnlocked(true)}>
            ▶ Play along
          </button>
        ) : null}
      </div>

      <div className="jam-panel">
        <p className="jam-title" style={{ fontSize: '0.9rem', marginBottom: '0.6rem' }}>
          {session.participants.length} jamming
        </p>
        <ul className="jam-participants">
          {session.participants.map((p) => (
            <li key={p.userId} className="jam-participant">
              <span className="jam-participant__avatar">{initial(p.displayName)}</span>
              <span>{p.displayName}</span>
              {p.role === 'HOST' ? <span className="jam-badge jam-badge--host">Host</span> : null}
            </li>
          ))}
        </ul>
      </div>

      <div className="jam-actions">
        {isHost ? (
          <button type="button" className="jam-copy-btn" onClick={() => void endForEveryone()}>
            End Jam for everyone
          </button>
        ) : (
          <button type="button" className="jam-copy-btn" onClick={() => void leave()}>
            Leave Jam
          </button>
        )}
      </div>
    </div>
  )
}
