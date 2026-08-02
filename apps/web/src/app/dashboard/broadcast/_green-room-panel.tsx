'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import { Button, StatusPill, Text } from '@tahti/ui'
import type {
  GreenRoomCandidateView,
  GreenRoomInvitePool,
  GreenRoomInviteView,
  GreenRoomSessionView,
} from '@tahti/shared'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'

const POOL_LABELS: Record<GreenRoomInvitePool, string> = {
  MODERATORS_AND_SUBS: 'Moderators + fan subscribers',
  SUBS_ONLY: 'Fan subscribers only',
  MANUAL_ONLY: 'Manual invites only',
}

function inviteStatus(invite: GreenRoomInviteView) {
  if (invite.joinedAt) return 'In green room'
  return 'Invited'
}

export function GreenRoomPanel({ artistUsername }: { artistUsername: string }) {
  const [session, setSession] = useState<GreenRoomSessionView | null>(null)
  const [username, setUsername] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadSession() {
    const res = await fetch(`${API_BASE}/api/me/channel/green-room`, { credentials: 'include' })
    if (res.ok) setSession((await res.json()) as GreenRoomSessionView)
  }

  useEffect(() => {
    void loadSession()
  }, [])

  async function patchEnabled(enabled: boolean) {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/me/channel/green-room`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? 'Could not update green room')
        return
      }
      setSession((await res.json()) as GreenRoomSessionView)
    } finally {
      setPending(false)
    }
  }

  async function syncInvites() {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/me/channel/green-room/sync`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? 'Could not sync invites')
        return
      }
      setSession((await res.json()) as GreenRoomSessionView)
    } finally {
      setPending(false)
    }
  }

  async function addInvite() {
    if (!username.trim()) return
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/me/channel/green-room/invites`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username: username.trim() }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setError(body?.error ?? 'Could not invite user')
        return
      }
      setUsername('')
      await loadSession()
    } finally {
      setPending(false)
    }
  }

  async function removeInvite(userId: string) {
    setPending(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/me/channel/green-room/invites/${userId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        setError('Could not remove invite')
        return
      }
      await loadSession()
    } finally {
      setPending(false)
    }
  }

  if (!session) return null

  const canManage =
    session.channelState === 'PREVIEW' || session.channelState === 'LIVE' || session.enabled
  const joinedCount = session.invites.filter((invite) => invite.joinedAt).length

  return (
    <div className="studio-card studio-mt-md green-room-panel">
      <div className="green-room-panel__header">
        <div>
          <h4 className="broadcast-studio__card-title">Green room</h4>
          <Text as="p" tone="muted" size="sm" className="studio-mt-xs">
            Invite collaborators to hear your preview stream before you go live. No video chat yet —
            this is listen-only backstage access.
          </Text>
        </div>
        {session.enabled ? <StatusPill tone="green">Open</StatusPill> : null}
      </div>

      <label className="studio-label-row studio-text-sm studio-mt-md">
        <input
          type="checkbox"
          checked={session.enabled}
          disabled={pending || session.channelState === 'OFFLINE'}
          onChange={(e) => void patchEnabled(e.target.checked)}
        />
        Enable green room for this broadcast
      </label>

      {session.channelState === 'OFFLINE' ? (
        <Text as="p" tone="muted" size="sm" className="studio-mt-sm">
          Start streaming to unlock green room controls.
        </Text>
      ) : null}

      {session.enabled && canManage ? (
        <>
          <Text as="p" tone="muted" size="sm" className="studio-mt-md">
            Default invite pool: {POOL_LABELS[session.invitePool]}. Change defaults in{' '}
            <a href="/dashboard/settings/green-room" className="studio-link">
              broadcast settings
            </a>
            .
          </Text>

          <div className="green-room-panel__actions studio-mt-md">
            {session.invitePool !== 'MANUAL_ONLY' ? (
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() => void syncInvites()}
              >
                Sync from {session.invitePool === 'SUBS_ONLY' ? 'subscribers' : 'moderators + subs'}
              </Button>
            ) : null}
            <a
              href={`/u/${artistUsername}/green-room`}
              className="studio-link green-room-panel__guest-link"
              target="_blank"
              rel="noreferrer"
            >
              Open guest view →
            </a>
          </div>

          <div className="studio-field studio-mt-md">
            <label className="studio-label studio-text-muted-sm" htmlFor="green-room-username">
              Invite by username
            </label>
            <div className="broadcast-studio__pin-row studio-mt-sm">
              <input
                id="green-room-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="collaborator-username"
                className="studio-input"
                disabled={pending}
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={pending || !username.trim()}
                onClick={() => void addInvite()}
              >
                Invite
              </Button>
            </div>
          </div>

          {session.invites.length > 0 ? (
            <div className="green-room-panel__list studio-mt-md">
              <span className="studio-label studio-text-muted-sm">
                Guests ({joinedCount}/{session.invites.length} joined)
              </span>
              <ul className="green-room-panel__invite-list">
                {session.invites.map((invite) => (
                  <li key={invite.userId} className="green-room-panel__invite-row">
                    <div>
                      <strong>{invite.displayName}</strong>
                      <span className="studio-text-muted-sm"> @{invite.username}</span>
                      <span className="green-room-panel__invite-meta">
                        {inviteStatus(invite)} · {invite.source.toLowerCase().replace('_', ' ')}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={pending}
                      onClick={() => void removeInvite(invite.userId)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          ) : session.candidates.length > 0 ? (
            <div className="green-room-panel__candidates studio-mt-md">
              <span className="studio-label studio-text-muted-sm">Ready to invite</span>
              <ul className="green-room-panel__candidate-list">
                {session.candidates.slice(0, 6).map((candidate: GreenRoomCandidateView) => (
                  <li key={candidate.userId}>
                    {candidate.displayName}{' '}
                    <span className="studio-text-muted-sm">@{candidate.username}</span>
                  </li>
                ))}
              </ul>
              {session.invitePool !== 'MANUAL_ONLY' ? (
                <Text as="p" tone="muted" size="sm" className="studio-mt-sm">
                  Use sync to invite everyone in your default pool.
                </Text>
              ) : null}
            </div>
          ) : (
            <Text as="p" tone="muted" size="sm" className="studio-mt-md">
              No guests yet — invite by username or sync from your default pool.
            </Text>
          )}
        </>
      ) : null}

      {error ? <p className="studio-notice studio-notice--error studio-mt-sm">{error}</p> : null}
    </div>
  )
}
