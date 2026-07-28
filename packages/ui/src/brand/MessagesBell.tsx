'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { AvatarTile } from './AvatarTile'

export type MessagesBellConversation = {
  id: string
  otherUser: { username: string; displayName: string; avatarUrl: string | null }
  lastMessage: { body: string; senderUsername: string; createdAt: string } | null
  unreadCount: number
  updatedAt: string
}

type MessagesBellProps = {
  fetchConversations: () => Promise<MessagesBellConversation[]>
}

function IconMessages() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M2 3.5h12a1 1 0 0 1 1 1V11a1 1 0 0 1-1 1H6l-3 2.5V12H2a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function fmtRelative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diffMs / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

/** Header messages button — scrollable dropdown of conversations (newest
 * first, already returned in that order by GET /api/me/messages/conversations),
 * unread ones highlighted. Reading a conversation happens on the thread page
 * itself (GET .../conversations/:id marks it read as a side effect), so the
 * badge here just reflects whatever the list endpoint currently reports —
 * unlike NotificationBell, opening the dropdown doesn't clear it. */
export function MessagesBell({ fetchConversations }: MessagesBellProps) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [conversations, setConversations] = useState<MessagesBellConversation[]>([])
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchConversations().then(setConversations)
  }, [fetchConversations])

  useEffect(() => {
    if (!open) return
    async function onPointerDown(e: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  async function toggle() {
    const next = !open
    setOpen(next)
    if (next && !loaded) {
      setConversations(await fetchConversations())
      setLoaded(true)
    }
  }

  const unreadTotal = conversations.reduce((sum, c) => sum + c.unreadCount, 0)

  return (
    <div className="studio-top-nav__notif" ref={menuRef}>
      <button
        type="button"
        className="studio-top-nav__notif-btn"
        aria-label="Messages"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <IconMessages />
        {unreadTotal > 0 && (
          <span className="studio-top-nav__notif-badge">
            {unreadTotal > 9 ? '9+' : unreadTotal}
          </span>
        )}
      </button>
      {open && (
        <div
          className="studio-top-nav__menu studio-top-nav__notif-menu studio-top-nav__messages-menu"
          role="menu"
        >
          {conversations.length === 0 ? (
            <p className="studio-top-nav__notif-empty">No messages yet.</p>
          ) : (
            conversations.map((c) => (
              <Link
                key={c.id}
                href={`/dashboard/messages/${c.id}`}
                className={`studio-top-nav__message-item${c.unreadCount > 0 ? ' studio-top-nav__message-item--unread' : ''}`}
                role="menuitem"
                onClick={() => setOpen(false)}
              >
                <AvatarTile
                  size="xs"
                  name={c.otherUser.displayName}
                  src={c.otherUser.avatarUrl}
                  className="studio-top-nav__message-avatar"
                />
                <div className="studio-top-nav__message-body">
                  <div className="studio-top-nav__message-name">{c.otherUser.displayName}</div>
                  {c.lastMessage && (
                    <div className="studio-top-nav__notif-body">{c.lastMessage.body}</div>
                  )}
                  <div className="studio-top-nav__notif-time">{fmtRelative(c.updatedAt)}</div>
                </div>
                {c.unreadCount > 0 && <span className="studio-top-nav__message-dot" aria-hidden />}
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  )
}
