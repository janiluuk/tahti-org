// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useState, useTransition } from 'react'
import { ButtonIcon, Button } from '@tahti/ui'
import { banChatFingerprint, unbanChatFingerprint } from '../../moderator-actions'

export interface ChatBanRow {
  fingerprintHash: string
  bannedAt: string
}

export function ChatModerationPanel({ slug, initial }: { slug: string; initial: ChatBanRow[] }) {
  const [bans, setBans] = useState(initial)
  const [fingerprintHash, setFingerprintHash] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function ban() {
    setError(null)
    const trimmed = fingerprintHash.trim()
    if (!trimmed) return
    startTransition(async () => {
      const res = await banChatFingerprint(slug, trimmed)
      if (res.error) {
        setError(res.error)
        return
      }
      setBans((prev) => [
        { fingerprintHash: trimmed, bannedAt: new Date().toISOString() },
        ...prev.filter((b) => b.fingerprintHash !== trimmed),
      ])
      setFingerprintHash('')
    })
  }

  function unban(hash: string) {
    setError(null)
    startTransition(async () => {
      const res = await unbanChatFingerprint(slug, hash)
      if (res.error) {
        setError(res.error)
        return
      }
      setBans((prev) => prev.filter((b) => b.fingerprintHash !== hash))
    })
  }

  return (
    <section className="studio-panel-section">
      <h2 className="studio-section-heading">Chat bans</h2>
      <p className="studio-help">
        Banned listeners are blocked by their anonymous chat fingerprint — a hash derived from their
        browser, not their account. Find a fingerprint by asking a moderator who saw the message,
        then ban it here.
      </p>

      {bans.length === 0 ? (
        <p className="studio-empty">No one is currently banned from this channel&apos;s chat.</p>
      ) : (
        <ul className="studio-list studio-mt-sm">
          {bans.map((b) => (
            <li key={b.fingerprintHash} className="studio-item-row--list">
              <span className="studio-flex-1">
                <code>{b.fingerprintHash}</code>
                <span className="studio-text-muted-sm">
                  {' '}
                  · banned {new Date(b.bannedAt).toLocaleString()}
                </span>
              </span>
              <Button
                onClick={() => unban(b.fingerprintHash)}
                disabled={isPending}
                variant="ghost"
                size="sm"
              >
                Unban
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="studio-input-row studio-mt-lg">
        <input
          value={fingerprintHash}
          onChange={(e) => setFingerprintHash(e.target.value)}
          placeholder="Fingerprint hash to ban"
          className="studio-input studio-flex-1"
        />
        <Button
          onClick={ban}
          disabled={isPending || !fingerprintHash.trim()}
          variant="danger"
          size="sm"
        >
          <ButtonIcon name="trash" />
          Ban
        </Button>
      </div>
      {error && <p className="studio-text-error">{error}</p>}
    </section>
  )
}
