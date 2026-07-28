// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AvatarTile } from '@tahti/ui'

interface FollowUser {
  username: string
  displayName: string
  avatarUrl: string | null
}

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'
const PREVIEW_COUNT = 5

async function fetchPage(
  username: string,
  direction: 'followers' | 'following',
  offset: number,
): Promise<{ users: FollowUser[]; hasMore: boolean }> {
  const res = await fetch(
    `${API_URL}/api/v1/artists/${encodeURIComponent(username)}/${direction}?offset=${offset}`,
    { credentials: 'include' },
  )
  if (!res.ok) return { users: [], hasMore: false }
  return (await res.json()) as { users: FollowUser[]; hasMore: boolean }
}

function FollowListModal({
  username,
  direction,
  label,
  onClose,
}: {
  username: string
  direction: 'followers' | 'following'
  label: string
  onClose: () => void
}) {
  const [users, setUsers] = useState<FollowUser[]>([])
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchPage(username, direction, 0).then((page) => {
      if (cancelled) return
      setUsers(page.users)
      setHasMore(page.hasMore)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [username, direction])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  async function loadMore() {
    setLoadingMore(true)
    const page = await fetchPage(username, direction, users.length)
    setUsers((prev) => [...prev, ...page.users])
    setHasMore(page.hasMore)
    setLoadingMore(false)
  }

  return (
    <div
      className="prof-follow-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={label}
      onClick={onClose}
    >
      <div className="prof-follow-modal" onClick={(e) => e.stopPropagation()}>
        <div className="prof-follow-modal__header">
          <h2 className="prof-follow-modal__title">{label}</h2>
          <button
            type="button"
            className="prof-follow-modal__close"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="prof-follow-modal__list">
          {loading ? (
            <p className="prof-follow-modal__empty">Loading…</p>
          ) : users.length === 0 ? (
            <p className="prof-follow-modal__empty">Nobody here yet.</p>
          ) : (
            users.map((u) => (
              <Link key={u.username} href={`/u/${u.username}`} className="prof-follow-modal__row">
                <AvatarTile size="sm" name={u.displayName} src={u.avatarUrl} />
                <div>
                  <div className="prof-follow-modal__name">{u.displayName}</div>
                  <div className="prof-follow-modal__handle">@{u.username}</div>
                </div>
              </Link>
            ))
          )}
        </div>
        {hasMore && (
          <button
            type="button"
            className="prof-follow-modal__more"
            onClick={() => void loadMore()}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        )}
      </div>
    </div>
  )
}

/** Followers/following count + a few avatar thumbnails on the public profile —
 * clicking opens a modal to browse the full list. Renders nothing when the
 * artist has hidden this list (count is null) or has zero of it. */
export function FollowersSection({
  username,
  direction,
  count,
}: {
  username: string
  direction: 'followers' | 'following'
  count: number | null
}) {
  const [preview, setPreview] = useState<FollowUser[]>([])
  const [open, setOpen] = useState(false)
  const label = direction === 'followers' ? 'Followers' : 'Following'

  useEffect(() => {
    if (count == null || count === 0) return
    let cancelled = false
    fetchPage(username, direction, 0).then((page) => {
      if (!cancelled) setPreview(page.users.slice(0, PREVIEW_COUNT))
    })
    return () => {
      cancelled = true
    }
  }, [username, direction, count])

  if (count == null || count === 0) return null

  return (
    <>
      <button type="button" className="prof-follow-summary" onClick={() => setOpen(true)}>
        <div className="prof-follow-summary__avatars">
          {preview.map((u) => (
            <AvatarTile
              key={u.username}
              size="xs"
              name={u.displayName}
              src={u.avatarUrl}
              className="prof-follow-summary__avatar"
              bordered
            />
          ))}
        </div>
        <span className="prof-follow-summary__count">
          {count} {label}
        </span>
      </button>
      {open && (
        <FollowListModal
          username={username}
          direction={direction}
          label={label}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
