// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { LoginPromptModal } from './login-prompt-modal'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'

function IconRepost() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 5.5h7.5A2.5 2.5 0 0 1 13 8v.5M13 10.5H5.5A2.5 2.5 0 0 1 3 8v-.5"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M5 3.5 3 5.5l2 2M11 12.5l2-2-2-2"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Repost/share a track to your own followers — the artist gets a NEW_REPOST
 * notification the first time each listener reposts it. Distinct from
 * ArchiveDownloadButton's repost-to-download acknowledgment, which gates a
 * download rather than sharing anything. */
export function RepostButton({
  channelSlug,
  itemId,
  initialReposted = false,
  initialRepostCount = 0,
}: {
  channelSlug: string
  itemId: string
  initialReposted?: boolean
  initialRepostCount?: number
}) {
  const [reposted, setReposted] = useState(initialReposted)
  const [repostCount, setRepostCount] = useState(initialRepostCount)
  const [pending, setPending] = useState(false)
  const [showLogin, setShowLogin] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch(
        `${API_URL}/api/v1/c/${encodeURIComponent(channelSlug)}/archive/${itemId}/repost`,
        { credentials: 'include' },
      )
      if (!res.ok || cancelled) return
      const data = (await res.json()) as { reposted: boolean; repostCount: number }
      setReposted(data.reposted)
      setRepostCount(data.repostCount)
    })()
    return () => {
      cancelled = true
    }
  }, [channelSlug, itemId])

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    setPending(true)
    try {
      const res = await fetch(
        `${API_URL}/api/v1/c/${encodeURIComponent(channelSlug)}/archive/${itemId}/repost`,
        { method: reposted ? 'DELETE' : 'POST', credentials: 'include' },
      )
      if (res.status === 401) {
        setShowLogin(true)
        return
      }
      if (!res.ok) return
      const data = (await res.json()) as { reposted: boolean; repostCount: number }
      setReposted(data.reposted)
      setRepostCount(data.repostCount)
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={`ch-repost-btn${reposted ? ' ch-repost-btn--active' : ''}`}
        onClick={(e) => void toggle(e)}
        disabled={pending}
        aria-pressed={reposted}
        aria-label={reposted ? 'Remove repost' : 'Repost this track'}
        title={reposted ? 'Reposted' : 'Repost'}
      >
        <IconRepost />
        {repostCount > 0 && <span className="ch-repost-btn__count">{repostCount}</span>}
      </button>
      {showLogin && (
        <LoginPromptModal
          message="Sign in to repost this track."
          onClose={() => setShowLogin(false)}
        />
      )}
    </>
  )
}
