// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function IconHeart({ filled }: { filled: boolean }) {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      aria-hidden
    >
      <path
        d="M8 13.8s-5.7-3.5-5.7-7.4a3.3 3.3 0 0 1 5.7-2.2 3.3 3.3 0 0 1 5.7 2.2c0 3.9-5.7 7.4-5.7 7.4Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
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
        window.location.href = `/login?next=${encodeURIComponent(pathname || '/')}`
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
      <IconHeart filled={following} />
      {following ? 'Following' : 'Follow'}
      {followerCount > 0 && <span className="ch-follow-btn__count">{followerCount}</span>}
    </button>
  )
}
