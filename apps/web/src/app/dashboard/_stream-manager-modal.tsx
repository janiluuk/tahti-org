'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ChatPanel from '@/app/c/[slug]/chat-panel'
import { resolveChannelUrl } from '@/lib/app-url'
import { endBroadcast } from './actions'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const LISTENER_POLL_MS = 5000

/** Quick in-place view of an active broadcast — status, listener count, and
 * live chat — opened from the top-nav go-live icon once you're on air, so
 * you don't have to leave whatever dashboard page you're on to check in. */
export function StreamManagerModal({
  slug,
  displayName,
  open,
  onClose,
}: {
  slug: string
  displayName?: string
  open: boolean
  onClose: () => void
}) {
  const titleId = useId()
  const router = useRouter()
  const [listeners, setListeners] = useState<number | null>(null)
  const [ending, setEnding] = useState(false)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    async function poll() {
      try {
        const res = await fetch(`${API_BASE}/api/channels/${slug}/presence`, {
          credentials: 'include',
        })
        if (res.ok && !cancelled) {
          const data = (await res.json()) as { numClients: number }
          setListeners(data.numClients)
        }
      } catch {
        // ignore polling errors — keep showing the last known count
      }
    }
    poll()
    const id = window.setInterval(poll, LISTENER_POLL_MS)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [open, slug])

  async function handleEndStream() {
    if (!confirm('End your live broadcast now?')) return
    setEnding(true)
    try {
      const result = await endBroadcast()
      if (result.ok) {
        onClose()
        router.refresh()
      } else {
        alert(result.error ?? 'Could not end broadcast')
      }
    } finally {
      setEnding(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="stream-mgr-modal"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        className="stream-mgr-modal__card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="stream-mgr-modal__header">
          <div>
            <h2 id={titleId} className="stream-mgr-modal__title">
              <span className="signal-dot" aria-hidden />
              Stream manager
            </h2>
            <p className="stream-mgr-modal__meta">
              {listeners == null ? 'Loading listeners…' : `${listeners} listening now`}
              {' · '}
              <Link href={resolveChannelUrl(slug)} target="_blank" rel="noopener noreferrer">
                View public channel →
              </Link>
            </p>
          </div>
          <button
            type="button"
            className="stream-mgr-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="stream-mgr-modal__chat">
          <ChatPanel slug={slug} announcements={[]} isLoggedIn accountHandle={displayName} />
        </div>

        <div className="stream-mgr-modal__footer">
          <button
            type="button"
            className="ui-btn ui-btn--danger"
            disabled={ending}
            onClick={handleEndStream}
          >
            {ending ? 'Ending…' : '■ End stream'}
          </button>
        </div>
      </div>
    </div>
  )
}
