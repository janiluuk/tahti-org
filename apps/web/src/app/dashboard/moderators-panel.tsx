// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { ButtonIcon, Button } from '@tahti/ui'
import { addModerator, removeModerator, type ModeratorRow } from './moderator-actions'

export default function ModeratorsPanel({
  initial,
  channelSlug,
}: {
  initial: ModeratorRow[]
  channelSlug: string
}) {
  const [moderators, setModerators] = useState(initial)
  const [username, setUsername] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function add() {
    setError(null)
    setMessage(null)
    const handle = username.trim()
    if (!handle) return
    startTransition(async () => {
      const res = await addModerator(handle)
      if (res.error || !res.moderator) {
        setError(res.error ?? 'Failed to add moderator')
        return
      }
      setModerators((prev) => [
        ...prev.filter((m) => m.userId !== res.moderator!.userId),
        res.moderator!,
      ])
      setUsername('')
      setMessage(`@${res.moderator.username} added as moderator.`)
    })
  }

  function remove(userId: string, username2: string) {
    if (!confirm(`Revoke moderator access for @${username2}?`)) return
    setError(null)
    setMessage(null)
    startTransition(async () => {
      const res = await removeModerator(userId)
      if (res.error) {
        setError(res.error)
        return
      }
      setModerators((prev) => prev.filter((m) => m.userId !== userId))
      setMessage(`@${username2} removed as moderator.`)
    })
  }

  return (
    <section className="studio-panel-section">
      <h2 className="studio-section-heading">Moderators</h2>
      <p className="studio-help">
        Delegate chat moderation to trusted listeners — they can ban and unban disruptive
        fingerprints from{' '}
        <a href={`/dashboard/moderate/${channelSlug}`} className="studio-link-cta">
          your chat moderation page
        </a>
        , without access to your dashboard.
      </p>

      {moderators.length === 0 ? (
        <p className="studio-empty">No moderators yet.</p>
      ) : (
        <ul className="studio-list studio-mt-sm">
          {moderators.map((m) => (
            <li key={m.userId} className="studio-item-row--list">
              <span className="studio-flex-1">
                <strong>{m.displayName}</strong>{' '}
                <span className="studio-text-muted-sm">@{m.username}</span>
              </span>
              <Button
                onClick={() => remove(m.userId, m.username)}
                disabled={isPending}
                variant="danger"
                size="sm"
              >
                <ButtonIcon name="unlink" />
                Revoke
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="studio-input-row studio-mt-lg">
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username to add as moderator"
          className="studio-input studio-flex-1"
        />
        <Button onClick={add} disabled={isPending || !username.trim()} variant="primary">
          <ButtonIcon name="plus" />
          Add moderator
        </Button>
      </div>
      {error && <p className="studio-notice studio-notice--error">{error}</p>}
      {message && <p className="studio-notice studio-notice--success">{message}</p>}
    </section>
  )
}
