// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function IconPerson({ filled }: { filled: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      aria-hidden
    >
      <circle cx="8" cy="5.5" r="2.6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M3.2 13.2c0-2.4 2.1-4.3 4.8-4.3s4.8 1.9 4.8 4.3"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** Free follow/subscribe — distinct from the paid fan-subscription tiers at
 * /u/[username]/subscribe. Following an artist enrols the listener in NEW_POST
 * and NEW_TRACK notifications for that artist (see packages/db/src/notifications.ts). */
export function FollowButton({
  artistUsername,
  initialFollowing = false,
  initialFollowerCount = 0,
}: {
  artistUsername: string
  initialFollowing?: boolean
  initialFollowerCount?: number
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [following, setFollowing] = useState(initialFollowing)
  const [followerCount, setFollowerCount] = useState(initialFollowerCount)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch(
        `${API_URL}/api/v1/artists/${encodeURIComponent(artistUsername)}/follow`,
        { credentials: 'include' },
      )
      if (!res.ok || cancelled) return
      const data = (await res.json()) as { following: boolean; followerCount: number }
      setFollowing(data.following)
      setFollowerCount(data.followerCount)
    })()
    return () => {
      cancelled = true
    }
  }, [artistUsername])

  async function toggle() {
    setPending(true)
    try {
      const res = await fetch(
        `${API_URL}/api/v1/artists/${encodeURIComponent(artistUsername)}/follow`,
        { method: following ? 'DELETE' : 'POST', credentials: 'include' },
      )
      if (res.status === 401) {
        // Client-side nav, not a hard reload — a hard reload here tears down
        // the shared PlayerProvider, stopping whatever's playing. Playback
        // must never stop except when the listener stops it themselves.
        router.push(`/login?next=${encodeURIComponent(pathname || '/')}`)
        return
      }
      if (!res.ok) return
      const data = (await res.json()) as { following: boolean; followerCount: number }
      setFollowing(data.following)
      setFollowerCount(data.followerCount)
    } finally {
      setPending(false)
    }
  }

  return (
    <button
      type="button"
      className={`ch-follow-btn${following ? ' ch-follow-btn--active' : ''}`}
      onClick={() => void toggle()}
      disabled={pending}
      aria-pressed={following}
    >
      <IconPerson filled={following} />
      {following ? 'Following' : 'Follow'}
      {followerCount > 0 && <span className="ch-follow-btn__count">{followerCount}</span>}
    </button>
  )
}
