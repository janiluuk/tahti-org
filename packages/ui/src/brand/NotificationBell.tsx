'use client'

// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

export type NotificationBellItem = {
  id: string
  title: string
  body: string | null
  url: string | null
  readAt: string | null
  createdAt: string
}

type NotificationBellProps = {
  fetchNotifications: () => Promise<{ notifications: NotificationBellItem[]; unreadCount: number }>
  markAllRead: () => Promise<void>
}

function IconBell() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M8 1.5c-1.66 0-3 1.34-3 3v1.55c0 .5-.16.99-.46 1.4L3.4 9.2A1 1 0 0 0 4.2 10.8h7.6a1 1 0 0 0 .8-1.6l-1.14-1.75a2.5 2.5 0 0 1-.46-1.4V4.5c0-1.66-1.34-3-3-3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M6.3 13a1.8 1.8 0 0 0 3.4 0"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
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

/** M34: generic in-app notification bell — currently NEW_POST only, extensible. */
export function NotificationBell({ fetchNotifications, markAllRead }: NotificationBellProps) {
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [notifications, setNotifications] = useState<NotificationBellItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchNotifications().then((data) => {
      setNotifications(data.notifications)
      setUnreadCount(data.unreadCount)
    })
  }, [fetchNotifications])

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
    if (next) {
      if (!loaded) {
        const data = await fetchNotifications()
        setNotifications(data.notifications)
        setLoaded(true)
      }
      if (unreadCount > 0) {
        setUnreadCount(0)
        await markAllRead()
      }
    }
  }

  return (
    <div className="studio-top-nav__notif" ref={menuRef}>
      <button
        type="button"
        className="studio-top-nav__notif-btn"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={toggle}
      >
        <IconBell />
        {unreadCount > 0 && (
          <span className="studio-top-nav__notif-badge">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="studio-top-nav__menu studio-top-nav__notif-menu" role="menu">
          {notifications.length === 0 ? (
            <p className="studio-top-nav__notif-empty">No notifications yet.</p>
          ) : (
            notifications.map((n) => {
              const content = (
                <>
                  <div className="studio-top-nav__notif-title">{n.title}</div>
                  {n.body && <div className="studio-top-nav__notif-body">{n.body}</div>}
                  <div className="studio-top-nav__notif-time">{fmtRelative(n.createdAt)}</div>
                </>
              )
              return n.url ? (
                <Link
                  key={n.id}
                  href={n.url}
                  className="studio-top-nav__notif-item"
                  role="menuitem"
                  onClick={() => setOpen(false)}
                >
                  {content}
                </Link>
              ) : (
                <div key={n.id} className="studio-top-nav__notif-item" role="menuitem">
                  {content}
                </div>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
