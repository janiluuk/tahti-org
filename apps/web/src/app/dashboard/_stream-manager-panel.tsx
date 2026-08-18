'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import ChatPanel from '@/app/c/[slug]/chat-panel'
import { resolveChannelUrl } from '@/lib/app-url'
import { endBroadcast } from './actions'

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001'
const LISTENER_POLL_MS = 5000

/** Status + listener count + live chat + end-stream, with no modal chrome of
 * its own — the shared body for both the top-nav stream manager modal
 * (_stream-manager-modal.tsx) and the dashboard home hero's inline live view
 * (_channel-hero.tsx), so "what's happening on my stream right now" looks
 * and behaves the same wherever you open it from. */
export function StreamManagerPanel({
  slug,
  displayName,
  onEnded,
}: {
  slug: string
  displayName?: string
  /** Called after a successful end-stream, before the router refresh that
   * flips every isLive-derived UI (top-nav icon, this panel itself) back. */
  onEnded?: () => void
}) {
  const router = useRouter()
  const [listeners, setListeners] = useState<number | null>(null)
  const [ending, setEnding] = useState(false)

  useEffect(() => {
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
  }, [slug])

  async function handleEndStream() {
    if (!confirm('End your live broadcast now?')) return
    setEnding(true)
    try {
      const result = await endBroadcast()
      if (result.ok) {
        onEnded?.()
        router.refresh()
      } else {
        alert(result.error ?? 'Could not end broadcast')
      }
    } finally {
      setEnding(false)
    }
  }

  return (
    <div className="stream-mgr-panel">
      <div className="stream-mgr-panel__header">
        <div>
          <div className="stream-mgr-panel__title">
            <span className="signal-dot" aria-hidden />
            Stream manager
          </div>
          <p className="stream-mgr-panel__meta">
            {listeners == null ? 'Loading listeners…' : `${listeners} listening now`}
            {' · '}
            <Link href={resolveChannelUrl(slug)} target="_blank" rel="noopener noreferrer">
              View public channel →
            </Link>
          </p>
        </div>
        <button
          type="button"
          className="ui-btn ui-btn--danger ui-btn--sm"
          disabled={ending}
          onClick={handleEndStream}
        >
          {ending ? 'Ending…' : '■ End stream'}
        </button>
      </div>

      <div className="stream-mgr-panel__chat">
        <ChatPanel slug={slug} announcements={[]} isLoggedIn accountHandle={displayName} />
      </div>
    </div>
  )
}
