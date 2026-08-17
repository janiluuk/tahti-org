// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import { LoginPromptModal } from './login-prompt-modal'
import { useToast } from '@/contexts/toast-context'

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

/** M40: "love" a track — the artist gets a NEW_LIKE notification the first time
 * each listener loves it, and the loved track surfaces in that listener's /feed. */
export function LoveButton({
  channelSlug,
  itemId,
  initialLiked = false,
  initialLikeCount = 0,
}: {
  channelSlug: string
  itemId: string
  initialLiked?: boolean
  initialLikeCount?: number
}) {
  const [liked, setLiked] = useState(initialLiked)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [pending, setPending] = useState(false)
  const [showLogin, setShowLogin] = useState(false)
  const { showToast } = useToast()

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const res = await fetch(
        `${API_URL}/api/v1/c/${encodeURIComponent(channelSlug)}/archive/${itemId}/like`,
        { credentials: 'include' },
      )
      if (!res.ok || cancelled) return
      const data = (await res.json()) as { liked: boolean; likeCount: number }
      setLiked(data.liked)
      setLikeCount(data.likeCount)
    })()
    return () => {
      cancelled = true
    }
  }, [channelSlug, itemId])

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    const previousLiked = liked
    const previousLikeCount = likeCount
    const nextLiked = !liked
    setLiked(nextLiked)
    setLikeCount((count) => Math.max(0, count + (nextLiked ? 1 : -1)))
    setPending(true)
    try {
      const res = await fetch(
        `${API_URL}/api/v1/c/${encodeURIComponent(channelSlug)}/archive/${itemId}/like`,
        { method: liked ? 'DELETE' : 'POST', credentials: 'include' },
      )
      if (res.status === 401) {
        setLiked(previousLiked)
        setLikeCount(previousLikeCount)
        setShowLogin(true)
        return
      }
      if (!res.ok) {
        setLiked(previousLiked)
        setLikeCount(previousLikeCount)
        showToast('Could not update this like. Please try again.', 'error')
        return
      }
      const data = (await res.json()) as { liked: boolean; likeCount: number }
      setLiked(data.liked)
      setLikeCount(data.likeCount)
      showToast(
        data.liked ? 'Added to your liked tracks.' : 'Removed from your liked tracks.',
        'success',
      )
    } catch {
      setLiked(previousLiked)
      setLikeCount(previousLikeCount)
      showToast('Could not update this like. Please try again.', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        className={`ch-love-btn${liked ? ' ch-love-btn--active' : ''}`}
        onClick={(e) => void toggle(e)}
        disabled={pending}
        aria-pressed={liked}
        aria-label={liked ? 'Unlove this track' : 'Love this track'}
        title={liked ? 'Unlove' : 'Love'}
      >
        <IconHeart filled={liked} />
        {likeCount > 0 && <span className="ch-love-btn__count">{likeCount}</span>}
      </button>
      {showLogin && (
        <LoginPromptModal
          message="Sign in to love this track."
          onClose={() => setShowLogin(false)}
        />
      )}
    </>
  )
}
