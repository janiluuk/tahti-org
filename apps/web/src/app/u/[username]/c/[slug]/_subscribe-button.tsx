// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { LoginPromptModal } from '@/components/login-prompt-modal'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

/** Subscribe to a public playlist — surfaces it in the listener's library and
 * (future work) notifies them when a track is added. Distinct from
 * FollowButton (follows an artist) and AddTrackButton (contributes a track
 * to a collaborative playlist) — this just watches the playlist itself. */
export function SubscribeButton({ slug }: { slug: string }) {
  const [subscribed, setSubscribed] = useState(false)
  const [subscriberCount, setSubscriberCount] = useState(0)
  const [pending, setPending] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch(`${API_URL}/api/v1/collections/${slug}/subscribe`, {
        credentials: 'include',
      })
      if (!res.ok || cancelled) return
      const data = (await res.json()) as { subscribed: boolean; subscriberCount: number }
      setSubscribed(data.subscribed)
      setSubscriberCount(data.subscriberCount)
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  async function toggle() {
    setPending(true)
    try {
      const res = await fetch(`${API_URL}/api/v1/collections/${slug}/subscribe`, {
        method: subscribed ? 'DELETE' : 'POST',
        credentials: 'include',
      })
      if (res.status === 401) {
        setShowLogin(true)
        return
      }
      if (!res.ok) return
      const data = (await res.json()) as { subscribed: boolean; subscriberCount: number }
      setSubscribed(data.subscribed)
      setSubscriberCount(data.subscriberCount)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={`prof-subscribe-btn${subscribed ? ' prof-subscribe-btn--active' : ''}`}
        onClick={() => void toggle()}
        disabled={pending}
        aria-pressed={subscribed}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
          <path
            d="M8 2.5v7M4.5 6 8 9.5 11.5 6"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path d="M3 12.5h10" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        {subscribed ? 'Subscribed' : 'Subscribe'}
        {subscriberCount > 0 && (
          <span className="prof-subscribe-btn__count">{subscriberCount}</span>
        )}
      </button>
      {showLogin && (
        <LoginPromptModal
          message="Sign in to subscribe to this playlist."
          onClose={() => setShowLogin(false)}
        />
      )}
    </>
  )
}
